/**
 * The Persona sandbox, end to end, in one run: every scenario is a throwaway
 * user whose inquiry is created through the app's own `startKyc`, driven
 * with Persona's simulate actions, decided by the sandbox Workflows, and
 * delivered back through the dev server's webhook route into the shared
 * database. Green means the record, the recorded events and the access
 * policy all agree with Persona. Notifications are sent for real (to Resend's
 * test address and the Telegram test group) but not asserted here.
 *
 *   KYC_E2E_DB_HOST=<host> pnpm --filter zivoe-dapp kyc:e2e
 *
 * See docs/runbooks/persona-kyc-sandbox-e2e.md.
 */
import { afterAll, beforeAll, describe, it } from 'vitest';

import { type KycStatus } from '@zivoe/database/kyc';

import { refusalFrom } from '@/server/kyc/kyc-status';

import {
  appUrl,
  closeHarness,
  createScopedKyc,
  createTestUser,
  deleteStaleTestUsers,
  driftCheck,
  kyc,
  persona,
  poll,
  recordedEvents,
  rewindRecord,
  simulate,
  store,
  unwrap
} from './kyc-sandbox.harness';

/** Where a Persona Workflow leaves an inquiry it has decided. */
const DECIDED: ReadonlyArray<KycStatus> = ['pending_review', 'approved', 'declined'];

async function waitForStatus({
  userId,
  oneOf,
  what
}: {
  userId: string;
  oneOf: ReadonlyArray<KycStatus>;
  what: string;
}) {
  const record = await poll(
    () => store.get({ userId }),
    (record) => !!record && oneOf.includes(record.status),
    { what }
  );
  if (!record) throw new Error('unreachable: poll resolved without a record');
  return record;
}

/** Persona has emitted every one of `names` for the inquiry and the app has recorded each. */
async function waitForEvents({ inquiryId, names }: { inquiryId: string; names: ReadonlyArray<string> }) {
  return poll(
    () => recordedEvents({ inquiryId }),
    (events) => names.every((name) => events.some((event) => event.name === name && event.recorded)),
    { what: `${names.join(' and ')} for ${inquiryId} to be delivered to the dev server and recorded` }
  );
}

beforeAll(async () => {
  const deleted = await deleteStaleTestUsers();
  if (deleted) console.log(`Deleted ${deleted} test user(s) left by earlier runs.`);

  // Preflight: nothing below can pass unless deliveries reach the dev server.
  // An unsigned POST must be rejected by the signature check — a 401 proves
  // the funnel, the dev server and the route are all up.
  const probe = await fetch(`${appUrl}/api/webhooks/persona`, { method: 'POST', body: '{}' });
  if (probe.status !== 401) {
    throw new Error(
      `POST ${appUrl}/api/webhooks/persona answered ${probe.status}, expected 401. Is the funnel up and APP_URL right?`
    );
  }
  const drift = await driftCheck.check();
  if (!drift.reachable) throw new Error(`Persona could not be read: ${drift.unavailable?.message}`);
  if (drift.findings.length > 0) {
    throw new Error(`The Persona sandbox webhook does not match this dev server:\n- ${drift.findings.join('\n- ')}`);
  }
});

afterAll(closeHarness);

