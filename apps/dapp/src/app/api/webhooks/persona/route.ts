import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { createHash } from 'node:crypto';

import { verification } from '@/server/verification';
import { type WebhookOutcome } from '@/server/verification/verification';

import { ApiError, withErrorHandler } from '@/lib/utils';

import { type ApiResponse } from '../../utils';

// Two things here are easy to break in a refactor:
//   1. The body MUST be read raw (`req.text()`), never parsed first — the
//      signature is an HMAC over the exact bytes Persona sent.
//   2. Retry semantics. Persona retries any non-2xx for ~2 days, so the
//      status code is the retry decision: 200 for applied / duplicate /
//      ignored, AND for a validly signed body we cannot parse (retrying can
//      never fix it — it is captured instead); a real 500 for a store or
//      queue failure so Persona DOES retry; 401 for a bad signature and 413
//      for an oversized body, neither captured nor logged because this
//      endpoint is public and anyone can post to it. This route deliberately
//      does not copy the Resend webhook's 200-on-error.
const FLOW = 'persona-webhook';

/**
 * Ignored reasons that mean the Persona dashboard and `PERSONA_SUBSCRIBED_EVENTS`
 * disagree: the event was accepted, authenticated, and then dropped on the
 * floor. Subscribing to an event the module does not handle is otherwise a
 * silent no-op, which is exactly how a subscription change goes unnoticed.
 */
const DRIFT_REASONS: ReadonlySet<string> = new Set(['unsubscribed_event', 'unmapped_status']);
/**
 * A KYB case the verification could not place: a record nobody holds, an
 * individual's inquiry on a business case, a second case. Someone has to
 * look — once per case, since every status move of a stray case delivers again.
 */
const CASE_ALERT_REASONS: ReadonlySet<string> = new Set(['unmatched_case', 'conflicting_case']);
/**
 * What this instance already reported: unexpected event names, unknown case
 * statuses, stray cases. A wildcard subscription delivers every event
 * Persona has, dozens per inquiry; one capture per thing per instance says
 * the same as one per delivery.
 */
const reported = new Set<string>();
const once = (key: string) => {
  if (reported.has(key)) return false;
  reported.add(key);
  return true;
};

