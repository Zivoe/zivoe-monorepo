import 'server-only';

import * as Sentry from '@sentry/nextjs';
import { Client } from '@upstash/qstash';

import { db } from '@/server/clients/db';
import { BASE_URL } from '@/server/utils/base-url';
import { sendKycStatusEmail } from '@/server/utils/send-email';
import { sendTelegramMessage } from '@/server/utils/send-telegram';

import { env } from '@/env';

import { createTelegramOperatorMessenger } from './kyc-operator-message';
import { createQstashOutbox } from './kyc-outbox';
import { createPostgresKycStore } from './kyc-store';
import { PERSONA_OPS_EVENTS, PERSONA_SUBSCRIBED_EVENTS, createKycVerification } from './kyc-verification';
import { createPersonaDriftCheck } from './kyc-webhook-drift';
import { PERSONA_API_VERSION, type PersonaRateLimit, createPersonaApi } from './persona-api';

// The wiring, and only the wiring. Types and vocabulary come from
// `./kyc-verification` and `./kyc-status`, so nothing that needs a constant
// has to import a module that opens a database connection.

/**
 * Persona's guidance: throttle below 15% of the environment's rate limit.
 * The sweep is the only burst this app makes, so one alert per minute per
 * instance is enough to see it coming without a capture per request.
 */
let rateLimitAlertedAt = 0;
function alertOnPersonaRateLimit(rateLimit: PersonaRateLimit) {
  if (rateLimit.remaining >= rateLimit.limit * 0.15 || Date.now() - rateLimitAlertedAt < 60_000) return;
  rateLimitAlertedAt = Date.now();
  Sentry.captureException(new Error('Persona rate limit nearly exhausted'), {
    tags: { source: 'API', flow: 'persona-rate-limit' },
    extra: rateLimit
  });
}

/** The one adapter over Persona's API, shared by the verification module and the Drift check. */
const personaApi = createPersonaApi({
  apiKey: env.PERSONA_API_KEY,
  templateVersionId: env.PERSONA_TEMPLATE_VERSION_ID,
  onRateLimit: alertOnPersonaRateLimit
});

/**
 * The outbox's own QStash client: one quick retry. The shared client retries
 * five times with exponential backoff (about 4 s when QStash is down), which
 * the webhook — Persona gives it 5 s — cannot afford; a publish that still
 * fails answers 500 and Persona redelivers.
 */
const outboxQstash = new Client({ token: env.QSTASH_TOKEN, retry: { retries: 1, backoff: () => 200 } });

/**
 * The default-wired KYC Verification: real adapters, system clock. Routes
 * and pages import this, and it is the only way in — the store, Persona and
 * the notification channels are reachable through it alone. Tests construct
 * their own with the in-memory adapters.
 */
export const kycVerification = createKycVerification({
  store: createPostgresKycStore({ db }),
  persona: personaApi,
  outbox: createQstashOutbox({ qstash: outboxQstash, baseUrl: BASE_URL }),
  statusEmails: {
    async send(input) {
      await sendKycStatusEmail(input);
    }
  },
  operatorMessages: createTelegramOperatorMessenger({ sendTelegramMessage, chatId: env.TELEGRAM_PERSONA_CHAT_ID }),
  clock: { now: () => new Date() },
  config: {
    webhookSecret: env.PERSONA_WEBHOOK_SECRET,
    templateVersionId: env.PERSONA_TEMPLATE_VERSION_ID,
    templateId: env.PERSONA_TEMPLATE_ID
  }
});

/**
 * The daily Drift check, over the same Persona adapter: the dashboard must
 * point exactly the handled events at `/api/webhooks/persona` on the API
 * version the adapter speaks, and nothing newer than the pinned template
 * version should be published unnoticed.
 */
export const personaDriftCheck = createPersonaDriftCheck({
  persona: personaApi,
  config: {
    endpointUrl: `${BASE_URL}/api/webhooks/persona`,
    expectedEvents: new Set([...PERSONA_SUBSCRIBED_EVENTS, ...PERSONA_OPS_EVENTS]),
    expectedApiVersion: PERSONA_API_VERSION,
    templateVersionId: env.PERSONA_TEMPLATE_VERSION_ID,
    templateId: env.PERSONA_TEMPLATE_ID
  }
});
