/**
 * The Persona sandbox, end to end, in one run: every scenario is a throwaway
 * user whose inquiry is created through the app's own `startVerification`, driven
 * with Persona's simulate actions, decided by the sandbox Workflows, and
 * delivered back through the dev server's webhook route into the shared
 * database. Green means the record, the recorded events and the access
 * policy all agree with Persona. Notifications are sent for real (to Resend's
 * test address and the Telegram test group) but not asserted here.
 *
 *   KYC_E2E_DB_HOST=<host> pnpm --filter zivoe-dapp kyc:e2e
 */
import { afterAll, beforeAll, describe, it } from 'vitest';

import { type VerificationStatus } from '@zivoe/database/kyc';

import { refusalFrom } from '@/server/verification/verification-status';

import {
  appUrl,
  closeHarness,
  createScopedVerification,
  createTestUser,
  deleteStaleTestUsers,
  driftCheck,
  persona,
  poll,
  readAccountType,
  recordedEvents,
  rewindRecord,
  setCaseStatus,
  simulate,
  store,
  unwrap,
  verification
} from './kyc-sandbox.harness';

/** Where a Persona Workflow leaves an inquiry it has decided. */
const DECIDED: ReadonlyArray<VerificationStatus> = ['pending_review', 'approved', 'declined'];