describe.concurrent('Persona sandbox', () => {
  it('approve — the decisioning Workflow approves a completed inquiry', async ({ expect }) => {
    const { userId } = await createTestUser({ scenario: 'approve', lastName: 'E2E-APPROVE' });
    const { inquiryId } = unwrap(await kyc.startKyc({ userId }), 'startKyc');
    console.log(`[approve] user ${userId} inquiry ${inquiryId}`);
    expect(await store.get({ userId })).toMatchObject({
      status: 'in_progress',
      personaInquiryId: inquiryId,
      attemptCount: 1
    });

    await simulate({ inquiryId, actions: ['start_inquiry', 'complete_inquiry'] });

    // No simulate action decides this one: the record must leave `submitted` on its own.
    const record = await waitForStatus({
      userId,
      oneOf: DECIDED,
      what: 'the decisioning Workflow to decide the inquiry (still `submitted` = no active inquiry.completed Workflow)'
    });
    expect(record.status, 'the Workflow decided something other than approve for an E2E-APPROVE inquiry').toBe(
      'approved'
    );
    await waitForEvents({ inquiryId, names: ['inquiry.completed', 'inquiry.approved'] });

    expect(await kyc.startKyc({ userId })).toMatchObject({ ok: false, error: { code: 'already_verified' } });
  });

  it('decline — the Workflow declines an E2E-DECLINE inquiry', async ({ expect }) => {
    const { userId } = await createTestUser({ scenario: 'decline', lastName: 'E2E-DECLINE' });
    const { inquiryId } = unwrap(await kyc.startKyc({ userId }), 'startKyc');
    console.log(`[decline] user ${userId} inquiry ${inquiryId}`);

    await simulate({ inquiryId, actions: ['start_inquiry', 'complete_inquiry'] });

    const record = await waitForStatus({
      userId,
      oneOf: DECIDED,
      what: 'the decisioning Workflow to decide the inquiry'
    });
    expect(
      record.status,
      'the Workflow did not decline an E2E-DECLINE inquiry: the conditional step is missing (see the runbook)'
    ).toBe('declined');
    await waitForEvents({ inquiryId, names: ['inquiry.completed', 'inquiry.declined'] });

    expect(await kyc.startKyc({ userId })).toMatchObject({ ok: false, error: { code: 'declined' } });
  });

  it('review — the Workflow marks an E2E-REVIEW inquiry for review', async ({ expect }) => {
    const { userId } = await createTestUser({ scenario: 'review', lastName: 'E2E-REVIEW' });
    const { inquiryId } = unwrap(await kyc.startKyc({ userId }), 'startKyc');
    console.log(`[review] user ${userId} inquiry ${inquiryId}`);

    await simulate({ inquiryId, actions: ['start_inquiry', 'complete_inquiry'] });

    const record = await waitForStatus({
      userId,
      oneOf: DECIDED,
      what: 'the decisioning Workflow to decide the inquiry'
    });
    expect(
      record.status,
      'the Workflow did not mark an E2E-REVIEW inquiry for review: the conditional step is missing (see the runbook)'
    ).toBe('pending_review');
    await waitForEvents({ inquiryId, names: ['inquiry.completed', 'inquiry.marked-for-review'] });

    // The review email is held 30 minutes by QStash; this user stays until the next run so it can land.
    expect(await kyc.startKyc({ userId })).toMatchObject({ ok: false, error: { code: 'awaiting_decision' } });
  });

  it('fail — a failed inquiry waits for the Inquiry Failed Workflow, never a retry', async ({ expect }) => {
    const { userId } = await createTestUser({ scenario: 'fail', lastName: 'E2E-APPROVE' });
    const { inquiryId } = unwrap(await kyc.startKyc({ userId }), 'startKyc');
    console.log(`[fail] user ${userId} inquiry ${inquiryId}`);

    await simulate({ inquiryId, actions: ['start_inquiry', 'fail_inquiry'] });

    await waitForEvents({ inquiryId, names: ['inquiry.failed'] });
    const record = await waitForStatus({
      userId,
      oneOf: DECIDED,
      what: 'the Inquiry Failed Workflow to decide the inquiry (still `failed` = that Workflow is inactive)'
    });
    expect(record.attemptCount).toBe(1);
    // Whatever the Workflow decided, the investor never gets a retry from here.
    expect(await kyc.startKyc({ userId })).toMatchObject({ ok: false, error: { code: refusalFrom(record.status) } });
  });

  it('expire — an expired inquiry resumes on the same inquiry at no extra attempt', async ({ expect }) => {
    const { userId } = await createTestUser({ scenario: 'expire', lastName: 'E2E-APPROVE' });
    const { inquiryId } = unwrap(await kyc.startKyc({ userId }), 'startKyc');
    console.log(`[expire] user ${userId} inquiry ${inquiryId}`);

    // Never started: the abandonment case. The record exists, so this expiry does send the nudge email.
    await simulate({ inquiryId, actions: ['expire_inquiry'] });
    await waitForStatus({ userId, oneOf: ['expired'], what: 'inquiry.expired to reach the record' });
    await waitForEvents({ inquiryId, names: ['inquiry.expired'] });

    const resumed = unwrap(await kyc.startKyc({ userId }), 'startKyc (resume)');
    expect(resumed.inquiryId).toBe(inquiryId);
    expect(resumed.sessionToken).not.toBe('');
    expect(await store.get({ userId })).toMatchObject({
      status: 'in_progress',
      personaInquiryId: inquiryId,
      attemptCount: 1
    });
  });

  it('superseded — an event for an inquiry the record does not point at is ignored, and the sweep adopts the newest', async ({
    expect
  }) => {
    const { userId, email } = await createTestUser({ scenario: 'superseded', lastName: 'E2E-APPROVE' });
    const { inquiryId: first } = unwrap(await kyc.startKyc({ userId }), 'startKyc');
    // A second inquiry under the same reference id, made outside the app — a dashboard inquiry.
    const second = unwrap(
      await persona.createInquiry({
        referenceId: userId,
        prefill: { firstName: 'Sandbox', lastName: 'E2E-APPROVE', email, countryCode: 'US' }
      }),
      'createInquiry'
    ).inquiry.id;
    console.log(`[superseded] user ${userId} inquiries ${first} then ${second}`);

    await simulate({ inquiryId: second, actions: ['start_inquiry', 'complete_inquiry'] });
    await waitForEvents({ inquiryId: second, names: ['inquiry.completed', 'inquiry.approved'] });
    // Guard 2: both events were recorded, and the record still follows the first inquiry.
    expect(await store.get({ userId })).toMatchObject({
      status: 'in_progress',
      personaInquiryId: first,
      attemptCount: 1
    });

    // The sweep, 31 minutes "later": the stale record is re-read and re-pointed at the newest inquiry.
    const sweep = createScopedKyc(new Set([userId]));
    const report = await sweep.reconcile({ now: new Date(Date.now() + 31 * 60_000) });
    expect(report).toMatchObject({ checked: 1, changed: 1, unavailable: 0 });
    expect(await store.get({ userId })).toMatchObject({
      status: 'approved',
      personaInquiryId: second,
      attemptCount: 2
    });
    expect(await kyc.startKyc({ userId })).toMatchObject({ ok: false, error: { code: 'already_verified' } });
  });

  it('lost webhook — the sweep re-reads a stale record and applies the decision the app never received', async ({
    expect
  }) => {
    const { userId } = await createTestUser({ scenario: 'lost-webhook', lastName: 'E2E-APPROVE' });
    const { inquiryId } = unwrap(await kyc.startKyc({ userId }), 'startKyc');
    const started = await store.get({ userId });
    if (!started) throw new Error('no record after the start');
    console.log(`[lost-webhook] user ${userId} inquiry ${inquiryId}`);

    await simulate({ inquiryId, actions: ['start_inquiry', 'complete_inquiry'] });
    await waitForStatus({ userId, oneOf: ['approved'], what: 'the Workflow to approve the inquiry' });

    // As if neither webhook had reached the app: back to the start's snapshot.
    await rewindRecord({ userId, to: started });

    // The sweep, 31 minutes "later": the stale record is re-read and Persona's decision applied — same inquiry, same attempt.
    const sweep = createScopedKyc(new Set([userId]));
    const report = await sweep.reconcile({ now: new Date(Date.now() + 31 * 60_000) });
    expect(report).toMatchObject({ checked: 1, changed: 1, unavailable: 0 });
    expect(await store.get({ userId })).toMatchObject({
      status: 'approved',
      personaInquiryId: inquiryId,
      attemptCount: 1
    });
  });
});