/** The envelope's event id; null for a body that is not JSON or names none. Only read for a signed delivery. */
const eventIdOf = (rawBody: string): string | null => {
  try {
    const id: unknown = (JSON.parse(rawBody) as { data?: { id?: unknown } } | null)?.data?.id;
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
};

const handler = async (req: NextRequest): ApiResponse<WebhookOutcome | { outcome: 'unparseable' }> => {
  Sentry.setTag('source', 'API');
  Sentry.setTag('flow', FLOW);

  // One log line per delivery: how long the route held Persona (its timeout
  // is 5 s) and which attempt this was. The headers also answer, in the
  // sandbox, whether retries are freshly signed. The event id (`evt_…`) is
  // what Persona's dashboard log is searched by; it comes from the envelope,
  // and never any payload content.
  const startedAt = Date.now();
  const logDelivery = (outcome: string) =>
    Sentry.logger.info('persona-webhook delivery', {
      outcome,
      eventId: eventIdOf(rawBody),
      durationMs: Date.now() - startedAt,
      attemptsMade: req.headers.get('persona-webhook-attempts-made'),
      attemptsLeft: req.headers.get('persona-webhook-attempts-left'),
      firstAttemptedAt: req.headers.get('persona-webhook-first-attempted-at')
    });

  const rawBody = await req.text();

  const result = await verification.receiveWebhook({
    rawBody,
    signatureHeader: req.headers.get('persona-signature'),
    receivedAt: new Date()
  });

  if (result.ok) {
    logDelivery(result.value.outcome);
    // Stable message per reason so the drift groups into one Sentry issue and
    // the event names travel in extra, rather than one issue per delivery.
    if (
      result.value.outcome === 'ignored' &&
      DRIFT_REASONS.has(result.value.reason) &&
      once(`${result.value.reason}:${result.value.eventName}`)
    ) {
      Sentry.captureException(new Error(`Persona webhook ignored: ${result.value.reason}`), {
        tags: { source: 'API', flow: FLOW },
        extra: { eventName: result.value.eventName }
      });
    }

    // A KYB case status outside every configured set: applied as in review,
    // but the configuration must learn its name. Once per name, like the drift above.
    const unknownCaseStatus = 'unknownCaseStatus' in result.value ? result.value.unknownCaseStatus : undefined;
    if (unknownCaseStatus && once(`unknown_case_status:${unknownCaseStatus}`)) {
      Sentry.captureException(new Error('Persona KYB case carries a status the configuration does not know'), {
        tags: { source: 'API', flow: FLOW },
        extra: { caseStatus: unknownCaseStatus }
      });
    }

    if (
      result.value.outcome === 'ignored' &&
      'caseId' in result.value &&
      CASE_ALERT_REASONS.has(result.value.reason) &&
      once(`${result.value.reason}:${result.value.caseId}`)
    ) {
      Sentry.captureException(new Error(`Persona KYB case could not be placed: ${result.value.reason}`), {
        level: 'warning',
        tags: { source: 'API', flow: FLOW, reason: result.value.reason },
        extra: { eventName: result.value.eventName, caseId: result.value.caseId }
      });
    }

    // A newer inquiry than the user's Decision will never be read on its own:
    // someone has to look, and `pnpm kyc:operator resync <userId>` adopts it.
    if (result.value.outcome === 'ignored' && result.value.reason === 'unadopted_inquiry') {
      Sentry.captureException(new Error('Persona decided an inquiry newer than the recorded decision'), {
        level: 'warning',
        tags: { source: 'API', flow: FLOW },
        extra: { eventName: result.value.eventName, userId: result.value.userId, inquiryId: result.value.inquiryId }
      });
    }

    // Someone decided an organization's business inquiry instead of its KYB
    // case. The app ignored it; the case still has to be decided. Once per
    // inquiry: Persona redelivers nothing here, but a second click would.
    if (
      result.value.outcome === 'ignored' &&
      result.value.reason === 'case_decides' &&
      once(`case_decides:${result.value.inquiryId}`)
    ) {
      Sentry.captureException(
        new Error("Persona decided an organization's business inquiry; only its KYB case decides"),
        {
          level: 'warning',
          tags: { source: 'API', flow: FLOW },
          extra: { eventName: result.value.eventName, userId: result.value.userId, inquiryId: result.value.inquiryId }
        }
      );
    }

    // A Workflow run errored: a decisioning run leaves its user at
    // `submitted` until it is fixed; the KYB Workflow's run ends errored for
    // every business inquiry with a blank TIN (its TIN lookup step has no
    // guard) until the workflow is changed in persona-config. The Workflow
    // rides as a tag so the two can be told apart in Sentry without hiding
    // either; the sweep's undecided alarm stays the safety net behind it.
    if (result.value.outcome === 'ops_alert') {
      Sentry.captureException(new Error('Persona reported a workflow run error'), {
        tags: { source: 'API', flow: FLOW, workflowId: result.value.workflowId ?? 'unknown' },
        extra: { eventName: result.value.eventName, resourceId: result.value.resourceId }
      });
    }

    return NextResponse.json({ success: true, data: result.value });
  }

  // Unauthenticated input gets no log line and no capture: this endpoint is
  // public, and anything that costs us work per anonymous request is a lever.
  if (result.error.code !== 'bad_signature' && result.error.code !== 'oversized') logDelivery(result.error.code);
  switch (result.error.code) {
    case 'oversized':
      throw new ApiError({ message: 'Payload too large', status: 413, capture: false });
    case 'bad_signature':
      throw new ApiError({ message: 'Invalid Persona signature', status: 401, capture: false });
    case 'stale_timestamp':
      // A valid signature with an old timestamp is Persona (or a replay). The
      // delivery log line above records it; a capture per request would let
      // anyone holding one old delivery write to Sentry at will.
      throw new ApiError({ message: 'Stale Persona signature timestamp', status: 401, capture: false });
    case 'malformed':
      // Never the body itself, not even a prefix: a signed Persona payload
      // carries names and identity fields, and this module stores no PII.
      // The hash is enough to match the delivery in Persona's dashboard log.
      Sentry.captureException(new Error('Persona webhook delivered an event this route cannot parse'), {
        tags: { source: 'API', flow: FLOW },
        extra: { bodyLength: rawBody.length, bodySha256: createHash('sha256').update(rawBody).digest('hex') }
      });
      return NextResponse.json({ success: true, data: { outcome: 'unparseable' } });
    case 'store_failure':
      throw new ApiError({ message: 'Failed to record Persona event', status: 500, exception: result.error.cause });
    case 'outbox_failure':
      throw new ApiError({ message: 'Failed to queue KYC notifications', status: 500, exception: result.error.cause });
  }
};

export const POST = withErrorHandler('Error receiving Persona webhook', handler);
