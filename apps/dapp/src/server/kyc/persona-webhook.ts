import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { type Result, err, ok } from '@/lib/result';

import { type ParsedPersonaInquiry } from './kyc-verification';
import { personaInquiryResourceSchema, toPersonaInquiry } from './persona-inquiry';

// ---------------------------------------------------------------------------
// Persona webhook contract (verified 2026-08-22 against Persona's docs):
//   header  `Persona-Signature: t=<unix seconds>,v1=<hex>`
//   v1      HMAC-SHA256(secret, "<t>.<raw body>")
//   rotation: two SPACE-separated sets, either may match
//   body    { data: { id, attributes: { name, created-at, payload: { data: <inquiry> } } } }
// Both functions are pure over their inputs so the module can verify with an
// injected clock and tests can sign fixtures with the real scheme.
// ---------------------------------------------------------------------------

/** Replay tolerance Persona's docs do not pin; enforced by us. */
export const PERSONA_SIGNATURE_TOLERANCE_MS = 5 * 60_000;
/** Rotation needs two sets; anything beyond is an unauthenticated request asking for HMAC work. */
const MAX_SIGNATURE_SETS = 3;

const isoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'expected an ISO 8601 timestamp')
  .transform((value) => new Date(value));

export type PersonaSignatureError = 'bad_signature' | 'stale_timestamp';

export function verifyPersonaSignature({
  rawBody,
  signatureHeader,
  secret,
  now,
  toleranceMs = PERSONA_SIGNATURE_TOLERANCE_MS
}: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
  now: Date;
  toleranceMs?: number;
}): Result<void, PersonaSignatureError> {
  if (!signatureHeader) return err('bad_signature');

  let sawValidSignature = false;

  for (const set of signatureHeader.trim().split(/\s+/).slice(0, MAX_SIGNATURE_SETS)) {
    // One timestamp per set, but keep every v1 in it — a set is compared
    // against all the signatures it carries, whatever separator a rotation uses.
    let timestamp: string | undefined;
    const provided: Array<string> = [];
    for (const pair of set.split(',')) {
      const [key = '', ...rest] = pair.split('=');
      if (key === 't') timestamp = rest.join('=');
      if (key === 'v1') provided.push(rest.join('='));
    }
    if (!timestamp || provided.length === 0 || !/^\d+$/.test(timestamp)) continue;

    const expectedBytes = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest();
    // Length is not secret; only the byte comparison must be constant-time.
    const matches = provided.some((hex) => {
      const providedBytes = Buffer.from(hex, 'hex');
      return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
    });
    if (!matches) continue;

    sawValidSignature = true;
    if (Math.abs(now.getTime() - Number(timestamp) * 1000) <= toleranceMs) return ok(undefined);
  }

  return err(sawValidSignature ? 'stale_timestamp' : 'bad_signature');
}

// The envelope is common to every Persona event; what sits under
// `payload.data` depends on the event's resource (inquiry, workflow-run, …),
// so the envelope parses first and the inquiry shape is attempted after.
const webhookEnvelopeSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    attributes: z.object({
      name: z.string().min(1),
      'created-at': isoDate,
      payload: z.object({ data: z.unknown() })
    })
  })
});

const payloadResourceIdSchema = z.object({ id: z.string().min(1) });

export type PersonaWebhookEvent = {
  id: string;
  name: string;
  createdAt: Date;
  /**
   * The inquiry as Persona saw it when the event fired; null when the payload
   * is some other resource. A null status is an inquiry status we do not model.
   */
  inquiry: ParsedPersonaInquiry | null;
  /** The payload resource's id whatever its type — names a failed workflow run in an ops alert. */
  resourceId: string | null;
};

/** Null when the body is not a Persona event of the documented envelope shape. */
export function parsePersonaWebhookEvent(rawBody: string): PersonaWebhookEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return null;
  }

  const parsed = webhookEnvelopeSchema.safeParse(json);
  if (!parsed.success) return null;

  const { data } = parsed.data;
  const payloadData = data.attributes.payload.data;
  const inquiry = personaInquiryResourceSchema.safeParse(payloadData);
  const resource = payloadResourceIdSchema.safeParse(payloadData);

  return {
    id: data.id,
    name: data.attributes.name,
    createdAt: data.attributes['created-at'],
    inquiry: inquiry.success ? toPersonaInquiry(inquiry.data) : null,
    resourceId: resource.success ? resource.data.id : null
  };
}
