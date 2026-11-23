/**
 * What the sandbox scenarios share: the guarded environment, the Verification module
 * wired to the real adapters, throwaway users, and the reads the assertions
 * poll.
 *
 * The module built here runs IN THIS PROCESS — that is how a scenario calls
 * `startVerification` and `reconcile` directly. Persona's webhooks and QStash's
 * callbacks still go to the dev server behind APP_URL, which is why both
 * sides must share DATABASE_URL: this side writes the start, the server
 * writes the webhook, and the assertions read the one record.
 */
import { Client } from '@upstash/qstash';
import { and, asc, count, sql as drizzleSql, eq, gt, inArray, like, lt } from 'drizzle-orm';
import postgres from 'postgres';

import { createDatabase } from '@zivoe/database';
import {
  kycVerification,
  kycWebhookEvent,
  organization,
  organizationMember,
  profile,
  user,
  verificationSubject
} from '@zivoe/database/schema';

import {
  PERSONA_API_BASE_URL,
  PERSONA_API_VERSION,
  createPersonaApi,
  isPersonaSandboxKey
} from '@/server/verification/persona-api';
import {
  PERSONA_CASE_EVENTS,
  PERSONA_OPS_EVENTS,
  PERSONA_SUBSCRIBED_EVENTS,
  type VerificationRecord,
  type VerificationStore,
  createVerification
} from '@/server/verification/verification';
import { createQstashOutbox } from '@/server/verification/verification-outbox';
import { KYB_CASE_STATUS_SETS } from '@/server/verification/verification-status';
import { createPostgresVerificationStore } from '@/server/verification/verification-store';
import { createPersonaDriftCheck } from '@/server/verification/webhook-drift';

import { type Result } from '@/lib/result';

// ---------------------------------------------------------------------------
// Environment. Every check here fails closed, before anything is created.
// ---------------------------------------------------------------------------

