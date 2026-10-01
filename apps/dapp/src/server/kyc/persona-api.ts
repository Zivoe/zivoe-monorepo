import { z } from 'zod';

import { type Result, err, ok } from '@/lib/result';

import { type PersonaApi, type PersonaApiError, type PersonaSession } from './kyc-verification';
import { personaInquiryResourceSchema, toPersonaInquiry } from './persona-inquiry';

// ---------------------------------------------------------------------------
// Persona HTTPS adapter for the PersonaApi port. Contract verified 2026-08-22
// against Persona's API reference:
//   POST /inquiries                  { data: { attributes: { inquiry-template-version-id, fields } },
//                                      meta: { auto-create-account, auto-create-account-reference-id,
//                                              auto-create-inquiry-session } }
//                                    → { data: <inquiry>, meta: { session-token } }
//   POST /inquiries/{id}/resume      → { data: <inquiry>, meta: { session-token } }  (expired → pending)
//   GET  /inquiries?filter[reference-id]=  → { data: [<inquiry>, ...] }
//   GET  /webhooks                   → { data: [<webhook>, ...] }                    (the Drift check)
//   GET  /inquiry-templates/{id}     → { data: { relationships: { latest-published-version } } }
// Every failure is returned as the port's error — nothing here throws.
// ---------------------------------------------------------------------------

export const PERSONA_API_BASE_URL = 'https://api.withpersona.com/api/v1';
/** Pinned so a Persona API change is a deliberate bump, not a surprise. */
export const PERSONA_API_VERSION = '2025-12-08';
const PERSONA_TIMEOUT_MS = 15_000;

const sessionResponseSchema = z.object({
  data: personaInquiryResourceSchema,
  meta: z.object({ 'session-token': z.string().min(1) })
});

const listResponseSchema = z.object({
  data: z.array(personaInquiryResourceSchema)
});

// Only what identifies a webhook is required of the envelope. Each setting is
// read on its own below, so Persona repackaging one of them (as it did with
// `relationship-allowlist` in 2026-10) costs that field, not the whole read.
const webhookConfigListSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().min(1),
      attributes: z.object({ status: z.string(), url: z.string() }).passthrough()
    })
  )
});

const webhookSettingSchemas = {
  'api-version': z.string().nullish(),
  'enabled-events': z.array(z.string()).nullish(),
  'api-key-inflection': z.string().nullish(),
  'api-attributes-blocklist': z.array(z.string()).nullish(),
  // Persona has returned this as a string, an array, and (since 2026-10) an object
  // such as `{ state: 'include_all' }` or `{ state: 'include_some', relationships: [...] }`.
  'relationship-allowlist': z
    .union([
      z.string(),
      z.array(z.string()),
      z.object({ state: z.string(), relationships: z.array(z.string()).optional() })
    ])
    .nullish()
};

/** Collapses the allowlist's shapes to the `'include_all' | string[] | null` the drift check compares. */
function normalizeRelationshipAllowlist(
  value: string | Array<string> | { state: string; relationships?: Array<string> } | null | undefined
): string | Array<string> | null {
  if (value == null) return null;
  if (typeof value === 'string' || Array.isArray(value)) return value;
  return value.state === 'include_all' ? 'include_all' : (value.relationships ?? []);
}

const templateResponseSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    relationships: z
      .object({ 'latest-published-version': z.object({ data: z.object({ id: z.string() }).nullable() }).optional() })
      .optional()
  })
});

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Persona's `RateLimit-*` headers (300 requests a minute per environment by default). */
export type PersonaRateLimit = { limit: number; remaining: number; resetSeconds: number };
/** A 429 whose window resets sooner than this is waited out once; a longer one is the caller's problem. */
const RATE_LIMIT_RETRY_MAX_MS = 5_000;

function readRateLimit(headers: Headers): PersonaRateLimit | null {
  // A missing header is unknown, not zero: `Number(null)` would read as exhausted.
  const read = (name: string) => (headers.has(name) ? Number(headers.get(name)) : Number.NaN);
  const limit = read('RateLimit-Limit');
  const remaining = read('RateLimit-Remaining');
  const resetSeconds = read('RateLimit-Reset');
  if ([limit, remaining, resetSeconds].some(Number.isNaN)) return null;
  return { limit, remaining, resetSeconds };
}

type RequestConfig = {
  apiKey: string;
  baseUrl: string;
  fetchImpl: FetchLike;
  /** Called with every response's rate-limit headers, so a caller can alarm before the limit bites. */
  onRateLimit?: (rateLimit: PersonaRateLimit) => void;
};

