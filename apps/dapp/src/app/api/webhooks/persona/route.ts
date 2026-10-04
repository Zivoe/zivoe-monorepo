import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { createHash } from 'node:crypto';

import { kycVerification } from '@/server/kyc';
import { type WebhookIgnoredReason, type WebhookOutcome } from '@/server/kyc/kyc-verification';

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
const DRIFT_REASONS = new Set<WebhookIgnoredReason>(['unsubscribed_event', 'unmapped_status']);
/**
 * Event names already reported by this instance. A wildcard subscription
 * delivers every event Persona has, dozens per inquiry; one capture per
 * unexpected name per instance says the same thing as one per delivery.
 */
const reportedDrift = new Set<string>();

const handler = async (req: NextRequest): ApiResponse<WebhookOutcome | { outcome: 'unparseable' }> => {
  Sentry.setTag('source', 'API');
  Sentry.setTag('flow', FLOW);

  // One log line per delivery: how long the route held Persona (its timeout
  // is 5 s) and which attempt this was. The headers also answer, in the
  // sandbox, whether retries are freshly signed. Never any payload content.
  const startedAt = Date.now();
  const logDelivery = (outcome: string) =>
    Sentry.logger.info('persona-webhook delivery', {
      outcome,
      durationMs: Date.now() - startedAt,
      attemptsMade: req.headers.get('persona-webhook-attempts-made'),
      attemptsLeft: req.headers.get('persona-webhook-attempts-left'),
      firstAttemptedAt: req.headers.get('persona-webhook-first-attempted-at')
    });

  const rawBody = await req.text();

  const result = await kycVerification.receiveWebhook({
    rawBody,
    signatureHeader: req.headers.get('persona-signature'),
    receivedAt: new Date()
  });

  if (result.ok) {
    logDelivery(result.value.outcome);
    // Stable message per reason so the drift groups into one Sentry issue and
    // the event names travel in extra, rather than one issue per delivery.
    if (result.value.outcome === 'ignored' && DRIFT_REASONS.has(result.value.reason)) {
      const key = `${result.value.reason}:${result.value.eventName}`;
      if (!reportedDrift.has(key)) {
        reportedDrift.add(key);
        Sentry.captureException(new Error(`Persona webhook ignored: ${result.value.reason}`), {
          tags: { source: 'API', flow: FLOW },
          extra: { eventName: result.value.eventName }
        });
      }
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

    // A decisioning Workflow run errored: the affected user sits at
    // `submitted` until it is fixed. This names the run the moment it breaks;
    // the sweep's undecided alarm stays the safety net behind it.
    if (result.value.outcome === 'ops_alert') {
      Sentry.captureException(new Error('Persona reported a workflow run error'), {
        tags: { source: 'API', flow: FLOW },
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