function required(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} is not set. The run reads apps/dapp/.env — the same file the dev server boots from.`);
  return value;
}

const databaseUrl = required('DATABASE_URL');
const apiKey = required('PERSONA_API_KEY');
const templateVersionId = required('PERSONA_TEMPLATE_VERSION_ID');
const templateId = required('PERSONA_TEMPLATE_ID');
const kybFlow = {
  path: 'organization',
  templateId: required('PERSONA_KYB_TEMPLATE_ID'),
  templateVersionId: required('PERSONA_KYB_TEMPLATE_VERSION_ID'),
  accountTypeId: required('PERSONA_KYB_ACCOUNT_TYPE_ID'),
  caseTemplateId: required('PERSONA_KYB_CASE_TEMPLATE_ID'),
  caseStatuses: KYB_CASE_STATUS_SETS
} as const;
const qstashToken = required('QSTASH_TOKEN');
/** The dev server, as Persona and QStash reach it. */
export const appUrl = required('APP_URL').replace(/\/+$/, '');

// Sandbox only: a production key would create real, billable inquiries with fake identities.
if (!isPersonaSandboxKey(apiKey)) {
  throw new Error('PERSONA_API_KEY is not a sandbox key (persona_sandbox_…); refusing to run.');
}
// The database is named on the command line, not inherited: the run inserts and deletes users in it.
const databaseHost = new URL(databaseUrl).hostname.toLowerCase();
// eslint-disable-next-line turbo/no-undeclared-env-vars -- a command-line confirmation for this run, never a build input
if (process.env.KYC_E2E_DB_HOST?.toLowerCase() !== databaseHost) {
  throw new Error(
    `DATABASE_URL points at ${databaseHost}; run with KYC_E2E_DB_HOST=${databaseHost} to confirm that is the database you mean.`
  );
}
// A local dev server, never a deployment: the run's QStash jobs call back into APP_URL.
const appHost = new URL(appUrl).hostname.toLowerCase();
if (appHost === 'zivoe.com' || appHost.endsWith('.zivoe.com')) {
  throw new Error(`APP_URL is ${appUrl}; the run must point at a local dev server, never a deployment.`);
}

// ---------------------------------------------------------------------------
// Wiring — the same adapters as src/server/verification/index.ts, minus the channels:
// notifications are delivered by the dev server, never by this process.
// ---------------------------------------------------------------------------

const sql = postgres(databaseUrl, { prepare: false });
export const db = createDatabase(sql);
export const store = createPostgresVerificationStore({ db });
export const persona = createPersonaApi({ apiKey });
const outbox = createQstashOutbox({ qstash: new Client({ token: qstashToken }), baseUrl: appUrl });

/** Users this run created. Scenarios only ever sweep or count these. */
const runUserIds = new Set<string>();

/**
 * The module over a store that lists and counts only `subjectIds`: the sweep
 * re-reads every stale record it can see and notifies their owners, and a
 * shared dev database has records that are not this run's business. Recorded
 * events are left alone for the same reason.
 */
export function createScopedVerification(subjectIds: ReadonlySet<string>) {
  const scoped: VerificationStore = {
    ...store,
    async list({ statuses, subjectKind, syncedBefore, changedBefore, changedAfter, limit }) {
      if (subjectIds.size === 0) return [];
      return db
        .select({
          subjectId: kycVerification.subjectId,
          startedByUserId: kycVerification.startedByUserId,
          status: kycVerification.status,
          personaInquiryId: kycVerification.personaInquiryId,
          personaAccountId: kycVerification.personaAccountId,
          personaCaseId: kycVerification.personaCaseId,
          personaCaseStatus: kycVerification.personaCaseStatus,
          sourceAt: kycVerification.sourceAt,
          statusChangedAt: kycVerification.statusChangedAt,
          lastSyncedAt: kycVerification.lastSyncedAt,
          version: kycVerification.version,
          subjectKind: verificationSubject.kind
        })
        .from(kycVerification)
        .innerJoin(verificationSubject, eq(verificationSubject.id, kycVerification.subjectId))
        .where(
          and(
            inArray(kycVerification.subjectId, [...subjectIds]),
            inArray(kycVerification.status, [...statuses]),
            subjectKind ? eq(verificationSubject.kind, subjectKind) : undefined,
            syncedBefore ? lt(kycVerification.lastSyncedAt, syncedBefore) : undefined,
            changedBefore ? lt(kycVerification.statusChangedAt, changedBefore) : undefined,
            changedAfter ? gt(kycVerification.statusChangedAt, changedAfter) : undefined
          )
        )
        .orderBy(asc(kycVerification.lastSyncedAt))
        .limit(limit);
    },
    async count({ statuses, subjectKind, caseStatuses, changedBefore }) {
      if (subjectIds.size === 0) return 0;
      const rows = await db
        .select({ total: count() })
        .from(kycVerification)
        .innerJoin(verificationSubject, eq(verificationSubject.id, kycVerification.subjectId))
        .where(
          and(
            inArray(kycVerification.subjectId, [...subjectIds]),
            inArray(kycVerification.status, [...statuses]),
            subjectKind ? eq(verificationSubject.kind, subjectKind) : undefined,
            caseStatuses ? inArray(kycVerification.personaCaseStatus, [...caseStatuses]) : undefined,
            lt(kycVerification.statusChangedAt, changedBefore)
          )
        );
      return rows[0]?.total ?? 0;
    },
    deleteEventsBefore: () => Promise.resolve(0)
  };
  return createVerification({
    store: scoped,
    persona,
    outbox,
    statusEmails: { send: () => Promise.resolve() },
    operatorMessages: { send: () => Promise.resolve() },
    clock: { now: () => new Date() },
    // Webhooks are verified by the dev server; this instance never receives one.
    config: {
      webhookSecret: 'not-used-in-process',
      flows: { individual: { path: 'individual', templateId, templateVersionId }, organization: kybFlow }
    }
  });
}

/** The module for the whole run — `startVerification` and the policy refusals. Sweeps take a narrower scope. */
export const verification = createScopedVerification(runUserIds);

/** The dashboard check the daily cron runs, pointed at this dev server. */
export const driftCheck = createPersonaDriftCheck({
  persona,
  config: {
    endpointUrl: `${appUrl}/api/webhooks/persona`,
    expectedEvents: new Set([...PERSONA_SUBSCRIBED_EVENTS, ...PERSONA_CASE_EVENTS, ...PERSONA_OPS_EVENTS]),
    expectedApiVersion: PERSONA_API_VERSION,
    templates: [
      { templateId, templateVersionId },
      { templateId: kybFlow.templateId, templateVersionId: kybFlow.templateVersionId }
    ]
  }
});

export async function closeHarness() {
  await sql.end();
}

// ---------------------------------------------------------------------------
// Users. Emails go to Resend's test address, so nothing lands in an inbox;
// the last name is what the sandbox Workflow's conditional step branches on.
// ---------------------------------------------------------------------------

/** Resend accepts the whole delivered+… namespace and reports the send as delivered. */
export const E2E_EMAIL_PREFIX = 'delivered+kyc-e2e-';
/** One run's users, telling them apart from the last run's in the database and in Persona. */
export const runId = new Date().toISOString().replace(/\D/g, '').slice(0, 14);

/** Who starts for an organization's subject: its one member. A person starts for themselves. */
const actors = new Map<string, string>();
export const actorOf = (subjectId: string) => actors.get(subjectId) ?? subjectId;

export type WorkflowMarker = 'E2E-APPROVE' | 'E2E-DECLINE' | 'E2E-REVIEW';

export async function createTestUser({
  scenario,
  lastName,
  subjectKind = 'individual'
}: {
  scenario: string;
  lastName: WorkflowMarker;
  subjectKind?: 'individual' | 'organization';
}) {
  const now = new Date();
  const email = `${E2E_EMAIL_PREFIX}${scenario}-${runId}@resend.dev`;
  const [created] = await db
    .insert(user)
    .values({ name: `E2E ${scenario}`, email, emailVerified: true, createdAt: now, updatedAt: now })
    .returning({ id: user.id });
  if (!created) throw new Error('user insert returned no row');
  // The person, and their subject, are what `startVerification` prefills from and
  // what the webhook route requires before it applies an event for this reference
  // id. An organization's details prefill the business; no owner is listed, so
  // the KYB Workflow opens no child inquiry and the case is the team's at once.
  await db.insert(profile).values({
    id: created.id,
    firstName: 'Sandbox',
    lastName,
    amountOfInterest: '10k_100k',
    howFoundZivoe: 'other',
    countryOfResidence: 'US'
  });
  await db.insert(verificationSubject).values({ id: created.id, kind: 'individual', userId: created.id });
  runUserIds.add(created.id);
  if (subjectKind === 'individual') return { subjectId: created.id, email };

  const [company] = await db
    .insert(organization)
    .values({ name: `E2E ${scenario} LLC`, countryOfIncorporation: 'US', createdByUserId: created.id })
    .returning({ id: organization.id });
  if (!company) throw new Error('organization insert returned no row');
  await db.insert(verificationSubject).values({ id: company.id, kind: 'organization', organizationId: company.id });
  await db.insert(organizationMember).values({ organizationId: company.id, userId: created.id, title: 'CEO' });
  runUserIds.add(company.id);
  actors.set(company.id, created.id);
  return { subjectId: company.id, email };
}

/**
 * Users from earlier runs. They are kept for an hour so a `pending_review`
 * email held by QStash still finds its record; a deleted user's job would
 * retry into the dead-letter queue instead. Matched on the e2e prefix only.
 */
export async function deleteStaleTestUsers() {
  const deleted = await db
    .delete(user)
    .where(
      and(like(user.email, `${E2E_EMAIL_PREFIX}%@resend.dev`), lt(user.createdAt, new Date(Date.now() - 60 * 60_000)))
    )
    .returning({ id: user.id });
  return deleted.length;
}

/**
 * Puts the record back to an earlier snapshot, stamps included — the app as
 * it would look had the webhooks since then never arrived. Bypasses the
 * write path on purpose; nothing in the app can do this. The version still
 * moves, so a write that read the row before the rewind loses.
 */
export async function rewindRecord({ subjectId, to }: { subjectId: string; to: VerificationRecord }) {
  await db
    .update(kycVerification)
    .set({
      status: to.status,
      personaCaseId: to.personaCaseId,
      personaCaseStatus: to.personaCaseStatus,
      sourceAt: to.sourceAt,
      statusChangedAt: to.statusChangedAt,
      lastSyncedAt: to.lastSyncedAt,
      version: drizzleSql`${kycVerification.version} + 1`
    })
    .where(eq(kycVerification.subjectId, subjectId));
}

// ---------------------------------------------------------------------------
// Persona reads and the simulate actions — the sandbox's stand-in for a person
// holding a passport to a webcam.
// ---------------------------------------------------------------------------

const personaHeaders = {
  Authorization: `Bearer ${apiKey}`,
  'Persona-Version': PERSONA_API_VERSION,
  'Key-Inflection': 'kebab'
};

export type SimulateAction = 'start_inquiry' | 'complete_inquiry' | 'fail_inquiry' | 'expire_inquiry';

/** One action per request, in order — the chain a real inquiry would take. */
export async function simulate({ inquiryId, actions }: { inquiryId: string; actions: ReadonlyArray<SimulateAction> }) {
  for (const action of actions) {
    const response = await fetch(`${PERSONA_API_BASE_URL}/inquiries/${inquiryId}/perform-simulate-actions`, {
      method: 'POST',
      headers: { ...personaHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ meta: { 'simulate-actions': [{ type: action }] } })
    });
    if (!response.ok) {
      throw new Error(
        `${action} on ${inquiryId} failed (${response.status}): ${(await response.text()).slice(0, 300)}`
      );
    }
  }
}

/** Sets a sandbox case's status by API, the way a reviewer's click does — it emits the same events. */
export async function setCaseStatus({ caseId, status }: { caseId: string; status: string }) {
  const response = await fetch(`${PERSONA_API_BASE_URL}/cases/${caseId}/set-status`, {
    method: 'POST',
    headers: { ...personaHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ meta: { status } })
  });
  if (!response.ok) {
    throw new Error(
      `set-status ${status} on ${caseId} failed (${response.status}): ${(await response.text()).slice(0, 300)}`
    );
  }
}

/** The account type Persona gave an auto-created account — Business for a business inquiry, or the Workflow's owner relation fails. */
export async function readAccountType({ accountId }: { accountId: string }) {
  const response = await fetch(`${PERSONA_API_BASE_URL}/accounts/${accountId}`, { headers: personaHeaders });
  if (!response.ok)
    throw new Error(`account read failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  const { data } = (await response.json()) as { data: { attributes: { 'account-type-name': string | null } } };
  return data.attributes['account-type-name'];
}