/** One request → parsed body or a typed error; the only place HTTP is spoken. */
async function personaRequest<T>({
  apiKey,
  baseUrl,
  fetchImpl,
  onRateLimit,
  method,
  path,
  body,
  headers,
  schema
}: RequestConfig & {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
}): Promise<Result<T, PersonaApiError>> {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Persona-Version': PERSONA_API_VERSION,
      'Key-Inflection': 'kebab',
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  };

  let response: Response;
  for (let attempt = 0; ; attempt += 1) {
    try {
      response = await fetchImpl(`${baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(PERSONA_TIMEOUT_MS) });
    } catch (cause) {
      return err({ reason: 'network', message: cause instanceof Error ? cause.message : 'Persona request failed' });
    }

    const rateLimit = readRateLimit(response.headers);
    if (rateLimit) onRateLimit?.(rateLimit);

    // Persona's guidance for a 429 is to back off and retry. One short wait
    // is worth it here; a longer window is answered as the error it is.
    const retryAfterMs = rateLimit ? rateLimit.resetSeconds * 1000 : Infinity;
    if (response.status !== 429 || attempt > 0 || retryAfterMs > RATE_LIMIT_RETRY_MAX_MS) break;
    await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
  }

  // The body is not carried: Persona's validation errors echo the rejected
  // fields, and a create request carries the investor's name and email.
  if (!response.ok) {
    return err({
      reason: 'http',
      message: `Persona ${method} ${path} failed (${response.status})`,
      httpStatus: response.status
    });
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return err({ reason: 'invalid_response', message: `Persona ${method} ${path} returned a non-JSON body` });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return err({ reason: 'invalid_response', message: `Persona ${method} ${path}: ${parsed.error.message}` });
  }
  return ok(parsed.data);
}

export function createPersonaApi({
  apiKey,
  templateVersionId,
  baseUrl = PERSONA_API_BASE_URL,
  fetchImpl = fetch,
  onRateLimit
}: {
  apiKey: string;
  templateVersionId: string;
  baseUrl?: string;
  /** Injected for the parse tests; production uses the global fetch. */
  fetchImpl?: FetchLike;
  onRateLimit?: RequestConfig['onRateLimit'];
}): PersonaApi {
  function request<T>(input: {
    method: 'GET' | 'POST';
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
    schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  }): Promise<Result<T, PersonaApiError>> {
    return personaRequest({ apiKey, baseUrl, fetchImpl, onRateLimit, ...input });
  }

  /** Create and resume share a response shape; an unmodelled status on a fresh session is a contract break. */
  function toSession(
    parsed: z.infer<typeof sessionResponseSchema>,
    path: string
  ): Result<PersonaSession, PersonaApiError> {
    const inquiry = toPersonaInquiry(parsed.data);
    if (!inquiry.status) {
      return err({ reason: 'invalid_response', message: `Persona ${path}: unknown inquiry status` });
    }
    return ok({ inquiry: { ...inquiry, status: inquiry.status }, sessionToken: parsed.meta['session-token'] });
  }

  return {
    async createInquiry({ referenceId, prefill, idempotencyKey }) {
      const path = '/inquiries';
      const create = () =>
        request({
          method: 'POST',
          path,
          body: {
            data: {
              attributes: {
                'inquiry-template-version-id': templateVersionId,
                fields: {
                  'name-first': prefill.firstName,
                  'name-last': prefill.lastName,
                  'email-address': prefill.email,
                  ...(prefill.countryCode ? { 'address-country-code': prefill.countryCode } : {})
                }
              }
            },
            meta: {
              'auto-create-account': true,
              'auto-create-account-reference-id': referenceId,
              'auto-create-inquiry-session': true
            }
          },
          // Persona keeps a key for 24 hours and answers a repeat with the original response.
          headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
          schema: sessionResponseSchema
        });
      let result = await create();
      // A connection that dropped or timed out may have been completed by
      // Persona; with a key, asking again is safe and returns that inquiry.
      if (!result.ok && result.error.reason === 'network' && idempotencyKey) result = await create();
      return result.ok ? toSession(result.value, path) : result;
    },

    async resumeInquiry({ inquiryId }) {
      const path = `/inquiries/${encodeURIComponent(inquiryId)}/resume`;
      const result = await request({ method: 'POST', path, body: {}, schema: sessionResponseSchema });
      return result.ok ? toSession(result.value, path) : result;
    },

    async listInquiries({ referenceId }) {
      const query = new URLSearchParams({ 'filter[reference-id]': referenceId, 'page[size]': '25' });
      const result = await request({
        method: 'GET',
        path: `/inquiries?${query.toString()}`,
        schema: listResponseSchema
      });
      if (!result.ok) return result;

      // Newest first is Persona's default; sorted here so the module never
      // depends on it. Unmodelled statuses stay in the list (as null) so the
      // module can see that the newest inquiry is one it cannot read.
      return ok(result.value.data.map(toPersonaInquiry).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    },

    // One page is plenty: an environment holds a handful of webhooks, not hundreds.
    async listWebhooks() {
      const result = await request({ method: 'GET', path: '/webhooks', schema: webhookConfigListSchema });
      if (!result.ok) return result;

      return ok(
        result.value.data.map((webhook) => {
          const unreadable: Array<string> = [];
          const read = <K extends keyof typeof webhookSettingSchemas>(
            key: K
          ): z.infer<(typeof webhookSettingSchemas)[K]> | null => {
            const parsed = webhookSettingSchemas[key].safeParse(webhook.attributes[key]);
            if (parsed.success) return parsed.data;
            unreadable.push(key);
            return null;
          };

          return {
            id: webhook.id,
            status: webhook.attributes.status,
            url: webhook.attributes.url,
            apiVersion: read('api-version') ?? null,
            enabledEvents: read('enabled-events') ?? [],
            keyInflection: read('api-key-inflection') ?? null,
            attributeBlocklist: read('api-attributes-blocklist') ?? [],
            relationshipAllowlist: normalizeRelationshipAllowlist(read('relationship-allowlist')),
            unreadable
          };
        })
      );
    },

    // Persona does not expose templates to sandbox keys, so a 4xx here is expected outside production.
    async latestPublishedVersion({ templateId }) {
      const result = await request({
        method: 'GET',
        path: `/inquiry-templates/${encodeURIComponent(templateId)}`,
        schema: templateResponseSchema
      });
      if (!result.ok) return result;
      return ok(result.value.data.relationships?.['latest-published-version']?.data?.id ?? null);
    }
  };
}