async function waitForStatus({
  userId,
  oneOf,
  what
}: {
  userId: string;
  oneOf: ReadonlyArray<VerificationStatus>;
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

/** Persona has emitted every one of `names` for the object and the app has recorded each. */
async function waitForEvents({ objectId, names }: { objectId: string; names: ReadonlyArray<string> }) {
  return poll(
    () => recordedEvents({ objectId }),
    (events) => names.every((name) => events.some((event) => event.name === name && event.recorded)),
    { what: `${names.join(' and ')} for ${objectId} to be delivered to the dev server and recorded` }
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
    const { inquiryId } = unwrap(await verification.startVerification({ userId }), 'startVerification');
    console.log(`[approve] user ${userId} inquiry ${inquiryId}`);
    expect(await store.get({ userId })).toMatchObject({
      status: 'in_progress',
      personaInquiryId: inquiryId
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
    await waitForEvents({ objectId: inquiryId, names: ['inquiry.completed', 'inquiry.approved'] });

    expect(await verification.startVerification({ userId })).toMatchObject({
      ok: false,
      error: { code: 'already_verified' }
    });
  });

  it('decline — the Workflow declines an E2E-DECLINE inquiry', async ({ expect }) => {
    const { userId } = await createTestUser({ scenario: 'decline', lastName: 'E2E-DECLINE' });
    const { inquiryId } = unwrap(await verification.startVerification({ userId }), 'startVerification');
    console.log(`[decline] user ${userId} inquiry ${inquiryId}`);

    await simulate({ inquiryId, actions: ['start_inquiry', 'complete_inquiry'] });

    const record = await waitForStatus({
      userId,
      oneOf: DECIDED,
      what: 'the decisioning Workflow to decide the inquiry'
    });
    expect(
      record.status,
      'the Workflow did not decline an E2E-DECLINE inquiry: its E2E conditional step is missing (kyc-aml-inquiry-completed-enrich-and-decision in persona-config)'
    ).toBe('declined');
    await waitForEvents({ objectId: inquiryId, names: ['inquiry.completed', 'inquiry.declined'] });

    expect(await verification.startVerification({ userId })).toMatchObject({ ok: false, error: { code: 'declined' } });
  });

  it('review — the Workflow marks an E2E-REVIEW inquiry for review', async ({ expect }) => {
    const { userId } = await createTestUser({ scenario: 'review', lastName: 'E2E-REVIEW' });
    const { inquiryId } = unwrap(await verification.startVerification({ userId }), 'startVerification');
    console.log(`[review] user ${userId} inquiry ${inquiryId}`);

    await simulate({ inquiryId, actions: ['start_inquiry', 'complete_inquiry'] });

    const record = await waitForStatus({
      userId,
      oneOf: DECIDED,
      what: 'the decisioning Workflow to decide the inquiry'
    });
    expect(
      record.status,
      'the Workflow did not mark an E2E-REVIEW inquiry for review: its E2E conditional step is missing (kyc-aml-inquiry-completed-enrich-and-decision in persona-config)'
    ).toBe('pending_review');
    await waitForEvents({ objectId: inquiryId, names: ['inquiry.completed', 'inquiry.marked-for-review'] });

    // The review email is held a minute by QStash; this user stays until the next run so it can land.
    expect(await verification.startVerification({ userId })).toMatchObject({
      ok: false,
      error: { code: 'awaiting_decision' }
    });
  });

  it('fail — a failed inquiry waits for the Inquiry Failed Workflow, never a retry', async ({ expect }) => {
    const { userId } = await createTestUser({ scenario: 'fail', lastName: 'E2E-APPROVE' });
    const { inquiryId } = unwrap(await verification.startVerification({ userId }), 'startVerification');
    console.log(`[fail] user ${userId} inquiry ${inquiryId}`);

    await simulate({ inquiryId, actions: ['start_inquiry', 'fail_inquiry'] });

    await waitForEvents({ objectId: inquiryId, names: ['inquiry.failed'] });
    const record = await waitForStatus({
      userId,
      oneOf: DECIDED,
      what: 'the Inquiry Failed Workflow to decide the inquiry (still `failed` = that Workflow is inactive)'
    });
    // Whatever the Workflow decided, the investor never gets a retry from here.
    expect(await verification.startVerification({ userId })).toMatchObject({
      ok: false,
      error: { code: refusalFrom(record.status, 'individual') }
    });
  });

  it('expire — an expired inquiry resumes on the same inquiry', async ({ expect }) => {
    const { userId } = await createTestUser({ scenario: 'expire', lastName: 'E2E-APPROVE' });
    const { inquiryId } = unwrap(await verification.startVerification({ userId }), 'startVerification');
    console.log(`[expire] user ${userId} inquiry ${inquiryId}`);

    // Never started: the abandonment case. The record exists, so this expiry does send the nudge email.
    await simulate({ inquiryId, actions: ['expire_inquiry'] });
    await waitForStatus({ userId, oneOf: ['expired'], what: 'inquiry.expired to reach the record' });
    await waitForEvents({ objectId: inquiryId, names: ['inquiry.expired'] });

    const resumed = unwrap(await verification.startVerification({ userId }), 'startVerification (resume)');
    expect(resumed.inquiryId).toBe(inquiryId);
    expect(resumed.sessionToken).not.toBe('');
    expect(await store.get({ userId })).toMatchObject({
      status: 'in_progress',
      personaInquiryId: inquiryId
    });
  });

  it('superseded — an event for an inquiry the record does not point at is ignored, and the sweep adopts the newest', async ({
    expect
  }) => {
    const { userId, email } = await createTestUser({ scenario: 'superseded', lastName: 'E2E-APPROVE' });
    const { inquiryId: first } = unwrap(await verification.startVerification({ userId }), 'startVerification');
    // A second inquiry under the same reference id, made outside the app — a dashboard inquiry.
    const second = unwrap(
      await persona.createInquiry({
        templateVersionId: process.env.PERSONA_TEMPLATE_VERSION_ID ?? '',
        fields: {
          'name-first': 'Sandbox',
          'name-last': 'E2E-APPROVE',
          'email-address': email,
          'address-country-code': 'US'
        },
        referenceId: userId
      }),
      'createInquiry'
    ).inquiry.id;
    console.log(`[superseded] user ${userId} inquiries ${first} then ${second}`);

    await simulate({ inquiryId: second, actions: ['start_inquiry', 'complete_inquiry'] });
    await waitForEvents({ objectId: second, names: ['inquiry.completed', 'inquiry.approved'] });
    // Guard 2: both events were recorded, and the record still follows the first inquiry.
    expect(await store.get({ userId })).toMatchObject({
      status: 'in_progress',
      personaInquiryId: first
    });

    // The sweep, 31 minutes "later": the stale record is re-read and re-pointed at the newest inquiry.
    const sweep = createScopedVerification(new Set([userId]));
    const report = await sweep.reconcile({ now: new Date(Date.now() + 31 * 60_000) });
    expect(report).toMatchObject({ checked: 1, changed: 1, unavailable: 0 });
    expect(await store.get({ userId })).toMatchObject({
      status: 'approved',
      personaInquiryId: second
    });
    expect(await verification.startVerification({ userId })).toMatchObject({
      ok: false,
      error: { code: 'already_verified' }
    });
  });

  it('lost webhook — the sweep re-reads a stale record and applies the decision the app never received', async ({
    expect
  }) => {
    const { userId } = await createTestUser({ scenario: 'lost-webhook', lastName: 'E2E-APPROVE' });
    const { inquiryId } = unwrap(await verification.startVerification({ userId }), 'startVerification');
    const started = await store.get({ userId });
    if (!started) throw new Error('no record after the start');
    console.log(`[lost-webhook] user ${userId} inquiry ${inquiryId}`);

    await simulate({ inquiryId, actions: ['start_inquiry', 'complete_inquiry'] });
    await waitForStatus({ userId, oneOf: ['approved'], what: 'the Workflow to approve the inquiry' });

    // As if neither webhook had reached the app: back to the start's snapshot.
    await rewindRecord({ userId, to: started });

    // The sweep, 31 minutes "later": the stale record is re-read and Persona's decision applied — same inquiry.
    const sweep = createScopedVerification(new Set([userId]));
    const report = await sweep.reconcile({ now: new Date(Date.now() + 31 * 60_000) });
    expect(report).toMatchObject({ checked: 1, changed: 1, unavailable: 0 });
    expect(await store.get({ userId })).toMatchObject({
      status: 'approved',
      personaInquiryId: inquiryId
    });
  });
});

// ---------------------------------------------------------------------------
// Organizations: the business inquiry completes, the KYB Workflow opens the
// case, and the case decides. No owner is listed, so the case is the team's
// at once; a reviewer's click is the set-status call. Every completion also
// ends the Workflow run errored (a Persona-side defect, 2026-10-13), which the
// dev server reports as an ops alert and nothing here waits on.
// ---------------------------------------------------------------------------

/** The record once the Workflow has opened the case: in review, following the case and its raw status. */
async function waitForCase({ userId, caseStatus }: { userId: string; caseStatus: string }) {
  const record = await poll(
    () => store.get({ userId }),
    (record) => record?.status === 'pending_review' && record.personaCaseStatus === caseStatus,
    { what: `the KYB Workflow to open the case and move it to ${caseStatus}` }
  );
  if (!record?.personaCaseId) throw new Error('unreachable: in review without a case');
  return { ...record, personaCaseId: record.personaCaseId };
}

describe.concurrent('Persona sandbox — organizations', () => {
  const start = async (scenario: string) => {
    const { userId } = await createTestUser({ scenario, lastName: 'E2E-APPROVE', accountType: 'organization' });
    const { inquiryId } = unwrap(await verification.startVerification({ userId }), 'startVerification');
    console.log(`[${scenario}] organization ${userId} inquiry ${inquiryId}`);
    return { userId, inquiryId };
  };

  it('kyb-approve — the business inquiry opens a case on a Business account, and approving the case approves the organization', async ({
    expect
  }) => {
    const { userId, inquiryId } = await start('kyb-approve');
    const started = await store.get({ userId });
    expect(started).toMatchObject({ status: 'in_progress', personaInquiryId: inquiryId, personaCaseId: null });
    // The Workflow's owner relation needs a Business-typed account; the app asks for it on create.
    expect(await readAccountType({ accountId: started?.personaAccountId ?? '' })).toBe('Business');

    await simulate({ inquiryId, actions: ['start_inquiry', 'complete_inquiry'] });
    const { personaCaseId } = await waitForCase({ userId, caseStatus: 'Ready for Review' });
    await waitForEvents({ objectId: personaCaseId, names: ['case.created', 'case.status-updated'] });

    await setCaseStatus({ caseId: personaCaseId, status: 'Approved' });
    await waitForStatus({ userId, oneOf: ['approved'], what: 'the case approval to reach the record' });
    expect(await store.get({ userId })).toMatchObject({ personaCaseId, personaCaseStatus: 'Approved' });
    expect(await verification.startVerification({ userId })).toMatchObject({
      ok: false,
      error: { code: 'already_verified' }
    });
  });

  it('kyb-decline — declining the case declines the organization', async ({ expect }) => {
    const { userId, inquiryId } = await start('kyb-decline');

    await simulate({ inquiryId, actions: ['start_inquiry', 'complete_inquiry'] });
    const { personaCaseId } = await waitForCase({ userId, caseStatus: 'Ready for Review' });

    await setCaseStatus({ caseId: personaCaseId, status: 'Declined' });
    await waitForStatus({ userId, oneOf: ['declined'], what: 'the case decline to reach the record' });
    expect(await verification.startVerification({ userId })).toMatchObject({ ok: false, error: { code: 'declined' } });
  });

  it('kyb-reopen — a reopened case moves the organization back under review; a later decline wins', async ({
    expect
  }) => {
    const { userId, inquiryId } = await start('kyb-reopen');

    await simulate({ inquiryId, actions: ['start_inquiry', 'complete_inquiry'] });
    const { personaCaseId } = await waitForCase({ userId, caseStatus: 'Ready for Review' });
    await setCaseStatus({ caseId: personaCaseId, status: 'Approved' });
    await waitForStatus({ userId, oneOf: ['approved'], what: 'the case approval to reach the record' });

    await setCaseStatus({ caseId: personaCaseId, status: 'Open' });
    await waitForStatus({ userId, oneOf: ['pending_review'], what: 'the reopen to take the approval back' });
    expect(await store.get({ userId })).toMatchObject({ status: 'pending_review', personaCaseStatus: 'Open' });

    await setCaseStatus({ caseId: personaCaseId, status: 'Declined' });
    await waitForStatus({ userId, oneOf: ['declined'], what: 'the later decline to decide the organization' });
  });

  it('kyb-failed — a failed business inquiry is the end of the road: no restart, nothing undecided', async ({
    expect
  }) => {
    const { userId, inquiryId } = await start('kyb-failed');

    await simulate({ inquiryId, actions: ['start_inquiry', 'fail_inquiry'] });
    await waitForEvents({ objectId: inquiryId, names: ['inquiry.failed'] });
    await waitForStatus({ userId, oneOf: ['failed'], what: 'inquiry.failed to reach the record' });

    expect(await verification.startVerification({ userId })).toMatchObject({ ok: false, error: { code: 'failed' } });
    const sweep = createScopedVerification(new Set([userId]));
    const report = await sweep.reconcile({ now: new Date(Date.now() + 2 * 60 * 60_000) });
    expect(report).toMatchObject({ checked: 0, undecided: 0 });
  });

  it('kyb-lost-webhook — the sweep reads the case the app never heard about', async ({ expect }) => {
    const { userId, inquiryId } = await start('kyb-lost-webhook');
    const started = await store.get({ userId });
    if (!started) throw new Error('no record after the start');

    await simulate({ inquiryId, actions: ['start_inquiry', 'complete_inquiry'] });
    const { personaCaseId } = await waitForCase({ userId, caseStatus: 'Ready for Review' });
    await setCaseStatus({ caseId: personaCaseId, status: 'Approved' });
    await waitForStatus({ userId, oneOf: ['approved'], what: 'the case approval to reach the record' });

    // As if no webhook had reached the app since the start: back to that snapshot.
    await rewindRecord({ userId, to: started });

    // The sweep, 31 minutes "later": the inquiry is completed, so its case is the snapshot.
    const sweep = createScopedVerification(new Set([userId]));
    const report = await sweep.reconcile({ now: new Date(Date.now() + 31 * 60_000) });
    expect(report).toMatchObject({ checked: 1, changed: 1, unavailable: 0 });
    expect(await store.get({ userId })).toMatchObject({
      status: 'approved',
      personaInquiryId: inquiryId,
      personaCaseId,
      personaCaseStatus: 'Approved'
    });
  });
});