/**
 * Persona's own events for one object (an inquiry or a case), oldest first,
 * each marked whether the app recorded it — the proof that a delivery reached
 * the webhook route and was applied (a superseded event is recorded too; an
 * unsubscribed one never is).
 */
export async function recordedEvents({ objectId }: { objectId: string }) {
  const query = new URLSearchParams({ 'filter[object-id]': objectId, 'page[size]': '25' });
  const response = await fetch(`${PERSONA_API_BASE_URL}/events?${query.toString()}`, { headers: personaHeaders });
  if (!response.ok)
    throw new Error(`events list failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  const { data } = (await response.json()) as { data: Array<{ id: string; attributes: { name: string } }> };
  const events = data.map((event) => ({ id: event.id, name: event.attributes.name })).reverse();
  if (events.length === 0) return [];

  const rows = await db
    .select({ id: kycWebhookEvent.id })
    .from(kycWebhookEvent)
    .where(
      inArray(
        kycWebhookEvent.id,
        events.map((event) => event.id)
      )
    );
  const recorded = new Set(rows.map((row) => row.id));
  return events.map((event) => ({ ...event, recorded: recorded.has(event.id) }));
}

// ---------------------------------------------------------------------------
// Waiting and unwrapping.
// ---------------------------------------------------------------------------

/** Re-reads until `until` holds or the deadline passes; the failure names what was awaited and the last value seen. */
export async function poll<T>(
  read: () => Promise<T>,
  until: (value: T) => boolean,
  { what, timeoutMs = 45_000, intervalMs = 1_500 }: { what: string; timeoutMs?: number; intervalMs?: number }
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last = await read();
  while (!until(last)) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out after ${timeoutMs / 1000}s waiting for ${what}. Last seen: ${JSON.stringify(last)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    last = await read();
  }
  return last;
}

export function unwrap<T, E>(result: Result<T, E>, what: string): T {
  if (!result.ok) throw new Error(`${what} failed: ${JSON.stringify(result.error)}`);
  return result.value;
}
