import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { type VerificationStatus, verificationStatusValues } from '@zivoe/database/kyc';

import { type VerificationNotification, type VerificationRecord, createVerification } from './verification';
import { KYB_CASE_STATUS_SETS } from './verification-status';
import {
  FAKE_KYB_ACCOUNT_TYPE_ID,
  FAKE_KYB_CASE_TEMPLATE_ID,
  FAKE_KYB_TEMPLATE_ID,
  FAKE_KYB_TEMPLATE_VERSION_ID,
  FAKE_TEMPLATE_ID,
  FAKE_TEMPLATE_VERSION_ID,
  createFakePersonaApi,
  createInMemoryOperatorMessenger,
  createInMemoryOutbox,
  createInMemoryStatusEmailSender,
  createInMemoryVerificationStore,
  createManualClock
} from './verification.fakes';

const USER_ID = '7b6f9a1e-0c1d-4e6f-9a2b-3c4d5e6f7a8b';
const T0 = new Date('2026-08-22T10:00:00.000Z');
const WEBHOOK_SECRET = 'test-secret';
const MINUTE = 60_000;

const INDIVIDUAL_PROFILE = {
  accountType: 'individual',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  countryCode: 'GB',
  entityName: null,
  countryOfIncorporationCode: null
} as const;

/** The flows as the tests configure them; the organization one only when a test asks for it. */
const INDIVIDUAL_FLOW = {
  path: 'individual',
  templateId: FAKE_TEMPLATE_ID,
  templateVersionId: FAKE_TEMPLATE_VERSION_ID
} as const;
const ORGANIZATION_FLOW = {
  path: 'organization',
  templateId: FAKE_KYB_TEMPLATE_ID,
  templateVersionId: FAKE_KYB_TEMPLATE_VERSION_ID,
  accountTypeId: FAKE_KYB_ACCOUNT_TYPE_ID,
  caseTemplateId: FAKE_KYB_CASE_TEMPLATE_ID,
  caseStatuses: KYB_CASE_STATUS_SETS
} as const;

function setup({ organization = false }: { organization?: boolean } = {}) {
  const manualClock = createManualClock(T0);
  const memoryStore = createInMemoryVerificationStore();
  const fakePersona = createFakePersonaApi({ clock: manualClock.clock });
  const memoryOutbox = createInMemoryOutbox();
  const memoryEmails = createInMemoryStatusEmailSender();
  const memoryOperator = createInMemoryOperatorMessenger();
  /** Users whose yes a landed write took away, in order; `failApprovalEnded` makes the next notice reject. */
  const approvalsEnded: Array<string> = [];
  let failApprovalEnded = false;

  const verification = createVerification({
    store: memoryStore.store,
    persona: fakePersona.persona,
    outbox: memoryOutbox.outbox,
    statusEmails: memoryEmails.sender,
    operatorMessages: memoryOperator.messenger,
    approvalEnded: {
      async notify({ userId }) {
        if (failApprovalEnded) throw new Error('QStash is down');
        approvalsEnded.push(userId);
      }
    },
    clock: manualClock.clock,
    // Most fixtures name no template at all, so they also prove that such an inquiry is let through.
    config: {
      webhookSecret: WEBHOOK_SECRET,
      flows: { individual: INDIVIDUAL_FLOW, ...(organization ? { organization: ORGANIZATION_FLOW } : {}) }
    }
  });

  memoryStore.profiles.set(USER_ID, INDIVIDUAL_PROFILE);

  const seedRecord = (overrides: Partial<VerificationRecord> & { status: VerificationStatus }) => {
    const record: VerificationRecord = {
      userId: USER_ID,
      personaInquiryId: 'inq_seeded',
      personaAccountId: 'act_seeded',
      personaCaseId: null,
      personaCaseStatus: null,
      statusChangedAt: T0,
      lastSyncedAt: T0,
      ...overrides,
      // The newest snapshot a seeded row has taken is its last status change, unless the test says otherwise.
      sourceAt: overrides.sourceAt ?? overrides.statusChangedAt ?? T0
    };
    memoryStore.records.set(record.userId, record);
    return record;
  };

  return {
    verification,
    clock: manualClock,
    store: memoryStore,
    persona: fakePersona,
    outbox: memoryOutbox,
    emails: memoryEmails,
    operator: memoryOperator,
    approvalsEnded,
    failApprovalEnded: () => {
      failApprovalEnded = true;
    },
    seedRecord
  };
}

describe('getVerificationStatus', () => {
  it('answers not_started for a user without a record', async () => {
    const { verification, persona } = setup();

    await expect(verification.getVerificationStatus({ userId: USER_ID })).resolves.toEqual({
      status: 'not_started',
      path: 'individual',
      canStart: true,
      canResume: false,
      inquiryId: null,
      caseWaitingOn: null
    });
    expect(persona.calls).toHaveLength(0);
  });

  // Who may do what from each stored status — the same table startVerification enforces.
  const EXPECTED_FLAGS: Record<VerificationStatus, { canStart: boolean; canResume: boolean }> = {
    not_started: { canStart: true, canResume: false },
    in_progress: { canStart: false, canResume: true },
    submitted: { canStart: false, canResume: false },
    pending_review: { canStart: false, canResume: false },
    approved: { canStart: false, canResume: false },
    declined: { canStart: false, canResume: false },
    failed: { canStart: false, canResume: false },
    expired: { canStart: false, canResume: true },
    manually_approved: { canStart: false, canResume: false },
    revoked: { canStart: false, canResume: false }
  };

  it.each(verificationStatusValues)('maps a stored %s record to its view', async (status) => {
    const { verification, seedRecord, persona } = setup();
    seedRecord({ status });

    const view = await verification.getVerificationStatus({ userId: USER_ID });

    expect(view).toEqual({
      status,
      path: 'individual',
      ...EXPECTED_FLAGS[status],
      inquiryId: EXPECTED_FLAGS[status].canResume ? 'inq_seeded' : null,
      caseWaitingOn: null
    });
    expect(persona.calls).toHaveLength(0);
  });

  it('puts organization accounts on the team path regardless of the stored status', async () => {
    const { verification, store, seedRecord } = setup();
    store.profiles.set(USER_ID, { ...INDIVIDUAL_PROFILE, accountType: 'organization' });
    seedRecord({ status: 'manually_approved' });

    await expect(verification.getVerificationStatus({ userId: USER_ID })).resolves.toEqual({
      status: 'manually_approved',
      path: 'organization',
      canStart: false,
      canResume: false,
      inquiryId: null,
      caseWaitingOn: null
    });
  });
});

describe('listUnapproved', () => {
  it('answers which of the given users hold a record that is not a yes Decision, in one read', async () => {
    const { verification, seedRecord, store } = setup();
    seedRecord({ userId: 'declined', status: 'declined' });
    seedRecord({ userId: 'revoked', status: 'revoked' });
    seedRecord({ userId: 'approved', status: 'approved' });
    seedRecord({ userId: 'manual', status: 'manually_approved' });
    seedRecord({ userId: 'reopened', status: 'pending_review' });
    seedRecord({ userId: 'unlisted', status: 'revoked' });
    const list = vi.spyOn(store.store, 'list');

    const unapproved = await verification.listUnapproved({
      userIds: ['declined', 'revoked', 'approved', 'manual', 'reopened', 'no-record']
    });

    expect(unapproved).toEqual(new Set(['declined', 'revoked', 'reopened']));
    expect(list).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Webhook fixtures: the documented event shape, signed with the real scheme
// (HMAC-SHA256 over "<t>.<raw body>") right here so the fixture tracks it.
// ---------------------------------------------------------------------------

function personaEvent({
  id = 'evt_1',
  name,
  createdAt,
  inquiryId = 'inq_seeded',
  status,
  referenceId = USER_ID,
  accountId = 'act_seeded',
  templateId
}: {
  id?: string;
  name: string;
  createdAt: Date;
  inquiryId?: string;
  status: string;
  referenceId?: string | null;
  accountId?: string | null;
  templateId?: string;
}) {
  return JSON.stringify({
    data: {
      type: 'event',
      id,
      attributes: {
        name,
        'created-at': createdAt.toISOString(),
        payload: {
          data: {
            type: 'inquiry',
            id: inquiryId,
            attributes: {
              status,
              'reference-id': referenceId,
              'created-at': T0.toISOString(),
              'updated-at': createdAt.toISOString(),
              'name-first': 'should never be read'
            },
            relationships: {
              account: { data: accountId ? { type: 'account', id: accountId } : null },
              ...(templateId ? { 'inquiry-template': { data: { type: 'inquiry-template', id: templateId } } } : {})
            }
          },
          included: []
        }
      }
    }
  });
}

function sign({ rawBody, secret = WEBHOOK_SECRET, at }: { rawBody: string; secret?: string; at: Date }) {
  const t = Math.floor(at.getTime() / 1000);
  const v1 = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return `t=${t},v1=${v1}`;
}

/** A signed delivery of `name` for the seeded inquiry, `minutesAfterT0` after the seed time. */
function delivery({
  verification,
  name,
  status,
  minutesAfterT0 = 1,
  id,
  inquiryId,
  referenceId,
  templateId,
  signatureHeader,
  secret
}: {
  verification: ReturnType<typeof setup>['verification'];
  name: string;
  status: string;
  minutesAfterT0?: number;
  id?: string;
  inquiryId?: string;
  referenceId?: string | null;
  templateId?: string;
  signatureHeader?: string | null;
  secret?: string;
}) {
  const createdAt = new Date(T0.getTime() + minutesAfterT0 * MINUTE);
  const rawBody = personaEvent({ id, name, createdAt, status, inquiryId, referenceId, templateId });
  const receivedAt = new Date(createdAt.getTime() + 5_000);
  return verification.receiveWebhook({
    rawBody,
    signatureHeader: signatureHeader === undefined ? sign({ rawBody, secret, at: receivedAt }) : signatureHeader,
    receivedAt
  });
}

describe('receiveWebhook — signature', () => {
  it('accepts a correctly signed event', async () => {
    const { verification, seedRecord } = setup();
    seedRecord({ status: 'in_progress' });

    await expect(delivery({ verification, name: 'inquiry.completed', status: 'completed' })).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });
  });

  it('rejects a tampered body', async () => {
    const { verification, seedRecord } = setup();
    seedRecord({ status: 'in_progress' });
    const rawBody = personaEvent({ name: 'inquiry.approved', createdAt: T0, status: 'approved' });
    const signatureHeader = sign({ rawBody, at: T0 });

    const result = await verification.receiveWebhook({
      rawBody: rawBody.replace('"approved"', '"declined"'),
      signatureHeader,
      receivedAt: T0
    });

    expect(result).toEqual({ ok: false, error: { code: 'bad_signature' } });
  });

  it('rejects a signature made with another secret, and a missing header', async () => {
    const { verification } = setup();

    await expect(
      delivery({ verification, name: 'inquiry.approved', status: 'approved', secret: 'other' })
    ).resolves.toEqual({
      ok: false,
      error: { code: 'bad_signature' }
    });
    await expect(
      delivery({ verification, name: 'inquiry.approved', status: 'approved', signatureHeader: null })
    ).resolves.toEqual({ ok: false, error: { code: 'bad_signature' } });
  });

  it('rejects a valid signature whose timestamp is older than five minutes', async () => {
    const { verification } = setup();
    const rawBody = personaEvent({ name: 'inquiry.approved', createdAt: T0, status: 'approved' });

    const result = await verification.receiveWebhook({
      rawBody,
      signatureHeader: sign({ rawBody, at: T0 }),
      receivedAt: new Date(T0.getTime() + 6 * MINUTE)
    });

    expect(result).toEqual({ ok: false, error: { code: 'stale_timestamp' } });
  });

  it('accepts either set during secret rotation', async () => {
    const { verification, seedRecord } = setup();
    seedRecord({ status: 'in_progress' });
    const rawBody = personaEvent({
      name: 'inquiry.completed',
      createdAt: new Date(T0.getTime() + 30_000),
      status: 'completed'
    });
    const receivedAt = new Date(T0.getTime() + MINUTE);
    const oldSet = sign({ rawBody, secret: 'retired-secret', at: receivedAt });
    const newSet = sign({ rawBody, at: receivedAt });

    await expect(
      verification.receiveWebhook({ rawBody, signatureHeader: `${oldSet} ${newSet}`, receivedAt })
    ).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });
  });

  it('checks every v1 a set carries, not just the last one', async () => {
    const { verification, seedRecord } = setup();
    seedRecord({ status: 'in_progress' });
    const rawBody = personaEvent({
      name: 'inquiry.completed',
      createdAt: new Date(T0.getTime() + 30_000),
      status: 'completed'
    });
    const receivedAt = new Date(T0.getTime() + MINUTE);
    const [t, good] = sign({ rawBody, at: receivedAt }).split(',');

    await expect(
      verification.receiveWebhook({ rawBody, signatureHeader: `${t},${good},v1=${'0'.repeat(64)}`, receivedAt })
    ).resolves.toEqual({ ok: true, value: { outcome: 'applied' } });
  });

  it('reports a body that is not a Persona event as malformed', async () => {
    const { verification } = setup();
    const rawBody = '{"data":{"id":"evt_1"}}';

    await expect(
      verification.receiveWebhook({ rawBody, signatureHeader: sign({ rawBody, at: T0 }), receivedAt: T0 })
    ).resolves.toEqual({ ok: false, error: { code: 'malformed' } });
  });

  it('refuses an oversized body as oversized before looking at the signature', async () => {
    const { verification } = setup();
    const rawBody = '0'.repeat(1_000_001);

    await expect(verification.receiveWebhook({ rawBody, signatureHeader: null, receivedAt: T0 })).resolves.toEqual({
      ok: false,
      error: { code: 'oversized' }
    });
  });
});

describe('receiveWebhook — the Status Write Path', () => {
  const EVENT_TO_STATUS = [
    ['inquiry.completed', 'completed', 'submitted'],
    ['inquiry.marked-for-review', 'needs_review', 'pending_review'],
    ['inquiry.approved', 'approved', 'approved'],
    ['inquiry.declined', 'declined', 'declined'],
    ['inquiry.failed', 'failed', 'failed'],
    ['inquiry.expired', 'expired', 'expired']
  ] as const;

  it.each(EVENT_TO_STATUS)('%s moves the record to %s', async (name, personaStatus, expected) => {
    const { verification, seedRecord, store } = setup();
    seedRecord({ status: 'in_progress' });

    await expect(delivery({ verification, name, status: personaStatus })).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });

    const record = store.records.get(USER_ID);
    expect(record?.status).toBe(expected);
    expect(record?.statusChangedAt).toEqual(new Date(T0.getTime() + MINUTE));
  });

  it('answers an ops event with ops_alert, touching no status, and dedupes its replay', async () => {
    const { verification, seedRecord, store, outbox } = setup();
    seedRecord({ status: 'submitted' });
    const rawBody = JSON.stringify({
      data: {
        type: 'event',
        id: 'evt_wfr',
        attributes: {
          name: 'workflow-run.errored',
          'created-at': T0.toISOString(),
          payload: { data: { type: 'workflow-run', id: 'wfr_1', attributes: { status: 'errored' } } }
        }
      }
    });
    const receivedAt = new Date(T0.getTime() + MINUTE);
    const signatureHeader = sign({ rawBody, at: receivedAt });

    await expect(verification.receiveWebhook({ rawBody, signatureHeader, receivedAt })).resolves.toEqual({
      ok: true,
      value: { outcome: 'ops_alert', eventName: 'workflow-run.errored', resourceId: 'wfr_1', workflowId: null }
    });
    await expect(verification.receiveWebhook({ rawBody, signatureHeader, receivedAt })).resolves.toEqual({
      ok: true,
      value: { outcome: 'duplicate' }
    });
    expect(store.records.get(USER_ID)?.status).toBe('submitted');
    expect(outbox.notifications).toHaveLength(0);
  });

  it('ignores an event we do not subscribe to', async () => {
    const { verification, seedRecord, store } = setup();
    seedRecord({ status: 'in_progress' });

    await expect(delivery({ verification, name: 'inquiry.transitioned', status: 'pending' })).resolves.toEqual({
      ok: true,
      value: { outcome: 'ignored', reason: 'unsubscribed_event', eventName: 'inquiry.transitioned' }
    });
    expect(store.records.get(USER_ID)?.status).toBe('in_progress');
    expect(store.events.size).toBe(0);
  });

  it('ignores an inquiry status the mapping does not cover, naming the drift', async () => {
    const { verification, seedRecord, store } = setup();
    seedRecord({ status: 'in_progress' });

    await expect(delivery({ verification, name: 'inquiry.approved', status: 'quarantined' })).resolves.toEqual({
      ok: true,
      value: { outcome: 'ignored', reason: 'unmapped_status', eventName: 'inquiry.approved' }
    });
    expect(store.records.get(USER_ID)?.status).toBe('in_progress');
    expect(store.events.size).toBe(0);
  });

  it('answers a replayed event id with duplicate and neither writes nor enqueues again', async () => {
    const { verification, seedRecord, store, outbox } = setup();
    seedRecord({ status: 'submitted' });

    await delivery({ verification, name: 'inquiry.approved', status: 'approved', id: 'evt_once' });
    const approvedAt = store.records.get(USER_ID)?.lastSyncedAt;
    // Persona redelivers the same event, created-at and all.
    const replay = await delivery({ verification, name: 'inquiry.approved', status: 'approved', id: 'evt_once' });

    expect(replay).toEqual({ ok: true, value: { outcome: 'duplicate' } });
    expect(store.records.get(USER_ID)?.lastSyncedAt).toEqual(approvedAt);
    expect(outbox.notifications).toHaveLength(2);
  });

  it('does not regress on an out-of-order delivery (completed arriving after approved)', async () => {
    const { verification, seedRecord, store } = setup();
    seedRecord({ status: 'in_progress' });

    await delivery({ verification, name: 'inquiry.approved', status: 'approved', id: 'evt_a', minutesAfterT0: 10 });
    await delivery({ verification, name: 'inquiry.completed', status: 'completed', id: 'evt_b', minutesAfterT0: 5 });

    expect(store.records.get(USER_ID)?.status).toBe('approved');
  });

  it('never replaces a Decision with a non-Decision from the same inquiry, even a newer one', async () => {
    const { verification, seedRecord, store } = setup();
    seedRecord({ status: 'approved', statusChangedAt: T0 });

    await delivery({ verification, name: 'inquiry.expired', status: 'expired', minutesAfterT0: 60 });

    expect(store.records.get(USER_ID)?.status).toBe('approved');
  });

  it('answers unchanged, not applied, for an event older than the record', async () => {
    const { verification, seedRecord, store } = setup();
    seedRecord({ status: 'approved', statusChangedAt: new Date(T0.getTime() + 10 * MINUTE) });

    await expect(
      delivery({ verification, name: 'inquiry.completed', status: 'completed', minutesAfterT0: 5 })
    ).resolves.toEqual({
      ok: true,
      value: { outcome: 'unchanged' }
    });
    expect(store.records.get(USER_ID)?.status).toBe('approved');
  });

  it('ignores an event for an inquiry that is no longer the current one', async () => {
    const { verification, seedRecord, store } = setup();
    seedRecord({ status: 'in_progress', personaInquiryId: 'inq_retry' });

    const result = await delivery({
      verification,
      name: 'inquiry.approved',
      status: 'approved',
      inquiryId: 'inq_first_attempt'
    });

    expect(result).toEqual({
      ok: true,
      value: { outcome: 'ignored', reason: 'superseded_inquiry', eventName: 'inquiry.approved' }
    });
    expect(store.records.get(USER_ID)?.status).toBe('in_progress');
  });

  it('names a newer inquiry decided after the recorded decision, which only a resync adopts', async () => {
    const { verification, seedRecord, store } = setup();
    // Declined a minute before the follow-up inquiry (created at T0) existed.
    seedRecord({ status: 'declined', statusChangedAt: new Date(T0.getTime() - MINUTE) });

    const result = await delivery({
      verification,
      name: 'inquiry.approved',
      status: 'approved',
      inquiryId: 'inq_follow_up'
    });

    expect(result).toEqual({
      ok: true,
      value: {
        outcome: 'ignored',
        reason: 'unadopted_inquiry',
        eventName: 'inquiry.approved',
        userId: USER_ID,
        inquiryId: 'inq_follow_up'
      }
    });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'declined', personaInquiryId: 'inq_seeded' });
  });

  it.each(['manually_approved', 'revoked'] as const)(
    'leaves a human-owned %s untouched by any event',
    async (status) => {
      const { verification, seedRecord, store, outbox } = setup();
      seedRecord({ status });

      await delivery({ verification, name: 'inquiry.approved', status: 'approved', minutesAfterT0: 60 });
      await delivery({ verification, name: 'inquiry.declined', status: 'declined', id: 'evt_2', minutesAfterT0: 61 });

      expect(store.records.get(USER_ID)?.status).toBe(status);
      expect(outbox.notifications).toHaveLength(0);
    }
  );

  it('creates the record for a user who has none (inquiry made in the dashboard)', async () => {
    const { verification, store } = setup();

    await expect(
      delivery({ verification, name: 'inquiry.completed', status: 'completed', inquiryId: 'inq_dash' })
    ).resolves.toEqual({ ok: true, value: { outcome: 'applied' } });

    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'submitted',
      personaInquiryId: 'inq_dash',
      personaAccountId: 'act_seeded'
    });
  });

  it("ignores another template's inquiry, even under a user's reference id", async () => {
    const { verification, store, outbox } = setup();

    const result = await delivery({
      verification,
      name: 'inquiry.completed',
      status: 'completed',
      inquiryId: 'inq_follow_up',
      templateId: 'itmpl_follow_up'
    });

    expect(result).toEqual({
      ok: true,
      value: { outcome: 'ignored', reason: 'foreign_inquiry', eventName: 'inquiry.completed' }
    });
    expect(store.records.has(USER_ID)).toBe(false);
    expect(outbox.notifications).toHaveLength(0);
  });

  it('applies an event that names the investor template', async () => {
    const { verification, seedRecord, store } = setup();
    seedRecord({ status: 'submitted' });

    await delivery({ verification, name: 'inquiry.approved', status: 'approved', templateId: FAKE_TEMPLATE_ID });

    expect(store.records.get(USER_ID)?.status).toBe('approved');
  });

  it('ignores an inquiry that carries no reference id', async () => {
    const { verification, store } = setup();

    await expect(
      delivery({ verification, name: 'inquiry.approved', status: 'approved', referenceId: null })
    ).resolves.toEqual({
      ok: true,
      value: { outcome: 'ignored', reason: 'foreign_inquiry', eventName: 'inquiry.approved' }
    });
    expect(store.records.size).toBe(0);
  });

  it('ignores an inquiry for a user id the app no longer has, without enqueueing anything', async () => {
    const { verification, store, outbox } = setup();
    store.profiles.delete(USER_ID);

    await expect(delivery({ verification, name: 'inquiry.expired', status: 'expired' })).resolves.toEqual({
      ok: true,
      value: { outcome: 'ignored', reason: 'foreign_inquiry', eventName: 'inquiry.expired' }
    });
    expect(store.records.size).toBe(0);
    expect(outbox.notifications).toHaveLength(0);
  });

  it('ignores a reference id that is not a user id rather than failing on it', async () => {
    const { verification, store } = setup();

    await expect(
      delivery({ verification, name: 'inquiry.approved', status: 'approved', referenceId: 'dashboard-test-user' })
    ).resolves.toEqual({
      ok: true,
      value: { outcome: 'ignored', reason: 'foreign_inquiry', eventName: 'inquiry.approved' }
    });
    expect(store.records.size).toBe(0);
  });

  it('surfaces a store failure as store_failure so the caller can ask for a retry', async () => {
    const { verification, seedRecord, store } = setup();
    seedRecord({ status: 'in_progress' });
    store.failNextCall(new Error('connection reset'), 'write');

    const result = await delivery({ verification, name: 'inquiry.approved', status: 'approved' });

    expect(result).toMatchObject({ ok: false, error: { code: 'store_failure' } });
  });

  it('lets the retry of a delivery that failed mid-write apply it', async () => {
    const { verification, seedRecord, store, outbox } = setup();
    seedRecord({ status: 'submitted' });
    store.failNextCall(new Error('connection reset'), 'write');

    const failed = await delivery({ verification, name: 'inquiry.approved', status: 'approved', id: 'evt_retry' });
    const retried = await delivery({ verification, name: 'inquiry.approved', status: 'approved', id: 'evt_retry' });

    expect(failed).toMatchObject({ ok: false, error: { code: 'store_failure' } });
    expect(retried).toEqual({ ok: true, value: { outcome: 'applied' } });
    expect(store.records.get(USER_ID)?.status).toBe('approved');
    // Both attempts enqueued (email + operator ping each): the receivers skip
    // or dedupe by re-reading the record, and Resend keys the email send.
    expect(outbox.notifications.map((n) => `${n.kind}:${n.status}:${n.inquiryId}`)).toEqual([
      'status_email:approved:inq_seeded',
      'operator_message:approved:inq_seeded',
      'status_email:approved:inq_seeded',
      'operator_message:approved:inq_seeded'
    ]);
  });

  it('reports a queue failure as outbox_failure, distinct from the store', async () => {
    const { verification, seedRecord, store, outbox } = setup();
    seedRecord({ status: 'submitted' });
    outbox.failNextCall(new Error('qstash down'));

    const result = await delivery({ verification, name: 'inquiry.approved', status: 'approved' });

    expect(result).toMatchObject({ ok: false, error: { code: 'outbox_failure' } });
    expect(store.records.get(USER_ID)?.status).toBe('submitted');
    expect(store.events.size).toBe(0);
  });
});

describe('startVerification — a queue that refuses', () => {
  it('answers queue_unavailable, persists nothing, and lets the next start apply the transition', async () => {
    const { verification, store, outbox, persona, seedRecord } = setup();
    seedRecord({ status: 'in_progress' });
    persona.inquiries.set('inq_seeded', {
      id: 'inq_seeded',
      status: 'completed',
      referenceId: USER_ID,
      accountId: 'act_seeded',
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      createdAt: T0,
      updatedAt: new Date(T0.getTime() + MINUTE)
    });
    outbox.failNextCall(new Error('QStash 400'));

    await expect(verification.startVerification({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'queue_unavailable', cause: new Error('QStash 400') }
    });
    expect(store.records.get(USER_ID)?.status).toBe('in_progress');

    // The queue is back: the completion is applied and the policy answers.
    await expect(verification.startVerification({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'awaiting_decision' }
    });
    expect(store.records.get(USER_ID)?.status).toBe('submitted');
  });
});

describe('receiveWebhook — notifications', () => {
  const byKind = (notifications: Array<VerificationNotification>) => notifications.map((n) => `${n.kind}:${n.status}`);

  it.each([
    ['inquiry.approved', 'approved', ['status_email:approved', 'operator_message:approved']],
    ['inquiry.declined', 'declined', ['status_email:declined', 'operator_message:declined']],
    ['inquiry.marked-for-review', 'needs_review', ['status_email:pending_review', 'operator_message:pending_review']],
    ['inquiry.failed', 'failed', ['operator_message:failed']],
    ['inquiry.expired', 'expired', ['status_email:expired']],
    ['inquiry.completed', 'completed', ['operator_message:submitted']]
  ] as const)('%s enqueues %j', async (name, personaStatus, expected) => {
    const { verification, seedRecord, outbox } = setup();
    seedRecord({ status: 'in_progress' });

    await delivery({ verification, name, status: personaStatus });

    expect(byKind(outbox.notifications)).toEqual(expected);
    for (const notification of outbox.notifications) {
      expect(notification).toMatchObject({
        userId: USER_ID,
        inquiryId: 'inq_seeded',
        statusChangedAt: new Date(T0.getTime() + MINUTE)
      });
    }
  });

  it('enqueues nothing for a write that changes nothing', async () => {
    const { verification, seedRecord, outbox } = setup();
    seedRecord({ status: 'pending_review' });

    await delivery({ verification, name: 'inquiry.marked-for-review', status: 'needs_review' });

    expect(outbox.notifications).toHaveLength(0);
  });

  it('does not email an expiry for an inquiry the app never had a record of, but still records it', async () => {
    const { verification, store, outbox } = setup();

    await expect(
      delivery({ verification, name: 'inquiry.expired', status: 'expired', inquiryId: 'inq_dash' })
    ).resolves.toEqual({ ok: true, value: { outcome: 'applied' } });

    expect(store.records.get(USER_ID)).toMatchObject({ status: 'expired', personaInquiryId: 'inq_dash' });
    expect(outbox.notifications).toHaveLength(0);
  });
});

describe('startVerification', () => {
  it('creates a prefilled inquiry for a user without a record', async () => {
    const { verification, store, persona } = setup();

    const result = await verification.startVerification({ userId: USER_ID });

    expect(result).toEqual({ ok: true, value: { inquiryId: 'inq_1', sessionToken: 'session_inq_1_1' } });
    expect(persona.calls).toEqual([
      { method: 'listInquiries', input: { referenceId: USER_ID } },
      {
        method: 'createInquiry',
        input: {
          templateVersionId: FAKE_TEMPLATE_VERSION_ID,
          fields: {
            'name-first': 'Ada',
            'name-last': 'Lovelace',
            'email-address': 'ada@example.com',
            'address-country-code': 'GB'
          },
          referenceId: USER_ID,
          idempotencyKey: expect.any(String)
        }
      }
    ]);
    expect(store.records.get(USER_ID)).toEqual({
      userId: USER_ID,
      status: 'in_progress',
      personaInquiryId: 'inq_1',
      personaAccountId: `act_${USER_ID}`,
      personaCaseId: null,
      personaCaseStatus: null,
      sourceAt: T0,
      statusChangedAt: T0,
      lastSyncedAt: T0,
      version: 0
    });
  });

  it('sends a fresh Idempotency-Key on every start, so an answer Persona cached under one key is not replayed', async () => {
    const keyOf = (calls: ReturnType<typeof setup>['persona']['calls']) =>
      (calls.at(-1)?.input as { idempotencyKey?: string }).idempotencyKey;

    // Two identical starts — same user, same profile, no record either time,
    // the way a click after a Persona 5xx looks — must not share a key: Persona
    // answers a known key with what it answered the first time, failures included.
    // The adapter's own retry of one dropped connection is what reuses a key.
    const first = setup();
    await first.verification.startVerification({ userId: USER_ID });
    const second = setup();
    await second.verification.startVerification({ userId: USER_ID });

    expect(keyOf(first.persona.calls)).toMatch(/^[0-9a-f-]{36}$/);
    expect(keyOf(second.persona.calls)).toMatch(/^[0-9a-f-]{36}$/);
    expect(keyOf(second.persona.calls)).not.toBe(keyOf(first.persona.calls));
  });

  it('announces a handed-out session to operators, on create and on resume', async () => {
    const { verification, seedRecord, persona, outbox } = setup();

    await verification.startVerification({ userId: USER_ID });
    expect(outbox.notifications).toEqual([
      {
        kind: 'operator_message',
        status: 'in_progress',
        userId: USER_ID,
        inquiryId: 'inq_1',
        statusChangedAt: T0
      }
    ]);

    outbox.notifications.length = 0;
    seedRecord({ status: 'in_progress', personaInquiryId: 'inq_seeded' });
    // Newer than inq_1 above, so the pre-resume read keeps the record where it is.
    persona.inquiries.set('inq_seeded', {
      id: 'inq_seeded',
      status: 'pending',
      referenceId: USER_ID,
      accountId: 'act_seeded',
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      createdAt: new Date(T0.getTime() + MINUTE),
      updatedAt: new Date(T0.getTime() + MINUTE)
    });
    await verification.startVerification({ userId: USER_ID });
    expect(outbox.notifications.map((n) => `${n.kind}:${n.status}:${n.inquiryId}`)).toEqual([
      'operator_message:in_progress:inq_seeded'
    ]);
  });

  it('still starts when the operator ping cannot be enqueued', async () => {
    const { verification, store, outbox } = setup();
    outbox.failNextCall(new Error('qstash down'));

    const result = await verification.startVerification({ userId: USER_ID });

    expect(result).toMatchObject({ ok: true, value: { inquiryId: 'inq_1' } });
    expect(store.records.get(USER_ID)?.status).toBe('in_progress');
    expect(outbox.notifications).toHaveLength(0);
  });

  it('hands out the session within seconds when the operator ping hangs', async () => {
    const s = setup();
    // A queue that never answers — the QStash client has no deadline of its own.
    const verification = createVerification({
      store: s.store.store,
      statusEmails: s.emails.sender,
      operatorMessages: s.operator.messenger,
      persona: s.persona.persona,
      clock: s.clock.clock,
      outbox: { enqueue: () => new Promise<void>(() => undefined) },
      config: { webhookSecret: WEBHOOK_SECRET, flows: { individual: INDIVIDUAL_FLOW } }
    });

    vi.useFakeTimers();
    try {
      const started = verification.startVerification({ userId: USER_ID });
      await vi.advanceTimersByTimeAsync(5_000);

      expect(await started).toMatchObject({ ok: true, value: { inquiryId: 'inq_1' } });
      expect(s.store.records.get(USER_ID)?.status).toBe('in_progress');
    } finally {
      vi.useRealTimers();
    }
  });

  it('resumes an inquiry Persona already holds for a user the app has no record of', async () => {
    const { verification, store, persona, outbox } = setup();
    persona.inquiries.set('inq_orphan', {
      id: 'inq_orphan',
      status: 'pending',
      referenceId: USER_ID,
      accountId: 'act_orphan',
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      createdAt: T0,
      updatedAt: T0
    });

    const result = await verification.startVerification({ userId: USER_ID });

    expect(result).toMatchObject({ ok: true, value: { inquiryId: 'inq_orphan' } });
    expect(persona.calls.map((call) => call.method)).toEqual(['listInquiries', 'resumeInquiry']);
    expect(store.records.get(USER_ID)).toMatchObject({ personaInquiryId: 'inq_orphan' });
    // The adoption already announced the session; the resume does not announce it again.
    expect(outbox.notifications.map((n) => `${n.kind}:${n.status}`)).toEqual(['operator_message:in_progress']);
  });

  it('creates a fresh inquiry when Persona no longer lists the one the record points at', async () => {
    const { verification, store, persona, seedRecord } = setup();
    seedRecord({ status: 'in_progress', personaInquiryId: 'inq_retained_away' });

    const result = await verification.startVerification({ userId: USER_ID });

    expect(result).toMatchObject({ ok: true, value: { inquiryId: 'inq_1' } });
    expect(persona.calls.map((call) => call.method)).toEqual(['listInquiries', 'createInquiry']);
    expect(store.records.get(USER_ID)).toMatchObject({ personaInquiryId: 'inq_1' });
  });

  it('creates a fresh inquiry when Persona has redacted the one the record points at', async () => {
    const { verification, store, persona, seedRecord } = setup();
    seedRecord({ status: 'expired' });
    persona.inquiries.set('inq_seeded', {
      id: 'inq_seeded',
      status: 'expired',
      referenceId: USER_ID,
      accountId: 'act_seeded',
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      redacted: true,
      createdAt: T0,
      updatedAt: T0
    });

    const result = await verification.startVerification({ userId: USER_ID });

    expect(result).toMatchObject({ ok: true, value: { inquiryId: 'inq_1' } });
    expect(persona.calls.map((call) => call.method)).toEqual(['listInquiries', 'createInquiry']);
    expect(store.records.get(USER_ID)).toMatchObject({ personaInquiryId: 'inq_1' });
  });

  it('adopts a decided inquiry Persona holds for a user the app has no record of, then refuses', async () => {
    const { verification, store, persona, outbox } = setup();
    persona.inquiries.set('inq_done', {
      id: 'inq_done',
      status: 'completed',
      referenceId: USER_ID,
      accountId: 'act_done',
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      createdAt: T0,
      updatedAt: T0
    });

    await expect(verification.startVerification({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'awaiting_decision' }
    });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'submitted', personaInquiryId: 'inq_done' });
    // The adoption announces the discovered submission to operators; no email exists for it.
    expect(outbox.notifications.map((n) => `${n.kind}:${n.status}`)).toEqual(['operator_message:submitted']);
  });

  it('resumes an in-progress inquiry with a fresh session token', async () => {
    const { verification, store, persona, seedRecord } = setup();
    persona.inquiries.set('inq_seeded', {
      id: 'inq_seeded',
      status: 'pending',
      referenceId: USER_ID,
      accountId: 'act_seeded',
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      createdAt: T0,
      updatedAt: T0
    });
    seedRecord({ status: 'in_progress' });

    const result = await verification.startVerification({ userId: USER_ID });

    expect(result).toEqual({ ok: true, value: { inquiryId: 'inq_seeded', sessionToken: 'session_inq_seeded_1' } });
    // Always a fresh read first: a start never trusts the staleness gate.
    expect(persona.calls.map((call) => call.method)).toEqual(['listInquiries', 'resumeInquiry']);
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'in_progress', statusChangedAt: T0 });
  });

  it('creates a fresh inquiry instead of resuming one made on an older template version', async () => {
    const { verification, store, persona, seedRecord } = setup();
    persona.inquiries.set('inq_seeded', {
      id: 'inq_seeded',
      status: 'pending',
      referenceId: USER_ID,
      accountId: 'act_seeded',
      templateVersionId: 'itmplv_retired',
      createdAt: T0,
      updatedAt: T0
    });
    seedRecord({ status: 'in_progress' });

    const result = await verification.startVerification({ userId: USER_ID });

    expect(result).toMatchObject({ ok: true, value: { inquiryId: 'inq_1' } });
    expect(persona.calls.map((call) => call.method)).toEqual(['listInquiries', 'createInquiry']);
    expect(store.records.get(USER_ID)).toMatchObject({ personaInquiryId: 'inq_1' });
  });

  it('refuses a fresh in_progress record whose inquiry Persona has meanwhile completed, and moves it on', async () => {
    const { verification, store, persona, seedRecord, clock } = setup();
    persona.inquiries.set('inq_seeded', {
      id: 'inq_seeded',
      status: 'completed',
      referenceId: USER_ID,
      accountId: 'act_seeded',
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      createdAt: T0,
      updatedAt: new Date(T0.getTime() + 4 * MINUTE)
    });
    // Synced five minutes ago: well inside the staleness gate the page reads trust.
    seedRecord({ status: 'in_progress', statusChangedAt: T0, lastSyncedAt: T0 });
    clock.advance(5 * MINUTE);

    await expect(verification.startVerification({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'awaiting_decision' }
    });
    expect(persona.calls.map((call) => call.method)).toEqual(['listInquiries']);
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'submitted', personaInquiryId: 'inq_seeded' });
  });

  it('resumes an expired inquiry and moves the record back to in_progress', async () => {
    const { verification, store, persona, seedRecord, clock } = setup();
    persona.inquiries.set('inq_seeded', {
      id: 'inq_seeded',
      status: 'expired',
      referenceId: USER_ID,
      accountId: 'act_seeded',
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      createdAt: T0,
      updatedAt: T0
    });
    seedRecord({ status: 'expired' });
    clock.advance(60 * MINUTE);

    const result = await verification.startVerification({ userId: USER_ID });

    expect(result).toMatchObject({ ok: true, value: { inquiryId: 'inq_seeded' } });
    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'in_progress',
      statusChangedAt: new Date(T0.getTime() + 60 * MINUTE)
    });
    expect(persona.inquiries.get('inq_seeded')?.status).toBe('pending');
  });

  it("resumes an expired inquiry inside the expiry's own second — Persona answers in whole seconds", async () => {
    const s = setup();
    // Persona's updated-at carries whole seconds; the stored expiry carries the event's milliseconds.
    const verification = createVerification({
      store: s.store.store,
      statusEmails: s.emails.sender,
      operatorMessages: s.operator.messenger,
      persona: {
        ...s.persona.persona,
        async resumeInquiry(input) {
          const resumed = await s.persona.persona.resumeInquiry(input);
          if (!resumed.ok) return resumed;
          const updatedAt = new Date(Math.floor(resumed.value.inquiry.updatedAt.getTime() / 1000) * 1000);
          return { ...resumed, value: { ...resumed.value, inquiry: { ...resumed.value.inquiry, updatedAt } } };
        }
      },
      outbox: s.outbox.outbox,
      clock: s.clock.clock,
      config: { webhookSecret: WEBHOOK_SECRET, flows: { individual: INDIVIDUAL_FLOW } }
    });
    s.persona.inquiries.set('inq_seeded', {
      id: 'inq_seeded',
      status: 'expired',
      referenceId: USER_ID,
      accountId: 'act_seeded',
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      createdAt: T0,
      updatedAt: T0
    });
    const expiredAt = new Date(T0.getTime() + 10_598);
    s.seedRecord({ status: 'expired', statusChangedAt: expiredAt, lastSyncedAt: expiredAt });
    s.clock.set(new Date(T0.getTime() + 10_900));

    const result = await verification.startVerification({ userId: USER_ID });

    expect(result).toMatchObject({ ok: true, value: { inquiryId: 'inq_seeded' } });
    expect(s.store.records.get(USER_ID)).toMatchObject({
      status: 'in_progress',
      statusChangedAt: new Date(expiredAt.getTime() + 1)
    });
  });

  it.each([
    ['approved', 'already_verified'],
    ['manually_approved', 'already_verified'],
    ['declined', 'declined'],
    ['revoked', 'revoked']
  ] as const)('refuses from terminal %s with %s without asking Persona', async (status, code) => {
    const { verification, store, persona, seedRecord } = setup();
    const seeded = seedRecord({ status });

    await expect(verification.startVerification({ userId: USER_ID })).resolves.toEqual({ ok: false, error: { code } });
    expect(persona.calls).toHaveLength(0);
    expect(store.records.get(USER_ID)).toEqual(seeded);
  });

  it.each([
    ['submitted', 'completed'],
    ['pending_review', 'needs_review'],
    ['failed', 'failed']
  ] as const)('refuses from %s only after re-reading Persona, which still says %s', async (status, personaStatus) => {
    const { verification, store, persona, seedRecord } = setup();
    persona.inquiries.set('inq_seeded', {
      id: 'inq_seeded',
      status: personaStatus,
      referenceId: USER_ID,
      accountId: 'act_seeded',
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      createdAt: T0,
      updatedAt: T0
    });
    const seeded = seedRecord({ status });

    await expect(verification.startVerification({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'awaiting_decision' }
    });
    expect(persona.calls.map((call) => call.method)).toEqual(['listInquiries']);
    expect(store.records.get(USER_ID)).toEqual(seeded);
  });

  it('refuses from failed once Persona has decided it, and moves the record on to the decision', async () => {
    const { verification, store, persona, seedRecord } = setup();
    // The Inquiry Failed Workflow marked the inquiry for review seconds after
    // the failure and the webhook for it was lost: the start is where it shows.
    persona.inquiries.set('inq_seeded', {
      id: 'inq_seeded',
      status: 'needs_review',
      referenceId: USER_ID,
      accountId: 'act_seeded',
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      createdAt: T0,
      updatedAt: new Date(T0.getTime() + MINUTE)
    });
    seedRecord({ status: 'failed' });

    await expect(verification.startVerification({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'awaiting_decision' }
    });
    expect(persona.calls.map((call) => call.method)).toEqual(['listInquiries']);
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'pending_review', personaInquiryId: 'inq_seeded' });
  });

  it('refuses organization accounts before consulting the status while their flow is not configured', async () => {
    const { verification, store, persona } = setup();
    store.profiles.set(USER_ID, { ...INDIVIDUAL_PROFILE, accountType: 'organization' });

    await expect(verification.startVerification({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'organization' }
    });
    expect(persona.calls).toHaveLength(0);
    expect(store.records.size).toBe(0);
  });

  it('refuses a user who has not completed onboarding', async () => {
    const { verification, store } = setup();
    store.profiles.delete(USER_ID);

    await expect(verification.startVerification({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'profile_missing' }
    });
  });

  it('surfaces a Persona failure as persona_unavailable and creates no record', async () => {
    const { verification, store, persona } = setup();
    persona.failNextCall({ reason: 'http', message: 'Bad Gateway', httpStatus: 502 });

    await expect(verification.startVerification({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'persona_unavailable', cause: { reason: 'http', message: 'Bad Gateway', httpStatus: 502 } }
    });
    expect(store.records.size).toBe(0);
  });
});

describe('reconcile', () => {
  const HOUR = 60 * MINUTE;

  /** A record whose inquiry the fake Persona knows about, last synced `staleMinutes` ago. */
  function seedSynced({
    setup: s,
    userId,
    status,
    personaStatus,
    staleMinutes,
    changedHoursAgo = 0
  }: {
    setup: ReturnType<typeof setup>;
    userId: string;
    status: VerificationStatus;
    personaStatus: Parameters<typeof s.persona.setInquiryStatus>[0]['status'];
    staleMinutes: number;
    changedHoursAgo?: number;
  }) {
    const now = s.clock.clock.now();
    const inquiryId = `inq_${userId}`;
    s.persona.inquiries.set(inquiryId, {
      id: inquiryId,
      status: personaStatus,
      referenceId: userId,
      accountId: `act_${userId}`,
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      createdAt: new Date(now.getTime() - 2 * HOUR),
      updatedAt: new Date(now.getTime() - MINUTE)
    });
    s.store.records.set(userId, {
      userId,
      status,
      personaInquiryId: inquiryId,
      personaAccountId: `act_${userId}`,
      personaCaseId: null,
      personaCaseStatus: null,
      sourceAt: new Date(now.getTime() - changedHoursAgo * HOUR - 2 * MINUTE),
      statusChangedAt: new Date(now.getTime() - changedHoursAgo * HOUR - 2 * MINUTE),
      lastSyncedAt: new Date(now.getTime() - staleMinutes * MINUTE)
    });
  }

  it('corrects a stale submitted record whose inquiry is now approved and emails the approval', async () => {
    const s = setup();
    seedSynced({
      setup: s,
      userId: 'u-lost-webhook',
      status: 'submitted',
      personaStatus: 'approved',
      staleMinutes: 45
    });

    const report = await s.verification.reconcile({ now: T0 });

    expect(report).toEqual({
      checked: 1,
      changed: 1,
      unavailable: 0,
      errored: 0,
      undecided: 0,
      awaitingReview: 0,
      awaitingOwners: 0
    });
    expect(s.store.records.get('u-lost-webhook')).toMatchObject({ status: 'approved', lastSyncedAt: T0 });
    expect(s.outbox.notifications).toEqual([
      {
        kind: 'status_email',
        userId: 'u-lost-webhook',
        inquiryId: 'inq_u-lost-webhook',
        status: 'approved',
        statusChangedAt: new Date(T0.getTime() - MINUTE)
      },
      {
        kind: 'operator_message',
        userId: 'u-lost-webhook',
        inquiryId: 'inq_u-lost-webhook',
        status: 'approved',
        statusChangedAt: new Date(T0.getTime() - MINUTE)
      }
    ]);
  });

  it('ignores a list answered before a concurrent start replaced the inquiry it describes', async () => {
    const s = setup();
    // The user's inquiry sits on an older template version, so their next
    // start creates a fresh one instead of resuming it.
    seedSynced({ setup: s, userId: USER_ID, status: 'in_progress', personaStatus: 'pending', staleMinutes: 45 });
    s.persona.inquiries.get(`inq_${USER_ID}`)!.templateVersionId = 'itmplv_previous';

    const gate = () => {
      let open!: () => void;
      const opened = new Promise<void>((resolve) => {
        open = resolve;
      });
      return { opened, open };
    };
    const sweepRead = gate();
    const startLanded = gate();
    let sweepAnswered = false;
    // The sweep's list answer is held until the start has persisted its replacement.
    const verification = createVerification({
      store: s.store.store,
      statusEmails: s.emails.sender,
      operatorMessages: s.operator.messenger,
      persona: {
        ...s.persona.persona,
        async listInquiries(input) {
          const snapshot = await s.persona.persona.listInquiries(input);
          if (!sweepAnswered) {
            sweepAnswered = true;
            sweepRead.open();
            await startLanded.opened;
          }
          return snapshot;
        }
      },
      outbox: s.outbox.outbox,
      clock: s.clock.clock,
      config: { webhookSecret: WEBHOOK_SECRET, flows: { individual: INDIVIDUAL_FLOW } }
    });

    const sweep = verification.reconcile({ now: T0 });
    await sweepRead.opened;
    const started = await verification.startVerification({ userId: USER_ID });
    expect(started).toMatchObject({ ok: true, value: { inquiryId: 'inq_1' } });
    startLanded.open();
    const report = await sweep;

    // The stale answer neither re-pointed nor confirmed the record; the replacement's own events apply.
    expect(report).toMatchObject({ checked: 1, changed: 0 });
    expect(s.store.records.get(USER_ID)).toMatchObject({
      status: 'in_progress',
      personaInquiryId: 'inq_1'
    });
    await expect(
      delivery({ verification, name: 'inquiry.approved', status: 'approved', inquiryId: 'inq_1' })
    ).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });
    expect(s.store.records.get(USER_ID)).toMatchObject({ status: 'approved', personaInquiryId: 'inq_1' });
  });

  it("refuses an old inquiry's event that read the record before a concurrent start replaced it", async () => {
    const s = setup();
    // Same footing as above: the next start creates instead of resuming.
    seedSynced({ setup: s, userId: USER_ID, status: 'in_progress', personaStatus: 'pending', staleMinutes: 45 });
    const oldInquiryId = `inq_${USER_ID}`;
    s.persona.inquiries.get(oldInquiryId)!.templateVersionId = 'itmplv_previous';

    const gate = () => {
      let open!: () => void;
      const opened = new Promise<void>((resolve) => {
        open = resolve;
      });
      return { opened, open };
    };
    const created = gate();
    const startLanded = gate();
    const eventEnqueued = gate();
    const startReturned = gate();
    // The start is held after Persona made the replacement, before the record
    // is written; the old inquiry's approval reads the record in that window
    // and is held in turn, after its guards, until the start has landed.
    const verification = createVerification({
      store: s.store.store,
      statusEmails: s.emails.sender,
      operatorMessages: s.operator.messenger,
      persona: {
        ...s.persona.persona,
        async createInquiry(input) {
          const session = await s.persona.persona.createInquiry(input);
          created.open();
          await startLanded.opened;
          return session;
        }
      },
      outbox: {
        async enqueue(notification) {
          // The approval's first job (its email); the operator message that follows finds the gates open.
          if (notification.kind === 'status_email' && notification.inquiryId === oldInquiryId) {
            eventEnqueued.open();
            await startReturned.opened;
          }
          await s.outbox.outbox.enqueue(notification);
        }
      },
      clock: s.clock.clock,
      config: { webhookSecret: WEBHOOK_SECRET, flows: { individual: INDIVIDUAL_FLOW } }
    });

    const start = verification.startVerification({ userId: USER_ID });
    await created.opened;
    const lateApproval = delivery({
      verification,
      name: 'inquiry.approved',
      status: 'approved',
      inquiryId: oldInquiryId
    });
    await eventEnqueued.opened;
    startLanded.open();
    await expect(start).resolves.toMatchObject({ ok: true, value: { inquiryId: 'inq_1' } });
    startReturned.open();

    // Its stamp is the later one, so only its write can lose — and does: deciding again on the present, it finds the inquiry replaced.
    await expect(lateApproval).resolves.toEqual({
      ok: true,
      value: { outcome: 'ignored', reason: 'superseded_inquiry', eventName: 'inquiry.approved' }
    });
    expect(s.store.records.get(USER_ID)).toMatchObject({
      status: 'in_progress',
      personaInquiryId: 'inq_1'
    });
    // The replacement's own decision is the one that lands.
    await expect(
      delivery({
        verification,
        name: 'inquiry.declined',
        status: 'declined',
        inquiryId: 'inq_1',
        id: 'evt_2',
        minutesAfterT0: 2
      })
    ).resolves.toEqual({ ok: true, value: { outcome: 'applied' } });
    expect(s.store.records.get(USER_ID)).toMatchObject({ status: 'declined', personaInquiryId: 'inq_1' });
  });

  it('re-reads a stale failed record and applies the Workflow decision whose webhook was lost', async () => {
    const s = setup();
    seedSynced({ setup: s, userId: 'u-failed', status: 'failed', personaStatus: 'needs_review', staleMinutes: 45 });

    const report = await s.verification.reconcile({ now: T0 });

    expect(report).toEqual({
      checked: 1,
      changed: 1,
      unavailable: 0,
      errored: 0,
      undecided: 0,
      awaitingReview: 0,
      awaitingOwners: 0
    });
    expect(s.store.records.get('u-failed')).toMatchObject({ status: 'pending_review', lastSyncedAt: T0 });
    expect(s.outbox.notifications.map((n) => `${n.kind}:${n.status}`)).toEqual([
      'status_email:pending_review',
      'operator_message:pending_review'
    ]);
  });

  it("never adopts another template's newer inquiry, so the review's decision still lands", async () => {
    const s = setup();
    seedSynced({
      setup: s,
      userId: USER_ID,
      status: 'pending_review',
      personaStatus: 'needs_review',
      staleMinutes: 7 * 60
    });
    // A reviewer's follow-up on the same Persona account: newer, same reference id, another template.
    s.persona.inquiries.set('inq_follow_up', {
      id: 'inq_follow_up',
      status: 'created',
      referenceId: USER_ID,
      accountId: `act_${USER_ID}`,
      templateId: 'itmpl_follow_up',
      templateVersionId: 'itmplv_follow_up',
      createdAt: new Date(T0.getTime() - MINUTE),
      updatedAt: new Date(T0.getTime() - MINUTE)
    });

    const report = await s.verification.reconcile({ now: T0 });

    expect(report).toMatchObject({ checked: 1, changed: 0 });
    expect(s.store.records.get(USER_ID)).toMatchObject({
      status: 'pending_review',
      personaInquiryId: `inq_${USER_ID}`
    });

    await delivery({
      verification: s.verification,
      name: 'inquiry.approved',
      status: 'approved',
      inquiryId: `inq_${USER_ID}`
    });
    expect(s.store.records.get(USER_ID)?.status).toBe('approved');
  });

  it('adopts a newer inquiry Persona holds for the user and confirms the record either way', async () => {
    const s = setup();
    seedSynced({ setup: s, userId: 'u-retried', status: 'in_progress', personaStatus: 'pending', staleMinutes: 45 });
    s.persona.inquiries.set('inq_newer', {
      id: 'inq_newer',
      status: 'approved',
      referenceId: 'u-retried',
      accountId: 'act_u-retried',
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      createdAt: new Date(T0.getTime() - 5 * MINUTE),
      updatedAt: new Date(T0.getTime() - MINUTE)
    });

    const first = await s.verification.reconcile({ now: T0 });
    const second = await s.verification.reconcile({ now: T0 });

    expect(first).toEqual({
      checked: 1,
      changed: 1,
      unavailable: 0,
      errored: 0,
      undecided: 0,
      awaitingReview: 0,
      awaitingOwners: 0
    });
    expect(s.store.records.get('u-retried')).toMatchObject({
      status: 'approved',
      personaInquiryId: 'inq_newer',
      lastSyncedAt: T0
    });
    // Confirmed, so it is not re-read on the very next sweep.
    expect(second).toEqual({
      checked: 0,
      changed: 0,
      unavailable: 0,
      errored: 0,
      undecided: 0,
      awaitingReview: 0,
      awaitingOwners: 0
    });
  });

  it('confirms a human-owned record it re-read rather than re-reading it forever', async () => {
    const s = setup();
    seedSynced({
      setup: s,
      userId: 'u-manual',
      status: 'manually_approved',
      personaStatus: 'declined',
      staleMinutes: 600
    });
    // Human-owned is terminal for the sweep; a stale page read is what reaches the guard.
    s.store.records.set('u-manual', { ...s.store.records.get('u-manual')!, status: 'submitted' });
    s.persona.setInquiryStatus({ inquiryId: 'inq_u-manual', status: 'completed', at: new Date(T0.getTime() - MINUTE) });

    await s.verification.reconcile({ now: T0 });

    expect(s.store.records.get('u-manual')).toMatchObject({ status: 'submitted', lastSyncedAt: T0 });
  });

  it('stops re-reading when the budget is spent and drains the rest next sweep', async () => {
    const s = setup();
    const verification = createVerification({
      store: s.store.store,
      statusEmails: s.emails.sender,
      operatorMessages: s.operator.messenger,
      persona: s.persona.persona,
      outbox: s.outbox.outbox,
      clock: { now: () => s.clock.clock.now() },
      config: { webhookSecret: WEBHOOK_SECRET, flows: { individual: INDIVIDUAL_FLOW }, reconcileBudgetMs: 0 }
    });
    for (const userId of ['u-1', 'u-2', 'u-3', 'u-4', 'u-5', 'u-6']) {
      seedSynced({ setup: s, userId, status: 'submitted', personaStatus: 'approved', staleMinutes: 45 });
    }
    s.clock.advance(1);

    const report = await verification.reconcile({ now: T0 });

    // One batch of concurrent reads went out before the clock check cut the pass short.
    expect(report).toEqual({
      checked: 5,
      changed: 5,
      unavailable: 0,
      errored: 0,
      undecided: 0,
      awaitingReview: 0,
      awaitingOwners: 0
    });
  });

  it('drops an abandoned flow from the batch a day on, but keeps re-reading one that waits on Persona', async () => {
    const s = setup();
    // Same age, same staleness — only who they are waiting on differs.
    seedSynced({
      setup: s,
      userId: 'u-walked-away',
      status: 'expired',
      personaStatus: 'expired',
      staleMinutes: 45,
      changedHoursAgo: 30
    });
    seedSynced({
      setup: s,
      userId: 'u-awaiting-decision',
      status: 'submitted',
      personaStatus: 'approved',
      staleMinutes: 45,
      changedHoursAgo: 30
    });

    const report = await s.verification.reconcile({ now: T0 });

    expect(report).toMatchObject({ checked: 1, changed: 1 });
    expect(s.persona.calls.map((call) => call.input)).toEqual([{ referenceId: 'u-awaiting-decision' }]);
    expect(s.store.records.get('u-awaiting-decision')?.status).toBe('approved');
    // Untouched, and served by the next start if they ever come back.
    expect(s.store.records.get('u-walked-away')?.lastSyncedAt).toEqual(new Date(T0.getTime() - 45 * MINUTE));
  });

  it('re-reads a review every hour for 90 days, not every sweep for seven', async () => {
    const s = setup();
    const review = { status: 'pending_review', personaStatus: 'needs_review' } as const;
    seedSynced({ setup: s, userId: 'u-read-recently', ...review, staleMinutes: 45, changedHoursAgo: 24 * 20 });
    seedSynced({ setup: s, userId: 'u-due', ...review, staleMinutes: 61, changedHoursAgo: 24 * 80 });
    seedSynced({ setup: s, userId: 'u-forgotten', ...review, staleMinutes: 61, changedHoursAgo: 24 * 100 });

    const report = await s.verification.reconcile({ now: T0 });

    expect(report).toMatchObject({ checked: 1, changed: 0 });
    expect(s.persona.calls.map((call) => call.input)).toEqual([{ referenceId: 'u-due' }]);
  });

  it('leaves flows abandoned beyond the horizon to the next start, and forgets events past it', async () => {
    const s = setup();
    seedSynced({
      setup: s,
      userId: 'u-old',
      status: 'expired',
      personaStatus: 'expired',
      staleMinutes: 45,
      changedHoursAgo: 24 * 8
    });
    s.store.events.set('evt_old', new Date(T0.getTime() - 8 * 24 * HOUR));
    s.store.events.set('evt_recent', new Date(T0.getTime() - HOUR));

    const report = await s.verification.reconcile({ now: T0 });

    expect(report).toEqual({
      checked: 0,
      changed: 0,
      unavailable: 0,
      errored: 0,
      undecided: 0,
      awaitingReview: 0,
      awaitingOwners: 0
    });
    expect([...s.store.events.keys()]).toEqual(['evt_recent']);
  });

  it('is idempotent: a sweep that finds nothing changed writes no status and sends nothing, twice', async () => {
    const s = setup();
    seedSynced({
      setup: s,
      userId: 'u-still-pending',
      status: 'submitted',
      personaStatus: 'completed',
      staleMinutes: 45
    });
    const before = s.store.records.get('u-still-pending');

    const first = await s.verification.reconcile({ now: T0 });
    const afterFirst = s.store.records.get('u-still-pending');
    const second = await s.verification.reconcile({ now: T0 });

    expect(first).toEqual({
      checked: 1,
      changed: 0,
      unavailable: 0,
      errored: 0,
      undecided: 0,
      awaitingReview: 0,
      awaitingOwners: 0
    });
    // Confirmed against Persona (lastSyncedAt moves), but nothing about the status moved.
    expect(afterFirst).toEqual({ ...before, lastSyncedAt: T0 });
    expect(second).toEqual({
      checked: 0,
      changed: 0,
      unavailable: 0,
      errored: 0,
      undecided: 0,
      awaitingReview: 0,
      awaitingOwners: 0
    });
    expect(s.store.records.get('u-still-pending')).toEqual(afterFirst);
    expect(s.outbox.notifications).toHaveLength(0);
  });

  it('never fetches Human-owned or freshly synced records, and a Decision only on its cadence', async () => {
    const s = setup();
    seedSynced({ setup: s, userId: 'u-approved', status: 'approved', personaStatus: 'approved', staleMinutes: 300 });
    seedSynced({ setup: s, userId: 'u-declined', status: 'declined', personaStatus: 'declined', staleMinutes: 600 });
    seedSynced({
      setup: s,
      userId: 'u-manual',
      status: 'manually_approved',
      personaStatus: 'declined',
      staleMinutes: 600
    });
    seedSynced({ setup: s, userId: 'u-fresh', status: 'in_progress', personaStatus: 'approved', staleMinutes: 5 });

    const report = await s.verification.reconcile({ now: T0 });

    expect(report).toMatchObject({ checked: 1, changed: 0 });
    expect(s.persona.calls.map((call) => call.input)).toEqual([{ referenceId: 'u-declined' }]);
    expect(s.store.records.get('u-declined')).toMatchObject({ status: 'declined', lastSyncedAt: T0 });
  });

  describe('a Decision', () => {
    /** Persona's own inquiry for the seeded record, as a reviewer last left it. */
    const personaHolds = ({
      s,
      status,
      minutesAfterT0,
      id = 'inq_seeded'
    }: {
      s: ReturnType<typeof setup>;
      status: 'approved' | 'declined';
      minutesAfterT0: number;
      id?: string;
    }) =>
      s.persona.inquiries.set(id, {
        id,
        status,
        referenceId: USER_ID,
        accountId: 'act_seeded',
        templateVersionId: FAKE_TEMPLATE_VERSION_ID,
        // The record's own inquiry is the older one; a follow-up is made when it is decided.
        createdAt:
          id === 'inq_seeded'
            ? new Date(T0.getTime() - 24 * 60 * MINUTE)
            : new Date(T0.getTime() + minutesAfterT0 * MINUTE),
        updatedAt: new Date(T0.getTime() + minutesAfterT0 * MINUTE)
      });
    const sevenHoursAgo = new Date(T0.getTime() - 7 * 60 * MINUTE);

    it('is re-read on the decision cadence, so a reversal whose webhook was lost still lands', async () => {
      const s = setup();
      s.seedRecord({ status: 'approved', statusChangedAt: sevenHoursAgo, lastSyncedAt: sevenHoursAgo });
      // A reviewer declined the approved inquiry in the dashboard; the webhook never came.
      personaHolds({ s, status: 'declined', minutesAfterT0: -30 });

      expect(await s.verification.reconcile({ now: T0 })).toMatchObject({ checked: 1, changed: 1 });
      expect(s.store.records.get(USER_ID)).toMatchObject({ status: 'declined', personaInquiryId: 'inq_seeded' });
      expect(s.outbox.notifications.map((job) => `${job.kind}:${job.status}`)).toEqual([
        'status_email:declined',
        'operator_message:declined'
      ]);
      expect(s.approvalsEnded).toEqual([USER_ID]);

      // Confirmed now, so it waits the cadence out.
      s.clock.advance(5 * 60 * MINUTE);
      expect(await s.verification.reconcile({ now: s.clock.clock.now() })).toMatchObject({ checked: 0 });
    });

    it("stays on its own inquiry when a reviewer's newer follow-up is decided", async () => {
      const s = setup();
      s.seedRecord({ status: 'approved', statusChangedAt: sevenHoursAgo, lastSyncedAt: sevenHoursAgo });
      personaHolds({ s, status: 'approved', minutesAfterT0: -7 * 60 });
      personaHolds({ s, status: 'declined', minutesAfterT0: -60, id: 'inq_follow_up' });

      expect(await s.verification.reconcile({ now: T0 })).toMatchObject({ checked: 1, changed: 0 });
      expect(s.store.records.get(USER_ID)).toMatchObject({
        status: 'approved',
        personaInquiryId: 'inq_seeded',
        lastSyncedAt: T0
      });
      expect(s.outbox.notifications).toHaveLength(0);
      expect(s.approvalsEnded).toHaveLength(0);
    });

    it('keeps out a delayed event from before a reversal the read already saw undone', async () => {
      const s = setup();
      s.seedRecord({ status: 'approved', statusChangedAt: sevenHoursAgo, lastSyncedAt: sevenHoursAgo });
      // Declined at -2 h, approved again at -1 h; neither webhook has arrived.
      personaHolds({ s, status: 'approved', minutesAfterT0: -60 });

      expect(await s.verification.reconcile({ now: T0 })).toMatchObject({ checked: 1, changed: 0 });
      expect(s.store.records.get(USER_ID)?.sourceAt).toEqual(new Date(T0.getTime() - 60 * MINUTE));

      // The decline's delivery, retried late, is older than what the read confirmed.
      await expect(
        delivery({ verification: s.verification, name: 'inquiry.declined', status: 'declined', minutesAfterT0: -120 })
      ).resolves.toEqual({ ok: true, value: { outcome: 'unchanged' } });
      expect(s.store.records.get(USER_ID)?.status).toBe('approved');
      expect(s.outbox.notifications).toHaveLength(0);
    });

    it('goes after every record waiting on someone, and only so many per sweep', async () => {
      const s = setup();
      for (let index = 0; index < 60; index += 1) {
        seedSynced({
          setup: s,
          userId: `u-decided-${index}`,
          status: 'approved',
          personaStatus: 'approved',
          staleMinutes: 24 * 60
        });
      }
      seedSynced({
        setup: s,
        userId: 'u-submitted',
        status: 'submitted',
        personaStatus: 'completed',
        staleMinutes: 45
      });

      const report = await s.verification.reconcile({ now: T0 });

      expect(report).toMatchObject({ checked: 51 });
      expect(s.persona.calls[0]?.input).toEqual({ referenceId: 'u-submitted' });
    });
  });

  it('separates an undecided submission or failure from a review a human has not got to', async () => {
    const s = setup();
    seedSynced({
      setup: s,
      userId: 'u-no-workflow',
      status: 'submitted',
      personaStatus: 'completed',
      staleMinutes: 45,
      changedHoursAgo: 25
    });
    seedSynced({
      setup: s,
      userId: 'u-slow-review',
      status: 'pending_review',
      personaStatus: 'needs_review',
      staleMinutes: 5,
      changedHoursAgo: 30
    });
    seedSynced({
      setup: s,
      userId: 'u-abandoned',
      status: 'expired',
      personaStatus: 'expired',
      staleMinutes: 45,
      changedHoursAgo: 72
    });
    seedSynced({
      setup: s,
      userId: 'u-recent',
      status: 'submitted',
      personaStatus: 'completed',
      staleMinutes: 45,
      changedHoursAgo: 0
    });
    // A failure the Inquiry Failed Workflow never decided: undecided, like a submission.
    seedSynced({
      setup: s,
      userId: 'u-no-failed-workflow',
      status: 'failed',
      personaStatus: 'failed',
      staleMinutes: 45,
      changedHoursAgo: 25
    });

    const report = await s.verification.reconcile({ now: T0 });

    // The freshly synced pending_review row is not re-read but still counts;
    // the abandoned (expired) row is past its own horizon and is not re-read
    // at all; `u-recent` submitted moments ago, inside the decision threshold.
    expect(report).toEqual({
      checked: 3,
      changed: 0,
      unavailable: 0,
      errored: 0,
      undecided: 2,
      awaitingReview: 1,
      awaitingOwners: 0
    });
  });

  it('applies a transition Persona made inside the same second as the last event', async () => {
    // Event timestamps carry milliseconds, a fetched inquiry's updated-at only
    // seconds: the lost approval at :01.000 must not read as older than the
    // completion event at :01.598.
    const { verification, seedRecord, store, persona, clock } = setup();
    seedRecord({ status: 'in_progress' });
    persona.inquiries.set('inq_seeded', {
      id: 'inq_seeded',
      status: 'pending',
      referenceId: USER_ID,
      accountId: 'act_seeded',
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      createdAt: T0,
      updatedAt: T0
    });
    const completedAt = new Date(T0.getTime() + MINUTE + 598);
    const rawBody = personaEvent({ name: 'inquiry.completed', createdAt: completedAt, status: 'completed' });
    await verification.receiveWebhook({
      rawBody,
      signatureHeader: sign({ rawBody, at: completedAt }),
      receivedAt: completedAt
    });
    persona.setInquiryStatus({ inquiryId: 'inq_seeded', status: 'approved', at: new Date(T0.getTime() + MINUTE) });
    clock.advance(45 * MINUTE);

    const report = await verification.reconcile({ now: clock.clock.now() });

    expect(report).toMatchObject({ checked: 1, changed: 1 });
    // One millisecond after the event it followed: never equal, so the receivers can order them.
    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'approved',
      statusChangedAt: new Date(completedAt.getTime() + 1)
    });
  });

  it('still refuses a fetch that is a full second behind the last event', async () => {
    const { verification, seedRecord, store, persona, clock } = setup();
    seedRecord({ status: 'submitted', statusChangedAt: new Date(T0.getTime() + 61_000) });
    persona.inquiries.set('inq_seeded', {
      id: 'inq_seeded',
      status: 'pending',
      referenceId: USER_ID,
      accountId: 'act_seeded',
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      createdAt: T0,
      updatedAt: new Date(T0.getTime() + 60_000)
    });
    clock.advance(45 * MINUTE);

    const report = await verification.reconcile({ now: clock.clock.now() });

    expect(report).toMatchObject({ checked: 1, changed: 0 });
    expect(store.records.get(USER_ID)?.status).toBe('submitted');
  });

  it('leaves a record alone when the newest inquiry carries a status the mapping does not cover', async () => {
    // Adopting the previous (readable) inquiry instead would re-point the
    // record backwards for a status Persona just added.
    const s = setup();
    seedSynced({ setup: s, userId: 'u-new-status', status: 'submitted', personaStatus: 'completed', staleMinutes: 45 });
    s.persona.inquiries.set('inq_unknown', {
      id: 'inq_unknown',
      status: null,
      referenceId: 'u-new-status',
      accountId: 'act_u-new-status',
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      createdAt: new Date(T0.getTime() - MINUTE),
      updatedAt: new Date(T0.getTime() - MINUTE)
    });
    const before = s.store.records.get('u-new-status');

    const report = await s.verification.reconcile({ now: T0 });

    expect(report).toMatchObject({ checked: 1, changed: 0, unavailable: 1 });
    // Confirmed (so it is re-read on the cadence, not every sweep), nothing else touched.
    expect(s.store.records.get('u-new-status')).toEqual({ ...before, lastSyncedAt: T0 });
  });

  it('leaves a record alone when Persona is unavailable and retries it next sweep', async () => {
    const s = setup();
    seedSynced({ setup: s, userId: 'u-outage', status: 'submitted', personaStatus: 'approved', staleMinutes: 45 });
    const before = s.store.records.get('u-outage');
    s.persona.failNextCall({ reason: 'network', message: 'ECONNRESET' });

    const first = await s.verification.reconcile({ now: T0 });
    const afterOutage = s.store.records.get('u-outage');
    const second = await s.verification.reconcile({ now: T0 });

    expect(first).toEqual({
      checked: 1,
      changed: 0,
      unavailable: 1,
      errored: 0,
      unavailableCause: { reason: 'network', message: 'ECONNRESET' },
      undecided: 0,
      awaitingReview: 0,
      awaitingOwners: 0
    });
    expect(afterOutage).toEqual(before);
    expect(second).toEqual({
      checked: 1,
      changed: 1,
      unavailable: 0,
      errored: 0,
      undecided: 0,
      awaitingReview: 0,
      awaitingOwners: 0
    });
  });
});

describe('reconcile — one record failing on this side', () => {
  it('counts the record as errored and still re-reads the rest of the batch', async () => {
    const s = setup();
    const stale = new Date(T0.getTime() - 45 * MINUTE);
    for (const userId of ['u-first', 'u-second']) {
      s.store.profiles.set(userId, INDIVIDUAL_PROFILE);
      s.persona.inquiries.set(`inq_${userId}`, {
        id: `inq_${userId}`,
        status: 'approved',
        referenceId: userId,
        accountId: `act_${userId}`,
        templateVersionId: FAKE_TEMPLATE_VERSION_ID,
        createdAt: stale,
        updatedAt: new Date(T0.getTime() - MINUTE)
      });
      s.seedRecord({
        userId,
        status: 'submitted',
        personaInquiryId: `inq_${userId}`,
        statusChangedAt: stale,
        lastSyncedAt: stale
      });
    }
    s.store.failNextCall(new Error('connection reset'), 'write');

    const report = await s.verification.reconcile({ now: T0 });

    expect(report).toMatchObject({ checked: 2, changed: 1, errored: 1, unavailable: 0 });
    expect(report.erroredCause).toEqual(new Error('connection reset'));
    const statuses = ['u-first', 'u-second'].map((userId) => s.store.records.get(userId)?.status).sort();
    expect(statuses).toEqual(['approved', 'submitted']);
  });
});

describe('deliverNotification — the receiving half of the Outbox', () => {
  const LATER = new Date(T0.getTime() + 10 * MINUTE);
  const approvalOfNew: VerificationNotification = {
    kind: 'status_email',
    userId: USER_ID,
    inquiryId: 'inq_new',
    status: 'approved',
    statusChangedAt: LATER
  };

  it.each([
    { label: 'no row exists yet', stored: null },
    {
      label: 'the row still points at the inquiry this one replaced',
      stored: { status: 'expired', personaInquiryId: 'inq_old', statusChangedAt: T0 }
    },
    {
      label: 'the row has the inquiry but not this transition',
      stored: { status: 'submitted', personaInquiryId: 'inq_new', statusChangedAt: T0 }
    }
  ] as const)('asks for a retry when $label — the write path enqueues before it persists', async ({ stored }) => {
    const { verification, seedRecord, emails } = setup();
    if (stored) seedRecord(stored);

    await expect(verification.deliverNotification({ notification: approvalOfNew })).resolves.toEqual({
      ok: false,
      error: { code: 'not_caught_up' }
    });
    expect(emails.sent).toHaveLength(0);
  });

  it.each([
    {
      label: 'an inquiry the row has moved past',
      notification: { ...approvalOfNew, inquiryId: 'inq_old', status: 'expired', statusChangedAt: T0 }
    },
    {
      label: 'an earlier transition of the current inquiry',
      notification: { ...approvalOfNew, status: 'pending_review', statusChangedAt: T0 }
    },
    {
      label: 'an earlier visit to the same status (approved, declined, approved again)',
      notification: { ...approvalOfNew, statusChangedAt: T0 }
    },
    {
      label: 'the same status another write announced first (a failed persist the sweep re-applied)',
      notification: { ...approvalOfNew, statusChangedAt: new Date(LATER.getTime() + 500) }
    }
  ] as const)('skips a job for $label', async ({ notification }) => {
    const { verification, seedRecord, emails } = setup();
    seedRecord({ status: 'approved', personaInquiryId: 'inq_new', statusChangedAt: LATER });

    await expect(verification.deliverNotification({ notification })).resolves.toEqual({ ok: true, value: 'skipped' });
    expect(emails.sent).toHaveLength(0);
  });

  it('emails the onboarding profile, never an address from the job, once the row shows the transition', async () => {
    const { verification, seedRecord, emails, operator } = setup();
    seedRecord({ status: 'approved', personaInquiryId: 'inq_new', statusChangedAt: LATER });

    await expect(verification.deliverNotification({ notification: approvalOfNew })).resolves.toEqual({
      ok: true,
      value: 'sent'
    });
    expect(emails.sent).toEqual([
      {
        to: 'ada@example.com',
        name: 'Ada',
        status: 'approved',
        accountType: 'individual',
        caseWaitingOn: null,
        inquiryId: 'inq_new',
        statusChangedAt: LATER
      }
    ]);
    expect(operator.sent).toHaveLength(0);
  });

  it('sends an operator message for the record', async () => {
    const { verification, seedRecord, operator, emails } = setup();
    seedRecord({ status: 'pending_review', personaInquiryId: 'inq_new', statusChangedAt: LATER });

    await expect(
      verification.deliverNotification({
        notification: { ...approvalOfNew, kind: 'operator_message', status: 'pending_review' }
      })
    ).resolves.toEqual({ ok: true, value: 'sent' });
    expect(operator.sent).toEqual([
      {
        kind: 'status',
        status: 'pending_review',
        userId: USER_ID,
        email: 'ada@example.com',
        inquiryId: 'inq_new',
        accountType: 'individual',
        case: null
      }
    ]);
    expect(emails.sent).toHaveLength(0);
  });

  it('reports a channel that refused the send as send_failed, so the queue retries', async () => {
    const { verification, seedRecord, emails } = setup();
    seedRecord({ status: 'approved', personaInquiryId: 'inq_new', statusChangedAt: LATER });
    emails.failNextCall(new Error('Resend is down'));

    await expect(verification.deliverNotification({ notification: approvalOfNew })).resolves.toMatchObject({
      ok: false,
      error: { code: 'send_failed' }
    });
  });

  it('still sends the operator message when the onboarding profile is gone, without an email', async () => {
    const { verification, seedRecord, store, operator } = setup();
    seedRecord({ status: 'approved', personaInquiryId: 'inq_new', statusChangedAt: LATER });
    store.profiles.delete(USER_ID);

    await expect(
      verification.deliverNotification({
        notification: { ...approvalOfNew, kind: 'operator_message', status: 'approved' }
      })
    ).resolves.toEqual({ ok: true, value: 'sent' });
    expect(operator.sent).toEqual([
      {
        kind: 'status',
        status: 'approved',
        userId: USER_ID,
        email: null,
        inquiryId: 'inq_new',
        accountType: null,
        case: null
      }
    ]);
  });

  it('cannot address an email for a user whose onboarding profile is gone', async () => {
    const { verification, seedRecord, store, emails } = setup();
    seedRecord({ status: 'approved', personaInquiryId: 'inq_new', statusChangedAt: LATER });
    store.profiles.delete(USER_ID);

    await expect(verification.deliverNotification({ notification: approvalOfNew })).resolves.toMatchObject({
      ok: false,
      error: { code: 'send_failed' }
    });
    expect(emails.sent).toHaveLength(0);
  });

  it('delivers what the write path enqueued: a webhook approval ends as one email and one operator message', async () => {
    const { verification, seedRecord, outbox, emails, operator } = setup();
    seedRecord({ status: 'submitted' });

    await delivery({ verification, name: 'inquiry.approved', status: 'approved' });
    for (const notification of outbox.notifications) {
      await expect(verification.deliverNotification({ notification })).resolves.toEqual({ ok: true, value: 'sent' });
    }

    expect(emails.sent).toEqual([
      expect.objectContaining({ to: 'ada@example.com', name: 'Ada', status: 'approved', inquiryId: 'inq_seeded' })
    ]);
    expect(operator.sent).toEqual([
      {
        kind: 'status',
        status: 'approved',
        userId: USER_ID,
        email: 'ada@example.com',
        inquiryId: 'inq_seeded',
        accountType: 'individual',
        case: null
      }
    ]);
  });
});

describe('reads are local; the start is where Persona is consulted', () => {
  it.each([
    ['stale non-terminal', 'submitted', 600],
    ['fresh non-terminal', 'submitted', 29],
    ['stale terminal', 'approved', 600],
    ['stale human-owned', 'manually_approved', 600]
  ] as const)('answers a %s record from the store without asking Persona', async (_label, status, minutesOld) => {
    const { verification, persona, seedRecord, clock } = setup();
    seedRecord({ status, lastSyncedAt: T0 });
    clock.advance(minutesOld * MINUTE);

    const view = await verification.getVerificationStatus({ userId: USER_ID });

    expect(view.status).toBe(status);
    expect(persona.calls).toHaveLength(0);
  });
});

describe('operator actions — revoke, approveManually and resyncFromPersona', () => {
  /** The user's Inquiry as Persona holds it, decided `minutesAfterT0` after the seed time. */
  function personaHolds({
    s,
    status,
    minutesAfterT0
  }: {
    s: ReturnType<typeof setup>;
    status: 'approved' | 'declined' | 'needs_review';
    minutesAfterT0: number;
  }) {
    s.persona.inquiries.set('inq_seeded', {
      id: 'inq_seeded',
      status,
      referenceId: USER_ID,
      accountId: 'act_seeded',
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      createdAt: T0,
      updatedAt: new Date(T0.getTime() + minutesAfterT0 * MINUTE)
    });
  }

  it('revokes an approved record, stamped after the last transition, and notifies nobody', async () => {
    const { verification, seedRecord, store, outbox } = setup();
    // Persona's clock ran ahead of ours: the approval is stamped later than "now".
    seedRecord({ status: 'approved', statusChangedAt: new Date(T0.getTime() + MINUTE) });

    await expect(verification.revoke({ userId: USER_ID })).resolves.toEqual({
      ok: true,
      value: { from: 'approved', to: 'revoked', inquiryId: 'inq_seeded', path: 'individual', case: null }
    });

    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'revoked',
      personaInquiryId: 'inq_seeded',
      statusChangedAt: new Date(T0.getTime() + MINUTE + 1)
    });
    expect(outbox.notifications).toHaveLength(0);
  });

  it('tells the Wallet link at once when a revocation takes a yes back, and not when there was none', async () => {
    const approved = setup();
    approved.seedRecord({ status: 'manually_approved' });
    await approved.verification.revoke({ userId: USER_ID });
    expect(approved.approvalsEnded).toEqual([USER_ID]);

    const declined = setup();
    declined.seedRecord({ status: 'declined' });
    await declined.verification.revoke({ userId: USER_ID });
    expect(declined.approvalsEnded).toEqual([]);
  });

  it('revokes a user who never started, which also refuses a start', async () => {
    const { verification, store, persona } = setup();

    await expect(verification.revoke({ userId: USER_ID })).resolves.toEqual({
      ok: true,
      value: { from: 'not_started', to: 'revoked', inquiryId: null, path: 'individual', case: null }
    });

    expect(store.records.get(USER_ID)).toMatchObject({ status: 'revoked', personaInquiryId: null });
    await expect(verification.startVerification({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'revoked' }
    });
    expect(persona.calls).toHaveLength(0);
  });

  it('refuses a user id that is no onboarded user', async () => {
    const { verification, store } = setup();

    await expect(verification.revoke({ userId: 'nobody' })).resolves.toEqual({
      ok: false,
      error: { code: 'profile_missing' }
    });
    await expect(verification.approveManually({ userId: 'nobody' })).resolves.toEqual({
      ok: false,
      error: { code: 'profile_missing' }
    });
    await expect(verification.resyncFromPersona({ userId: 'nobody' })).resolves.toEqual({
      ok: false,
      error: { code: 'profile_missing' }
    });
    expect(store.records.size).toBe(0);
  });

  it('releases a revoked record to what Persona holds now, not to what the record held before', async () => {
    const s = setup();
    s.seedRecord({ status: 'approved' });
    s.clock.advance(60 * MINUTE);
    await s.verification.revoke({ userId: USER_ID });
    // Persona declined the Inquiry while the record was revoked; the event was dropped: Persona never moves a Human-owned status.
    await delivery({ verification: s.verification, name: 'inquiry.declined', status: 'declined', minutesAfterT0: 90 });
    expect(s.store.records.get(USER_ID)?.status).toBe('revoked');
    personaHolds({ s, status: 'declined', minutesAfterT0: 90 });
    s.clock.advance(60 * MINUTE);

    await expect(s.verification.resyncFromPersona({ userId: USER_ID })).resolves.toEqual({
      ok: true,
      value: { from: 'revoked', to: 'declined', inquiryId: 'inq_seeded', path: 'individual', case: null }
    });

    expect(s.store.records.get(USER_ID)).toMatchObject({ status: 'declined' });
    expect(s.outbox.notifications.map((n) => `${n.kind}:${n.status}`)).toEqual([
      'status_email:declined',
      'operator_message:declined'
    ]);
  });

  it('releases a revoked record although Persona decided before the revocation', async () => {
    const s = setup();
    s.seedRecord({ status: 'approved' });
    personaHolds({ s, status: 'approved', minutesAfterT0: 0 });
    s.clock.advance(60 * MINUTE);
    await s.verification.revoke({ userId: USER_ID });
    const revokedAt = s.store.records.get(USER_ID)!.statusChangedAt;

    const result = await s.verification.resyncFromPersona({ userId: USER_ID });

    expect(result).toEqual({
      ok: true,
      value: { from: 'revoked', to: 'approved', inquiryId: 'inq_seeded', path: 'individual', case: null }
    });
    expect(s.store.records.get(USER_ID)!.statusChangedAt.getTime()).toBeGreaterThan(revokedAt.getTime());
  });

  it('applies a decline to an approved record on a resync', async () => {
    const s = setup();
    s.seedRecord({ status: 'approved' });
    personaHolds({ s, status: 'declined', minutesAfterT0: 30 });

    await expect(s.verification.resyncFromPersona({ userId: USER_ID })).resolves.toEqual({
      ok: true,
      value: { from: 'approved', to: 'declined', inquiryId: 'inq_seeded', path: 'individual', case: null }
    });
  });

  it('keeps a revocation that lands while a start is creating an inquiry', async () => {
    const s = setup();
    // The operator revokes while Persona is still answering the create; the
    // created inquiry is stamped after the revocation, so only the
    // Human-owned check at the store can keep it from landing.
    const create = s.persona.persona.createInquiry.bind(s.persona.persona);
    s.persona.persona.createInquiry = async (input) => {
      await s.verification.revoke({ userId: USER_ID });
      s.clock.advance(1_000);
      return create(input);
    };

    await expect(s.verification.startVerification({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'revoked' }
    });
    expect(s.store.records.get(USER_ID)?.status).toBe('revoked');
  });

  it('releases a manually approved record to what Persona holds, and revokes one', async () => {
    const s = setup();
    s.seedRecord({ status: 'manually_approved' });
    personaHolds({ s, status: 'declined', minutesAfterT0: 30 });
    s.clock.advance(60 * MINUTE);

    await expect(s.verification.resyncFromPersona({ userId: USER_ID })).resolves.toEqual({
      ok: true,
      value: { from: 'manually_approved', to: 'declined', inquiryId: 'inq_seeded', path: 'individual', case: null }
    });

    s.seedRecord({ status: 'manually_approved' });
    await expect(s.verification.revoke({ userId: USER_ID })).resolves.toMatchObject({
      ok: true,
      value: { from: 'manually_approved', to: 'revoked' }
    });
  });

  it('tells the Wallet link at once when a resync hands a manual approval back to a review, and not to a yes', async () => {
    const reviewing = setup();
    reviewing.seedRecord({ status: 'manually_approved' });
    personaHolds({ s: reviewing, status: 'needs_review', minutesAfterT0: 30 });
    await expect(reviewing.verification.resyncFromPersona({ userId: USER_ID })).resolves.toMatchObject({
      ok: true,
      value: { from: 'manually_approved', to: 'pending_review' }
    });
    expect(reviewing.approvalsEnded).toEqual([USER_ID]);

    const approved = setup();
    approved.seedRecord({ status: 'manually_approved' });
    personaHolds({ s: approved, status: 'approved', minutesAfterT0: 30 });
    await expect(approved.verification.resyncFromPersona({ userId: USER_ID })).resolves.toMatchObject({
      ok: true,
      value: { from: 'manually_approved', to: 'approved' }
    });
    expect(approved.approvalsEnded).toEqual([]);
  });

  it('approves a user Persona never decides, and the approval is deaf to Persona and to a resync', async () => {
    const { verification, store, outbox } = setup();

    await expect(verification.approveManually({ userId: USER_ID })).resolves.toEqual({
      ok: true,
      value: { from: 'not_started', to: 'manually_approved', inquiryId: null, path: 'individual', case: null }
    });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'manually_approved', personaInquiryId: null });
    await expect(verification.startVerification({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'already_verified' }
    });

    // No Inquiry to go back to: a resync leaves the approval standing.
    await expect(verification.resyncFromPersona({ userId: USER_ID })).resolves.toEqual({
      ok: true,
      value: { from: 'manually_approved', to: 'manually_approved', inquiryId: null, path: 'individual', case: null }
    });
    expect(outbox.notifications).toHaveLength(0);
  });

  it('restores a revoked record by manual approval, and revoke undoes it', async () => {
    const { verification, seedRecord, store } = setup();
    seedRecord({ status: 'revoked' });
    const revokedAt = store.records.get(USER_ID)!.statusChangedAt;

    await expect(verification.approveManually({ userId: USER_ID })).resolves.toEqual({
      ok: true,
      value: { from: 'revoked', to: 'manually_approved', inquiryId: 'inq_seeded', path: 'individual', case: null }
    });
    expect(store.records.get(USER_ID)!.statusChangedAt.getTime()).toBeGreaterThan(revokedAt.getTime());

    await expect(verification.revoke({ userId: USER_ID })).resolves.toMatchObject({
      ok: true,
      value: { from: 'manually_approved', to: 'revoked' }
    });
  });

  it('leaves a revoked record as it is when Persona holds no Inquiry to go back to', async () => {
    const { verification, seedRecord, store } = setup();
    seedRecord({ status: 'revoked' });

    await expect(verification.resyncFromPersona({ userId: USER_ID })).resolves.toEqual({
      ok: true,
      value: { from: 'revoked', to: 'revoked', inquiryId: null, path: 'individual', case: null }
    });
    expect(store.records.get(USER_ID)?.status).toBe('revoked');
  });

  it('answers persona_unavailable and changes nothing when Persona cannot be read', async () => {
    const { verification, seedRecord, store, persona } = setup();
    seedRecord({ status: 'revoked' });
    persona.failNextCall({ reason: 'network', message: 'timeout' });

    await expect(verification.resyncFromPersona({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'persona_unavailable', cause: { reason: 'network', message: 'timeout' } }
    });
    expect(store.records.get(USER_ID)?.status).toBe('revoked');
  });
});

// ---------------------------------------------------------------------------
// The organization flow: the same module, the business template, and the
// KYB case that decides it (the case half lands with the case events).
// ---------------------------------------------------------------------------

const ORGANIZATION_PROFILE = {
  accountType: 'organization',
  firstName: 'Grace',
  lastName: 'Hopper',
  email: 'grace@acme.example',
  countryCode: null,
  entityName: 'Acme Capital LLC',
  countryOfIncorporationCode: 'US'
} as const;

function setupOrganization() {
  const s = setup({ organization: true });
  s.store.profiles.set(USER_ID, ORGANIZATION_PROFILE);
  return s;
}

describe('the organization flow', () => {
  it('lets an organization start once its flow is configured, where an unconfigured one is refused', async () => {
    const off = setup();
    off.store.profiles.set(USER_ID, ORGANIZATION_PROFILE);
    await expect(off.verification.getVerificationStatus({ userId: USER_ID })).resolves.toMatchObject({
      path: 'organization',
      canStart: false
    });
    await expect(off.verification.startVerification({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'organization' }
    });

    const { verification } = setupOrganization();
    await expect(verification.getVerificationStatus({ userId: USER_ID })).resolves.toEqual({
      status: 'not_started',
      path: 'organization',
      canStart: true,
      canResume: false,
      inquiryId: null,
      caseWaitingOn: null
    });
  });

  it("creates an organization's inquiry on the KYB template, on a Business account, prefilled with the business", async () => {
    const { verification, store, persona } = setupOrganization();

    const result = await verification.startVerification({ userId: USER_ID });

    expect(result).toMatchObject({ ok: true, value: { inquiryId: 'inq_1' } });
    expect(persona.calls[1]).toEqual({
      method: 'createInquiry',
      input: {
        templateVersionId: FAKE_KYB_TEMPLATE_VERSION_ID,
        fields: {
          'business-name': 'Acme Capital LLC',
          'business-country-of-incorporation-code': 'US'
        },
        referenceId: USER_ID,
        accountTypeId: FAKE_KYB_ACCOUNT_TYPE_ID,
        idempotencyKey: expect.any(String)
      }
    });
    expect(persona.inquiries.get('inq_1')).toMatchObject({ templateId: FAKE_KYB_TEMPLATE_ID });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'in_progress', personaInquiryId: 'inq_1' });
    // The business inquiry is the organization's own: a second start resumes it.
    await expect(verification.startVerification({ userId: USER_ID })).resolves.toMatchObject({
      ok: true,
      value: { inquiryId: 'inq_1' }
    });
  });

  it("ignores an organization's inquiry on the individual template, and an individual's on the KYB template", async () => {
    const org = setupOrganization();
    org.seedRecord({ status: 'in_progress' });
    await expect(
      delivery({
        verification: org.verification,
        name: 'inquiry.completed',
        status: 'completed',
        templateId: FAKE_TEMPLATE_ID
      })
    ).resolves.toEqual({
      ok: true,
      value: { outcome: 'ignored', reason: 'foreign_inquiry', eventName: 'inquiry.completed' }
    });
    expect(org.store.records.get(USER_ID)?.status).toBe('in_progress');

    const individual = setup({ organization: true });
    individual.seedRecord({ status: 'in_progress' });
    await expect(
      delivery({
        verification: individual.verification,
        name: 'inquiry.completed',
        status: 'completed',
        templateId: FAKE_KYB_TEMPLATE_ID
      })
    ).resolves.toMatchObject({ ok: true, value: { outcome: 'ignored', reason: 'foreign_inquiry' } });
    // The same event on its own template applies.
    await expect(
      delivery({
        verification: individual.verification,
        name: 'inquiry.completed',
        status: 'completed',
        templateId: FAKE_TEMPLATE_ID
      })
    ).resolves.toEqual({ ok: true, value: { outcome: 'applied' } });
  });

  it("says who an organization's review waits on, from the raw case status", async () => {
    const { verification, seedRecord } = setupOrganization();

    for (const [caseStatus, waitingOn] of [
      ['Waiting on UBOs', 'people'],
      ['Ready for Review', 'team'],
      ['Open', 'team'],
      ['Needs more information', 'team']
    ] as const) {
      seedRecord({ status: 'pending_review', personaCaseId: 'case_1', personaCaseStatus: caseStatus });
      await expect(verification.getVerificationStatus({ userId: USER_ID })).resolves.toMatchObject({
        caseWaitingOn: waitingOn
      });
    }
    seedRecord({ status: 'approved', personaCaseId: 'case_1', personaCaseStatus: 'Approved' });
    await expect(verification.getVerificationStatus({ userId: USER_ID })).resolves.toMatchObject({
      caseWaitingOn: null
    });
  });

  it("treats an organization's failed inquiry as the end of the road: no restart, no undecided alarm, no re-read", async () => {
    const { verification, clock, seedRecord, persona } = setupOrganization();
    const twoHoursAgo = new Date(T0.getTime() - 2 * 60 * MINUTE);
    seedRecord({ status: 'failed', statusChangedAt: twoHoursAgo, lastSyncedAt: twoHoursAgo });

    await expect(verification.getVerificationStatus({ userId: USER_ID })).resolves.toMatchObject({
      canStart: false,
      canResume: false
    });

    // The sweep neither re-reads it nor counts it as waiting on Persona.
    const report = await verification.reconcile({ now: clock.clock.now() });
    expect(report).toMatchObject({ checked: 0, undecided: 0 });
    expect(persona.calls).toHaveLength(0);

    await expect(verification.startVerification({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'failed' }
    });
  });

  // -- Case events: the business inquiry completes, the Workflow opens the case, the case decides.

  /** A signed case delivery for the case that lists the seeded inquiry (and an owner's child). */
  function caseDelivery({
    verification,
    name = 'case.status-updated',
    status,
    minutesAfterT0 = 1,
    id,
    caseId = 'case_1',
    caseTemplateId = FAKE_KYB_CASE_TEMPLATE_ID,
    inquiryIds = ['inq_seeded', 'inq_owner']
  }: {
    verification: ReturnType<typeof setup>['verification'];
    name?: string;
    status: string;
    minutesAfterT0?: number;
    id?: string;
    caseId?: string;
    caseTemplateId?: string;
    inquiryIds?: ReadonlyArray<string>;
  }) {
    const createdAt = new Date(T0.getTime() + minutesAfterT0 * MINUTE);
    const rawBody = JSON.stringify({
      data: {
        type: 'event',
        id: id ?? `evt_case_${minutesAfterT0}`,
        attributes: {
          name,
          'created-at': createdAt.toISOString(),
          payload: {
            data: {
              type: 'case',
              id: caseId,
              attributes: { status, 'created-at': T0.toISOString(), 'updated-at': createdAt.toISOString() },
              relationships: {
                'case-template': { data: { type: 'case-template', id: caseTemplateId } },
                inquiries: { data: inquiryIds.map((inquiryId) => ({ type: 'inquiry', id: inquiryId })) }
              }
            }
          }
        }
      }
    });
    const receivedAt = new Date(createdAt.getTime() + 5_000);
    return verification.receiveWebhook({ rawBody, signatureHeader: sign({ rawBody, at: receivedAt }), receivedAt });
  }

  it('opens the review when the Workflow creates the case, and decides the organization when a reviewer resolves it', async () => {
    const { verification, store, outbox, seedRecord } = setupOrganization();
    seedRecord({ status: 'submitted' });

    await expect(
      caseDelivery({ verification, name: 'case.created', status: 'Open', minutesAfterT0: 1 })
    ).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });
    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'pending_review',
      personaInquiryId: 'inq_seeded',
      personaCaseId: 'case_1',
      personaCaseStatus: 'Open',
      sourceAt: new Date(T0.getTime() + MINUTE),
      statusChangedAt: new Date(T0.getTime() + MINUTE)
    });

    await expect(caseDelivery({ verification, status: 'Approved', minutesAfterT0: 3 })).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'approved', personaCaseStatus: 'Approved' });
    expect(outbox.notifications.map((job) => `${job.kind}:${job.status}`)).toEqual([
      'status_email:pending_review',
      'operator_message:pending_review',
      'status_email:approved',
      'operator_message:approved'
    ]);
    await expect(verification.getVerificationStatus({ userId: USER_ID })).resolves.toMatchObject({
      status: 'approved',
      canStart: false
    });
  });

  it('declines the organization when the case is declined', async () => {
    const { verification, store, seedRecord } = setupOrganization();
    seedRecord({ status: 'pending_review', personaCaseId: 'case_1', personaCaseStatus: 'Ready for Review' });

    await expect(caseDelivery({ verification, status: 'Declined' })).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'declined', personaCaseStatus: 'Declined' });
    await expect(verification.startVerification({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'declined' }
    });
  });

  it("records a move the status does not follow as the raw case status alone, with no stamp, and pings the team's turn", async () => {
    const { verification, store, outbox, seedRecord } = setupOrganization();
    const seeded = seedRecord({ status: 'pending_review', personaCaseId: 'case_1', personaCaseStatus: 'Open' });

    // Waiting on the organization's own people: recorded, nobody pinged.
    await expect(caseDelivery({ verification, status: 'Waiting on UBOs' })).resolves.toEqual({
      ok: true,
      value: { outcome: 'unchanged' }
    });
    expect(store.records.get(USER_ID)).toMatchObject({ personaCaseStatus: 'Waiting on UBOs' });
    expect(outbox.notifications).toHaveLength(0);
    await expect(verification.getVerificationStatus({ userId: USER_ID })).resolves.toMatchObject({
      caseWaitingOn: 'people'
    });

    // The team's turn: recorded and announced, still no transition.
    await expect(caseDelivery({ verification, status: 'Ready for Review', minutesAfterT0: 2 })).resolves.toEqual({
      ok: true,
      value: { outcome: 'unchanged' }
    });
    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'pending_review',
      personaCaseStatus: 'Ready for Review',
      statusChangedAt: seeded.statusChangedAt
    });
    expect(outbox.notifications).toEqual([
      {
        kind: 'case_status',
        userId: USER_ID,
        inquiryId: 'inq_seeded',
        status: 'pending_review',
        statusChangedAt: seeded.statusChangedAt,
        caseId: 'case_1',
        caseStatus: 'Ready for Review'
      }
    ]);
    await expect(verification.getVerificationStatus({ userId: USER_ID })).resolves.toMatchObject({
      caseWaitingOn: 'team'
    });

    // A redelivery changes nothing and pings nobody.
    await expect(caseDelivery({ verification, status: 'Ready for Review', minutesAfterT0: 3 })).resolves.toEqual({
      ok: true,
      value: { outcome: 'unchanged' }
    });
    expect(outbox.notifications).toHaveLength(1);
  });

  it('delivers a case move while the record still holds it, and skips one it has moved past', async () => {
    const { verification, operator, seedRecord } = setupOrganization();
    seedRecord({ status: 'pending_review', personaCaseId: 'case_1', personaCaseStatus: 'Ready for Review' });
    const job = {
      kind: 'case_status',
      userId: USER_ID,
      inquiryId: 'inq_seeded',
      status: 'pending_review',
      statusChangedAt: T0,
      caseId: 'case_1',
      caseStatus: 'Ready for Review'
    } as const;

    await expect(verification.deliverNotification({ notification: job })).resolves.toEqual({ ok: true, value: 'sent' });
    expect(operator.sent).toEqual([
      {
        kind: 'case_status',
        userId: USER_ID,
        email: 'grace@acme.example',
        inquiryId: 'inq_seeded',
        accountType: 'organization',
        status: 'pending_review',
        case: { id: 'case_1', status: 'Ready for Review' }
      }
    ]);

    seedRecord({ status: 'approved', personaCaseId: 'case_1', personaCaseStatus: 'Approved' });
    await expect(verification.deliverNotification({ notification: job })).resolves.toEqual({
      ok: true,
      value: 'skipped'
    });
    expect(operator.sent).toHaveLength(1);
  });

  it('moves an approved organization back under review when its case is reopened, and decides it again from there', async () => {
    const { verification, store, outbox, seedRecord } = setupOrganization();
    seedRecord({ status: 'approved', personaCaseId: 'case_1', personaCaseStatus: 'Approved', sourceAt: T0 });

    await expect(caseDelivery({ verification, status: 'Open' })).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });
    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'pending_review',
      personaCaseStatus: 'Open',
      statusChangedAt: new Date(T0.getTime() + MINUTE)
    });
    expect(outbox.notifications).toEqual([
      expect.objectContaining({ kind: 'status_email', status: 'pending_review', reopenedFrom: 'approved' }),
      expect.objectContaining({ kind: 'operator_message', status: 'pending_review', reopenedFrom: 'approved' })
    ]);

    // Approved again: a transition like the first approval, announced the same way.
    await expect(caseDelivery({ verification, status: 'Approved', minutesAfterT0: 2 })).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'approved', personaCaseStatus: 'Approved' });

    await expect(caseDelivery({ verification, status: 'Open', minutesAfterT0: 3 })).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });
    await expect(caseDelivery({ verification, status: 'Declined', minutesAfterT0: 4 })).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'declined', personaCaseStatus: 'Declined' });
  });

  it('moves a declined organization back under review when its case is reopened', async () => {
    const { verification, seedRecord } = setupOrganization();
    seedRecord({ status: 'declined', personaCaseId: 'case_1', personaCaseStatus: 'Declined', sourceAt: T0 });

    await expect(caseDelivery({ verification, status: 'Open' })).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });
    await expect(verification.getVerificationStatus({ userId: USER_ID })).resolves.toMatchObject({
      status: 'pending_review',
      caseWaitingOn: 'team'
    });
  });

  it('tells the organization and the operators that the review was reopened, and from which Decision', async () => {
    const { verification, outbox, emails, operator, seedRecord } = setupOrganization();
    seedRecord({ status: 'declined', personaCaseId: 'case_1', personaCaseStatus: 'Declined', sourceAt: T0 });

    await caseDelivery({ verification, status: 'Open' });
    for (const notification of outbox.notifications) {
      await expect(verification.deliverNotification({ notification })).resolves.toEqual({ ok: true, value: 'sent' });
    }

    expect(emails.sent).toEqual([expect.objectContaining({ status: 'pending_review', reopenedFrom: 'declined' })]);
    expect(operator.sent).toEqual([
      expect.objectContaining({ kind: 'status', status: 'pending_review', reopenedFrom: 'declined' })
    ]);
  });

  it('marks no first review as a reopen', async () => {
    const { verification, outbox, seedRecord } = setupOrganization();
    seedRecord({ status: 'submitted' });

    await caseDelivery({ verification, name: 'case.created', status: 'Open' });
    expect(outbox.notifications.some((job) => 'reopenedFrom' in job)).toBe(false);
  });

  it('tells the Wallet link at once when a yes is taken back, and only then', async () => {
    const reopened = setupOrganization();
    reopened.seedRecord({ status: 'approved', personaCaseId: 'case_1', personaCaseStatus: 'Approved' });
    await caseDelivery({ verification: reopened.verification, status: 'Open' });
    expect(reopened.approvalsEnded).toEqual([USER_ID]);

    const declined = setupOrganization();
    declined.seedRecord({ status: 'approved', personaCaseId: 'case_1', personaCaseStatus: 'Approved' });
    await caseDelivery({ verification: declined.verification, status: 'Declined' });
    expect(declined.approvalsEnded).toEqual([USER_ID]);

    // Nothing was approved to take back: a reopen after a decline, and a first approval.
    const neverApproved = setupOrganization();
    neverApproved.seedRecord({ status: 'declined', personaCaseId: 'case_1', personaCaseStatus: 'Declined' });
    await caseDelivery({ verification: neverApproved.verification, status: 'Open' });
    await caseDelivery({ verification: neverApproved.verification, status: 'Approved', minutesAfterT0: 2 });
    expect(neverApproved.approvalsEnded).toEqual([]);
  });

  it('applies the reopen even when the Wallet link cannot be told', async () => {
    const { verification, store, failApprovalEnded, approvalsEnded, seedRecord } = setupOrganization();
    seedRecord({ status: 'approved', personaCaseId: 'case_1', personaCaseStatus: 'Approved' });
    failApprovalEnded();

    await expect(caseDelivery({ verification, status: 'Open' })).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });
    expect(store.records.get(USER_ID)?.status).toBe('pending_review');
    expect(approvalsEnded).toEqual([]);
  });

  it('keeps a Decision when the case moves to a status the configuration does not know, and says so', async () => {
    const { verification, store, outbox, approvalsEnded, seedRecord } = setupOrganization();
    seedRecord({ status: 'approved', personaCaseId: 'case_1', personaCaseStatus: 'Approved', sourceAt: T0 });

    await expect(caseDelivery({ verification, status: 'Needs more information' })).resolves.toEqual({
      ok: true,
      value: { outcome: 'unchanged', unknownCaseStatus: 'Needs more information' }
    });
    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'approved',
      personaCaseStatus: 'Needs more information'
    });
    expect(outbox.notifications).toEqual([
      expect.objectContaining({ kind: 'case_status', status: 'approved', caseStatus: 'Needs more information' })
    ]);
    expect(approvalsEnded).toEqual([]);
  });

  it("never lets a reopen touch an operator's status, and still records the case move", async () => {
    const { verification, store, seedRecord } = setupOrganization();
    seedRecord({
      status: 'manually_approved',
      personaCaseId: 'case_1',
      personaCaseStatus: 'Approved',
      sourceAt: T0
    });

    await expect(caseDelivery({ verification, status: 'Open' })).resolves.toEqual({
      ok: true,
      value: { outcome: 'unchanged' }
    });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'manually_approved', personaCaseStatus: 'Open' });
  });

  it('never lets a delayed approval from between two declines decide the organization', async () => {
    const { verification, store, seedRecord } = setupOrganization();
    seedRecord({ status: 'declined', personaCaseId: 'case_1', personaCaseStatus: 'Declined', sourceAt: T0 });

    // The case went Declined → Open → Approved → Open → Declined; the approval is delivered last.
    await caseDelivery({ verification, status: 'Open', minutesAfterT0: 2 });
    await caseDelivery({ verification, status: 'Open', minutesAfterT0: 4 });
    await expect(caseDelivery({ verification, status: 'Declined', minutesAfterT0: 5 })).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });
    await expect(caseDelivery({ verification, status: 'Approved', minutesAfterT0: 3 })).resolves.toEqual({
      ok: true,
      value: { outcome: 'unchanged' }
    });
    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'declined',
      personaCaseStatus: 'Declined',
      sourceAt: new Date(T0.getTime() + 5 * MINUTE)
    });
  });

  it('never lets a delayed approval in when the second decline arrived before the reopen events', async () => {
    const { verification, store, outbox, seedRecord } = setupOrganization();
    seedRecord({ status: 'declined', personaCaseId: 'case_1', personaCaseStatus: 'Declined', sourceAt: T0 });

    // Retries after an outage: the second decline lands first, the same raw status with a newer stamp.
    await expect(caseDelivery({ verification, status: 'Declined', minutesAfterT0: 5 })).resolves.toEqual({
      ok: true,
      value: { outcome: 'unchanged' }
    });
    expect(store.records.get(USER_ID)).toMatchObject({ sourceAt: new Date(T0.getTime() + 5 * MINUTE) });
    expect(outbox.notifications).toHaveLength(0);

    await expect(caseDelivery({ verification, status: 'Approved', minutesAfterT0: 3 })).resolves.toEqual({
      ok: true,
      value: { outcome: 'unchanged' }
    });
    await caseDelivery({ verification, status: 'Open', minutesAfterT0: 2 });
    await caseDelivery({ verification, status: 'Open', minutesAfterT0: 4 });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'declined', personaCaseStatus: 'Declined' });
    expect(outbox.notifications).toHaveLength(0);
  });

  it("decides again on the present when a delayed approval lands between a decline's read and its write", async () => {
    // Two deliveries at once: the second decline (raw-only, the status is already declined) and a
    // delayed approval from before it. The approval's transition lands while the decline is between
    // its read and its write; the decline loses that write, decides again, and still ends up as the
    // organization's status.
    const base = setupOrganization();
    base.seedRecord({
      status: 'declined',
      personaCaseId: 'case_1',
      personaCaseStatus: 'Declined',
      sourceAt: T0
    });
    let raced = false;
    const racingStore = {
      ...base.store.store,
      async write(...input: Parameters<typeof base.store.store.write>) {
        if (!raced) {
          raced = true;
          await caseDelivery({ verification: base.verification, status: 'Approved', minutesAfterT0: 3 });
          expect(base.store.records.get(USER_ID)?.status).toBe('approved');
        }
        return base.store.store.write(...input);
      }
    };
    const verification = createVerification({
      store: racingStore,
      persona: base.persona.persona,
      outbox: base.outbox.outbox,
      statusEmails: base.emails.sender,
      operatorMessages: base.operator.messenger,
      clock: base.clock.clock,
      config: { webhookSecret: WEBHOOK_SECRET, flows: { individual: INDIVIDUAL_FLOW, organization: ORGANIZATION_FLOW } }
    });

    await expect(caseDelivery({ verification, status: 'Declined', minutesAfterT0: 5 })).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });
    expect(base.store.records.get(USER_ID)).toMatchObject({
      status: 'declined',
      personaCaseStatus: 'Declined',
      sourceAt: new Date(T0.getTime() + 5 * MINUTE),
      statusChangedAt: new Date(T0.getTime() + 5 * MINUTE)
    });
  });

  it('never lets an older case event overwrite a newer raw case status', async () => {
    const { verification, store, outbox, seedRecord } = setupOrganization();
    seedRecord({
      status: 'pending_review',
      personaCaseId: 'case_1',
      personaCaseStatus: 'Ready for Review',
      sourceAt: new Date(T0.getTime() + 2 * MINUTE)
    });

    // "Open" → "Waiting on UBOs" → "Ready for Review" all map to pending_review, so only `sourceAt` orders them.
    await expect(caseDelivery({ verification, status: 'Open', minutesAfterT0: 1 })).resolves.toEqual({
      ok: true,
      value: { outcome: 'unchanged' }
    });
    expect(store.records.get(USER_ID)).toMatchObject({ personaCaseStatus: 'Ready for Review' });
    expect(outbox.notifications).toHaveLength(0);
  });

  it('applies a status the configuration does not know as in review, and names it', async () => {
    const { verification, store, seedRecord } = setupOrganization();
    seedRecord({ status: 'submitted' });

    await expect(caseDelivery({ verification, status: 'Needs more information' })).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied', unknownCaseStatus: 'Needs more information' }
    });
    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'pending_review',
      personaCaseStatus: 'Needs more information'
    });
  });

  it('answers a replayed case event with duplicate and writes nothing twice', async () => {
    const { verification, outbox, seedRecord } = setupOrganization();
    seedRecord({ status: 'submitted' });

    await caseDelivery({ verification, status: 'Waiting on UBOs', id: 'evt_once' });
    await expect(caseDelivery({ verification, status: 'Waiting on UBOs', id: 'evt_once' })).resolves.toEqual({
      ok: true,
      value: { outcome: 'duplicate' }
    });
    expect(outbox.notifications).toHaveLength(2);
  });

  it('ignores a case on another case template, silently', async () => {
    const { verification, store, seedRecord } = setupOrganization();
    seedRecord({ status: 'submitted' });

    await expect(caseDelivery({ verification, status: 'Approved', caseTemplateId: 'ctmpl_kabc' })).resolves.toEqual({
      ok: true,
      value: { outcome: 'ignored', reason: 'foreign_case', eventName: 'case.status-updated' }
    });
    expect(store.records.get(USER_ID)?.status).toBe('submitted');
  });

  it('ignores every case while the organization flow is not configured', async () => {
    const { verification, seedRecord } = setup();
    seedRecord({ status: 'submitted' });

    await expect(caseDelivery({ verification, status: 'Approved' })).resolves.toMatchObject({
      ok: true,
      value: { outcome: 'ignored', reason: 'foreign_case' }
    });
  });

  it('names a case none of whose inquiries any record follows, for someone to look at', async () => {
    const { verification } = setupOrganization();

    await expect(
      caseDelivery({ verification, status: 'Waiting on UBOs', inquiryIds: ['inq_unknown'] })
    ).resolves.toEqual({
      ok: true,
      value: { outcome: 'ignored', reason: 'unmatched_case', eventName: 'case.status-updated', caseId: 'case_1' }
    });
  });

  it("names a case on an individual's inquiry, and a second case on the organization's", async () => {
    const individual = setup({ organization: true });
    individual.seedRecord({ status: 'submitted' });
    await expect(caseDelivery({ verification: individual.verification, status: 'Approved' })).resolves.toMatchObject({
      ok: true,
      value: { outcome: 'ignored', reason: 'conflicting_case', caseId: 'case_1' }
    });
    expect(individual.store.records.get(USER_ID)?.status).toBe('submitted');

    const org = setupOrganization();
    org.seedRecord({ status: 'pending_review', personaCaseId: 'case_1', personaCaseStatus: 'Ready for Review' });
    await expect(
      caseDelivery({ verification: org.verification, status: 'Approved', caseId: 'case_2' })
    ).resolves.toMatchObject({
      ok: true,
      value: { outcome: 'ignored', reason: 'conflicting_case', caseId: 'case_2' }
    });
    expect(org.store.records.get(USER_ID)).toMatchObject({ status: 'pending_review', personaCaseId: 'case_1' });
  });

  it('applies a case event that overtakes the completion, and treats the late completion as unchanged', async () => {
    const { verification, store, seedRecord } = setupOrganization();
    seedRecord({ status: 'in_progress' });

    await expect(
      caseDelivery({ verification, name: 'case.created', status: 'Open', minutesAfterT0: 2 })
    ).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });
    await expect(
      delivery({
        verification,
        name: 'inquiry.completed',
        status: 'completed',
        minutesAfterT0: 1,
        templateId: FAKE_KYB_TEMPLATE_ID
      })
    ).resolves.toEqual({ ok: true, value: { outcome: 'unchanged' } });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'pending_review', personaCaseId: 'case_1' });
  });

  // -- Re-reads: the sweep and a resync read an organization through its case.

  /** The organization's completed business inquiry, as Persona lists it, with a case over it when `caseStatus` is given. */
  function seedCompletedBusinessInquiry({
    persona,
    at,
    caseStatus,
    caseId = 'case_1',
    caseTemplateId = FAKE_KYB_CASE_TEMPLATE_ID
  }: {
    persona: ReturnType<typeof setup>['persona'];
    at: Date;
    caseStatus?: string;
    caseId?: string;
    caseTemplateId?: string;
  }) {
    persona.inquiries.set('inq_seeded', {
      id: 'inq_seeded',
      status: 'completed',
      referenceId: USER_ID,
      accountId: 'act_seeded',
      templateId: FAKE_KYB_TEMPLATE_ID,
      templateVersionId: FAKE_KYB_TEMPLATE_VERSION_ID,
      createdAt: at,
      updatedAt: at
    });
    if (caseStatus) {
      persona.cases.set(caseId, {
        id: caseId,
        status: caseStatus,
        caseTemplateId,
        inquiryIds: ['inq_seeded', 'inq_owner'],
        createdAt: at,
        updatedAt: at
      });
    }
  }

  it('ignores a decision on the business inquiry itself: only the case decides an organization', async () => {
    const { verification, store, outbox, seedRecord } = setupOrganization();
    const seeded = seedRecord({
      status: 'pending_review',
      personaCaseId: 'case_1',
      personaCaseStatus: 'Ready for Review'
    });

    for (const [name, status] of [
      ['inquiry.approved', 'approved'],
      ['inquiry.declined', 'declined']
    ] as const) {
      await expect(
        delivery({ verification, name, status, templateId: FAKE_KYB_TEMPLATE_ID, minutesAfterT0: 2 })
      ).resolves.toEqual({
        ok: true,
        value: { outcome: 'ignored', reason: 'case_decides', eventName: name, userId: USER_ID, inquiryId: 'inq_seeded' }
      });
    }
    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'pending_review',
      personaCaseStatus: 'Ready for Review',
      statusChangedAt: seeded.statusChangedAt
    });
    expect(outbox.notifications).toHaveLength(0);

    // The same decision on the case is the organization's.
    await expect(caseDelivery({ verification, status: 'Approved', minutesAfterT0: 3 })).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });
    expect(store.records.get(USER_ID)?.status).toBe('approved');
  });

  it('does not adopt a decided business inquiry on a re-read or a start until its case decides', async () => {
    const { verification, store, persona, clock, seedRecord } = setupOrganization();
    const stale = new Date(T0.getTime() - 45 * MINUTE);
    seedRecord({ status: 'submitted', statusChangedAt: stale, lastSyncedAt: stale });
    seedCompletedBusinessInquiry({ persona, at: stale });
    persona.setInquiryStatus({ inquiryId: 'inq_seeded', status: 'approved', at: new Date(T0.getTime() - MINUTE) });

    // Approved by hand, no case: confirmed, still submitted, and a start still waits on the decision.
    expect(await verification.reconcile({ now: T0 })).toMatchObject({ checked: 1, changed: 0 });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'submitted', lastSyncedAt: T0 });
    await expect(verification.startVerification({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'awaiting_decision' }
    });

    // The case decides, and the record follows it.
    clock.advance(31 * MINUTE);
    persona.cases.set('case_1', {
      id: 'case_1',
      status: 'Approved',
      caseTemplateId: FAKE_KYB_CASE_TEMPLATE_ID,
      inquiryIds: ['inq_seeded'],
      createdAt: T0,
      updatedAt: T0
    });
    expect(await verification.reconcile({ now: clock.clock.now() })).toMatchObject({ checked: 1, changed: 1 });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'approved', personaCaseId: 'case_1' });
  });

  it('re-reads a decided organization on the review cadence, so a reopen whose webhook was lost still lands', async () => {
    const { verification, store, persona, outbox, approvalsEnded, clock, seedRecord } = setupOrganization();
    const decidedAt = new Date(T0.getTime() - 7 * 60 * MINUTE);
    seedRecord({
      status: 'approved',
      personaCaseId: 'case_1',
      personaCaseStatus: 'Approved',
      sourceAt: decidedAt,
      statusChangedAt: decidedAt,
      lastSyncedAt: decidedAt
    });
    seedCompletedBusinessInquiry({ persona, at: decidedAt, caseStatus: 'Approved' });

    // Still approved in Persona: confirmed, and left alone until the cadence comes round again.
    expect(await verification.reconcile({ now: T0 })).toMatchObject({ checked: 1, changed: 0 });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'approved', lastSyncedAt: T0 });
    clock.advance(60 * MINUTE);
    expect(await verification.reconcile({ now: clock.clock.now() })).toMatchObject({ checked: 0 });

    // Reopened, and the webhook never came: the next read on the cadence takes the approval back.
    persona.cases.get('case_1')!.status = 'Open';
    persona.cases.get('case_1')!.updatedAt = new Date(T0.getTime() + 2 * 60 * MINUTE);
    clock.advance(6 * 60 * MINUTE);
    expect(await verification.reconcile({ now: clock.clock.now() })).toMatchObject({ checked: 1, changed: 1 });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'pending_review', personaCaseStatus: 'Open' });
    expect(outbox.notifications).toEqual([
      expect.objectContaining({ kind: 'status_email', reopenedFrom: 'approved' }),
      expect.objectContaining({ kind: 'operator_message', reopenedFrom: 'approved' })
    ]);
    expect(approvalsEnded).toEqual([USER_ID]);
  });

  it("keeps a decided organization's Decision when the sweep finds its case at a status the configuration does not know, and says so once", async () => {
    const { verification, store, persona, outbox, approvalsEnded, seedRecord } = setupOrganization();
    const decidedAt = new Date(T0.getTime() - 7 * 60 * MINUTE);
    const seeded = seedRecord({
      status: 'approved',
      personaCaseId: 'case_1',
      personaCaseStatus: 'Approved',
      statusChangedAt: decidedAt,
      lastSyncedAt: decidedAt
    });
    seedCompletedBusinessInquiry({ persona, at: decidedAt, caseStatus: 'Approved' });
    // Persona added a status, a reviewer moved the case to it, and the webhook was lost.
    persona.cases.get('case_1')!.status = 'Needs more information';
    persona.cases.get('case_1')!.updatedAt = new Date(T0.getTime() - 60 * MINUTE);

    expect(await verification.reconcile({ now: T0 })).toMatchObject({ checked: 1, changed: 0 });
    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'approved',
      personaCaseStatus: 'Needs more information',
      statusChangedAt: seeded.statusChangedAt
    });
    expect(outbox.notifications).toEqual([
      expect.objectContaining({ kind: 'case_status', status: 'approved', caseStatus: 'Needs more information' })
    ]);
    expect(approvalsEnded).toEqual([]);

    // The webhook arriving late finds nothing new to say.
    await caseDelivery({ verification, status: 'Needs more information', minutesAfterT0: -60 });
    expect(outbox.notifications).toHaveLength(1);
  });

  it("keeps a decided organization's Decision against a newer undecided inquiry, and waits the cadence to read it again", async () => {
    const { verification, store, persona, outbox, clock, seedRecord } = setupOrganization();
    const decidedAt = new Date(T0.getTime() - 7 * 60 * MINUTE);
    seedRecord({
      status: 'approved',
      personaCaseId: 'case_1',
      personaCaseStatus: 'Approved',
      sourceAt: decidedAt,
      statusChangedAt: decidedAt,
      lastSyncedAt: decidedAt
    });
    seedCompletedBusinessInquiry({ persona, at: decidedAt, caseStatus: 'Approved' });
    // A second business inquiry someone opened in the dashboard, never finished.
    const openedAt = new Date(T0.getTime() - 60 * MINUTE);
    persona.inquiries.set('inq_second', {
      ...persona.inquiries.get('inq_seeded')!,
      id: 'inq_second',
      status: 'pending',
      createdAt: openedAt,
      updatedAt: openedAt
    });

    // Refused before anything is queued, and confirmed: the next sweep does not read it again.
    expect(await verification.reconcile({ now: T0 })).toMatchObject({ checked: 1, changed: 0 });
    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'approved',
      personaInquiryId: 'inq_seeded',
      lastSyncedAt: T0
    });
    expect(outbox.notifications).toHaveLength(0);
    clock.advance(15 * MINUTE);
    expect(await verification.reconcile({ now: clock.clock.now() })).toMatchObject({ checked: 0 });
  });

  it("announces nothing when the sweep finds the organization's own case, still decided, through a newer inquiry", async () => {
    const { verification, store, persona, outbox, seedRecord } = setupOrganization();
    const decidedAt = new Date(T0.getTime() - 7 * 60 * MINUTE);
    seedRecord({
      status: 'approved',
      personaCaseId: 'case_1',
      personaCaseStatus: 'Approved',
      sourceAt: decidedAt,
      statusChangedAt: decidedAt,
      lastSyncedAt: decidedAt
    });
    seedCompletedBusinessInquiry({ persona, at: decidedAt });
    // A reviewer attached a second business inquiry to the case, which stays approved.
    const attachedAt = new Date(T0.getTime() - 60 * MINUTE);
    persona.inquiries.set('inq_second', {
      ...persona.inquiries.get('inq_seeded')!,
      id: 'inq_second',
      createdAt: attachedAt,
      updatedAt: attachedAt
    });
    persona.cases.set('case_1', {
      id: 'case_1',
      status: 'Approved',
      caseTemplateId: FAKE_KYB_CASE_TEMPLATE_ID,
      inquiryIds: ['inq_seeded', 'inq_second'],
      createdAt: decidedAt,
      updatedAt: attachedAt
    });

    expect(await verification.reconcile({ now: T0 })).toMatchObject({ checked: 1, changed: 0 });
    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'approved',
      personaInquiryId: 'inq_seeded',
      sourceAt: attachedAt,
      lastSyncedAt: T0
    });
    expect(outbox.notifications).toHaveLength(0);

    // The read advanced `sourceAt`: a decline delivered late, from before it, cannot land.
    await caseDelivery({ verification, status: 'Declined', minutesAfterT0: -120, id: 'evt_late_decline' });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'approved' });
  });

  it("takes the Decision back when the sweep finds the organization's own case reopened through a newer inquiry", async () => {
    const { verification, store, persona, outbox, seedRecord } = setupOrganization();
    const decidedAt = new Date(T0.getTime() - 7 * 60 * MINUTE);
    seedRecord({
      status: 'approved',
      personaCaseId: 'case_1',
      personaCaseStatus: 'Approved',
      sourceAt: decidedAt,
      statusChangedAt: decidedAt,
      lastSyncedAt: decidedAt
    });
    seedCompletedBusinessInquiry({ persona, at: decidedAt });
    // A reviewer attached a second business inquiry to the case and reopened it; the webhook was lost.
    const reopenedAt = new Date(T0.getTime() - 60 * MINUTE);
    persona.inquiries.set('inq_second', {
      ...persona.inquiries.get('inq_seeded')!,
      id: 'inq_second',
      createdAt: reopenedAt,
      updatedAt: reopenedAt
    });
    persona.cases.set('case_1', {
      id: 'case_1',
      status: 'Open',
      caseTemplateId: FAKE_KYB_CASE_TEMPLATE_ID,
      inquiryIds: ['inq_seeded', 'inq_second'],
      createdAt: decidedAt,
      updatedAt: reopenedAt
    });

    expect(await verification.reconcile({ now: T0 })).toMatchObject({ checked: 1, changed: 1 });
    // The case is what the record follows, so it stays on the inquiry it started on.
    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'pending_review',
      personaInquiryId: 'inq_seeded',
      personaCaseStatus: 'Open'
    });
    expect(outbox.notifications).toEqual([
      expect.objectContaining({ kind: 'status_email', reopenedFrom: 'approved' }),
      expect.objectContaining({ kind: 'operator_message', reopenedFrom: 'approved' })
    ]);
  });

  it("still finds a lost reopen of the organization's case behind a newer, unfinished business inquiry", async () => {
    const { verification, store, persona, outbox, seedRecord } = setupOrganization();
    const decidedAt = new Date(T0.getTime() - 7 * 60 * MINUTE);
    seedRecord({
      status: 'approved',
      personaCaseId: 'case_1',
      personaCaseStatus: 'Approved',
      sourceAt: decidedAt,
      statusChangedAt: decidedAt,
      lastSyncedAt: decidedAt
    });
    seedCompletedBusinessInquiry({ persona, at: decidedAt, caseStatus: 'Approved' });
    // A second business inquiry someone opened in the dashboard and never finished, then a reopen whose webhook was lost.
    const openedAt = new Date(T0.getTime() - 2 * 60 * MINUTE);
    persona.inquiries.set('inq_second', {
      ...persona.inquiries.get('inq_seeded')!,
      id: 'inq_second',
      status: 'pending',
      createdAt: openedAt,
      updatedAt: openedAt
    });
    persona.cases.get('case_1')!.status = 'Open';
    persona.cases.get('case_1')!.updatedAt = new Date(T0.getTime() - 60 * MINUTE);

    expect(await verification.reconcile({ now: T0 })).toMatchObject({ checked: 1, changed: 1 });
    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'pending_review',
      personaInquiryId: 'inq_seeded',
      personaCaseStatus: 'Open'
    });
    expect(outbox.notifications).toEqual([
      expect.objectContaining({ kind: 'status_email', reopenedFrom: 'approved' }),
      expect.objectContaining({ kind: 'operator_message', reopenedFrom: 'approved' })
    ]);
  });

  it("leaves a second case on the organization's inquiry to the webhook's alert, never applying it in the sweep", async () => {
    const { verification, store, persona, outbox, seedRecord } = setupOrganization();
    const decidedAt = new Date(T0.getTime() - 7 * 60 * MINUTE);
    seedRecord({
      status: 'approved',
      personaCaseId: 'case_1',
      personaCaseStatus: 'Approved',
      sourceAt: decidedAt,
      statusChangedAt: decidedAt,
      lastSyncedAt: decidedAt
    });
    seedCompletedBusinessInquiry({ persona, at: decidedAt, caseStatus: 'Approved' });
    persona.cases.set('case_2', {
      id: 'case_2',
      status: 'Declined',
      caseTemplateId: FAKE_KYB_CASE_TEMPLATE_ID,
      inquiryIds: ['inq_seeded'],
      createdAt: T0,
      updatedAt: T0
    });

    // The webhook names the conflict for a person to settle…
    await expect(caseDelivery({ verification, caseId: 'case_2', status: 'Declined' })).resolves.toMatchObject({
      ok: true,
      value: { outcome: 'ignored', reason: 'conflicting_case', caseId: 'case_2' }
    });
    // …and the sweep keeps following the case the record holds.
    expect(await verification.reconcile({ now: T0 })).toMatchObject({ checked: 1, changed: 0 });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'approved', personaCaseId: 'case_1' });
    expect(outbox.notifications).toHaveLength(0);
  });

  it('re-reads a completed organization through its case: in review while it is open, decided once it is resolved', async () => {
    const { verification, store, persona, outbox, clock, seedRecord } = setupOrganization();
    const stale = new Date(T0.getTime() - 45 * MINUTE);
    seedRecord({ status: 'submitted', statusChangedAt: stale, lastSyncedAt: stale });
    seedCompletedBusinessInquiry({ persona, at: stale });

    // No case yet — the Workflow has not run: confirmed, still submitted.
    expect(await verification.reconcile({ now: T0 })).toMatchObject({ checked: 1, changed: 0 });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'submitted', lastSyncedAt: T0 });

    // The Workflow opened the case and the webhook was lost: the next sweep reads the case.
    clock.advance(31 * MINUTE);
    seedCompletedBusinessInquiry({ persona, at: stale, caseStatus: 'Waiting on UBOs' });
    persona.cases.get('case_1')!.updatedAt = new Date(T0.getTime() + 10 * MINUTE);
    expect(await verification.reconcile({ now: clock.clock.now() })).toMatchObject({ checked: 1, changed: 1 });
    const inReview = store.records.get(USER_ID);
    expect(inReview).toMatchObject({
      status: 'pending_review',
      personaCaseId: 'case_1',
      personaCaseStatus: 'Waiting on UBOs',
      statusChangedAt: new Date(T0.getTime() + 10 * MINUTE)
    });
    await expect(verification.getVerificationStatus({ userId: USER_ID })).resolves.toMatchObject({
      caseWaitingOn: 'people'
    });

    // The owners finished: a raw move the read records without a transition.
    clock.advance(7 * 60 * MINUTE);
    persona.cases.get('case_1')!.status = 'Ready for Review';
    persona.cases.get('case_1')!.updatedAt = new Date(T0.getTime() + 6 * 60 * MINUTE);
    expect(await verification.reconcile({ now: clock.clock.now() })).toMatchObject({ checked: 1, changed: 0 });
    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'pending_review',
      personaCaseStatus: 'Ready for Review',
      statusChangedAt: inReview?.statusChangedAt
    });
    await expect(verification.getVerificationStatus({ userId: USER_ID })).resolves.toMatchObject({
      caseWaitingOn: 'team'
    });

    // Resolved, webhook lost again: the decision lands on the next read, with its notifications.
    clock.advance(7 * 60 * MINUTE);
    persona.cases.get('case_1')!.status = 'Approved';
    persona.cases.get('case_1')!.updatedAt = new Date(T0.getTime() + 13 * 60 * MINUTE);
    expect(await verification.reconcile({ now: clock.clock.now() })).toMatchObject({ checked: 1, changed: 1 });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'approved', personaCaseStatus: 'Approved' });
    expect(outbox.notifications.map((job) => `${job.kind}:${job.status}`)).toEqual([
      'status_email:pending_review',
      'operator_message:pending_review',
      'case_status:pending_review',
      'status_email:approved',
      'operator_message:approved'
    ]);
  });

  it('prefers a decided case to a newer open one made by hand, and ignores a case on another template', async () => {
    const { verification, store, persona, seedRecord } = setupOrganization();
    const stale = new Date(T0.getTime() - 45 * MINUTE);
    seedRecord({ status: 'pending_review', personaCaseId: 'case_1', statusChangedAt: stale, lastSyncedAt: stale });
    seedCompletedBusinessInquiry({ persona, at: stale, caseStatus: 'Declined' });
    seedCompletedBusinessInquiry({
      persona,
      at: new Date(T0.getTime() - MINUTE),
      caseStatus: 'Open',
      caseId: 'case_2'
    });
    seedCompletedBusinessInquiry({
      persona,
      at: T0,
      caseStatus: 'Approved',
      caseId: 'case_kabc',
      caseTemplateId: 'ctmpl_kabc'
    });
    persona.cases.get('case_1')!.updatedAt = new Date(T0.getTime() - MINUTE);

    expect(await verification.reconcile({ now: new Date(T0.getTime() + 7 * 60 * MINUTE) })).toMatchObject({
      changed: 1
    });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'declined', personaCaseId: 'case_1' });
  });

  it('leaves an organization as it is on a resync while its flow is not configured', async () => {
    const { verification, store, seedRecord } = setup();
    store.profiles.set(USER_ID, ORGANIZATION_PROFILE);
    seedRecord({ status: 'revoked' });

    await expect(verification.resyncFromPersona({ userId: USER_ID })).resolves.toEqual({
      ok: true,
      value: { from: 'revoked', to: 'revoked', inquiryId: null, path: 'organization', case: null }
    });
    expect(store.records.get(USER_ID)?.status).toBe('revoked');
  });

  it('confirms an organization the sweep cannot read while its flow is not configured, so it waits its cadence', async () => {
    const { verification, store, persona, clock, seedRecord } = setup();
    store.profiles.set(USER_ID, ORGANIZATION_PROFILE);
    const stale = new Date(T0.getTime() - 7 * 60 * MINUTE);
    seedRecord({ status: 'pending_review', statusChangedAt: stale, lastSyncedAt: stale });

    expect(await verification.reconcile({ now: T0 })).toMatchObject({ checked: 1, changed: 0 });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'pending_review', lastSyncedAt: T0 });
    expect(persona.calls).toHaveLength(0);
    clock.advance(15 * MINUTE);
    expect(await verification.reconcile({ now: clock.clock.now() })).toMatchObject({ checked: 0 });
  });

  it("releases a revoked organization to its case's decision on a resync", async () => {
    const { verification, store, persona, seedRecord } = setupOrganization();
    seedRecord({
      status: 'revoked',
      personaCaseId: 'case_1',
      personaCaseStatus: 'Approved',
      statusChangedAt: new Date(T0.getTime() + MINUTE)
    });
    seedCompletedBusinessInquiry({ persona, at: T0, caseStatus: 'Approved' });

    await expect(verification.resyncFromPersona({ userId: USER_ID })).resolves.toEqual({
      ok: true,
      value: {
        from: 'revoked',
        to: 'approved',
        inquiryId: 'inq_seeded',
        path: 'organization',
        case: { id: 'case_1', status: 'Approved' }
      }
    });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'approved', personaCaseStatus: 'Approved' });
  });

  it('never lets a read that a webhook overtook overwrite the newer raw case status, nor ping again', async () => {
    const { verification, store, outbox, persona, seedRecord } = setupOrganization();
    const stale = new Date(T0.getTime() - 45 * MINUTE);
    seedRecord({
      status: 'pending_review',
      personaCaseId: 'case_1',
      personaCaseStatus: 'Waiting on UBOs',
      statusChangedAt: stale,
      lastSyncedAt: stale
    });
    // Persona, as the sweep lists it: still waiting on the owners, last moved a minute ago.
    seedCompletedBusinessInquiry({ persona, at: stale, caseStatus: 'Waiting on UBOs' });
    persona.cases.get('case_1')!.updatedAt = new Date(T0.getTime() - MINUTE);
    // Meanwhile the webhook landed the approval, inside the same second as that read.
    await caseDelivery({ verification, status: 'Approved', minutesAfterT0: -1 });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'approved', personaCaseStatus: 'Approved' });
    const announced = outbox.notifications.length;

    await verification.reconcile({ now: new Date(T0.getTime() + 7 * 60 * MINUTE) });

    expect(store.records.get(USER_ID)).toMatchObject({ status: 'approved', personaCaseStatus: 'Approved' });
    expect(outbox.notifications).toHaveLength(announced);
  });

  it('never lets a delivery retried after a later move write that later status as if nothing had changed', async () => {
    const { verification, store, seedRecord } = setupOrganization();
    seedRecord({
      status: 'pending_review',
      personaCaseId: 'case_1',
      personaCaseStatus: 'Ready for Review',
      statusChangedAt: new Date(T0.getTime() + 2 * MINUTE)
    });

    // A `case.created` from before the review whose body, however it was rendered, carries a later status.
    await expect(
      caseDelivery({ verification, name: 'case.created', status: 'Approved', minutesAfterT0: 1 })
    ).resolves.toEqual({
      ok: true,
      value: { outcome: 'unchanged' }
    });
    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'pending_review',
      personaCaseStatus: 'Ready for Review'
    });
  });

  it('reads the case for a business inquiry a Workflow marked for review, as for a completed one', async () => {
    const { verification, store, persona, seedRecord } = setupOrganization();
    const stale = new Date(T0.getTime() - 45 * MINUTE);
    seedRecord({ status: 'pending_review', statusChangedAt: stale, lastSyncedAt: stale });
    seedCompletedBusinessInquiry({ persona, at: stale, caseStatus: 'Approved' });
    persona.inquiries.get('inq_seeded')!.status = 'needs_review';
    persona.cases.get('case_1')!.updatedAt = new Date(T0.getTime() - MINUTE);

    expect(await verification.reconcile({ now: new Date(T0.getTime() + 7 * 60 * MINUTE) })).toMatchObject({
      changed: 1
    });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'approved', personaCaseId: 'case_1' });
  });

  it("names a case that lists two records' inquiries", async () => {
    const { verification, store, seedRecord } = setupOrganization();
    seedRecord({ status: 'submitted' });
    store.profiles.set('u-other', ORGANIZATION_PROFILE);
    seedRecord({ userId: 'u-other', status: 'submitted', personaInquiryId: 'inq_owner' });

    await expect(caseDelivery({ verification, status: 'Waiting on UBOs' })).resolves.toMatchObject({
      ok: true,
      value: { outcome: 'ignored', reason: 'conflicting_case', caseId: 'case_1' }
    });
    expect(store.records.get(USER_ID)?.status).toBe('submitted');
  });

  it('answers unavailable when the cases cannot be read, and leaves the record for the next sweep', async () => {
    const { verification, store, persona, seedRecord } = setupOrganization();
    const stale = new Date(T0.getTime() - 45 * MINUTE);
    seedRecord({ status: 'submitted', statusChangedAt: stale, lastSyncedAt: stale });
    seedCompletedBusinessInquiry({ persona, at: stale, caseStatus: 'Approved' });
    persona.failNextCall({ reason: 'network', message: 'ECONNRESET' }, 'listCases');

    expect(await verification.reconcile({ now: T0 })).toMatchObject({ checked: 1, changed: 0, unavailable: 1 });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'submitted', lastSyncedAt: stale });
  });

  it('splits the review backlog between organizations waiting on their owners and everyone waiting on the team', async () => {
    const { verification, clock, store, seedRecord } = setupOrganization();
    const twoDaysAgo = new Date(T0.getTime() - 2 * 24 * 60 * MINUTE);
    const inReview = { status: 'pending_review', statusChangedAt: twoDaysAgo, lastSyncedAt: T0 } as const;
    seedRecord({ userId: USER_ID, ...inReview, personaCaseId: 'case_1', personaCaseStatus: 'Waiting on UBOs' });
    store.profiles.set('u-org-team', ORGANIZATION_PROFILE);
    seedRecord({ userId: 'u-org-team', ...inReview, personaCaseId: 'case_2', personaCaseStatus: 'Ready for Review' });
    store.profiles.set('u-person', INDIVIDUAL_PROFILE);
    seedRecord({ userId: 'u-person', ...inReview });

    const report = await verification.reconcile({ now: clock.clock.now() });

    expect(report).toMatchObject({ awaitingReview: 2, awaitingOwners: 1 });
  });

  it("emails an organization whose business inquiry failed, where an individual's failure emails nobody", async () => {
    const org = setupOrganization();
    org.seedRecord({ status: 'in_progress' });
    await delivery({
      verification: org.verification,
      name: 'inquiry.failed',
      status: 'failed',
      templateId: FAKE_KYB_TEMPLATE_ID
    });
    expect(org.outbox.notifications.map((job) => `${job.kind}:${job.status}`)).toEqual([
      'status_email:failed',
      'operator_message:failed'
    ]);

    // An organization with no row yet (a start whose write was lost) is told all the same.
    const unrecorded = setupOrganization();
    await delivery({
      verification: unrecorded.verification,
      name: 'inquiry.failed',
      status: 'failed',
      templateId: FAKE_KYB_TEMPLATE_ID
    });
    expect(unrecorded.outbox.notifications.map((job) => `${job.kind}:${job.status}`)).toEqual([
      'status_email:failed',
      'operator_message:failed'
    ]);

    const individual = setup();
    individual.seedRecord({ status: 'in_progress' });
    await delivery({ verification: individual.verification, name: 'inquiry.failed', status: 'failed' });
    expect(individual.outbox.notifications.map((job) => `${job.kind}:${job.status}`)).toEqual([
      'operator_message:failed'
    ]);
  });

  it("tells the review email who the organization's case waits on", async () => {
    const { verification, emails, seedRecord } = setupOrganization();
    const seeded = seedRecord({
      status: 'pending_review',
      personaCaseId: 'case_1',
      personaCaseStatus: 'Waiting on UBOs'
    });

    await verification.deliverNotification({
      notification: {
        kind: 'status_email',
        userId: USER_ID,
        inquiryId: 'inq_seeded',
        status: 'pending_review',
        statusChangedAt: seeded.statusChangedAt
      }
    });

    expect(emails.sent).toEqual([
      expect.objectContaining({ status: 'pending_review', accountType: 'organization', caseWaitingOn: 'people' })
    ]);
  });

  it("counts an organization's undecided submission like an individual's", async () => {
    const { verification, clock, seedRecord } = setupOrganization();
    const twoHoursAgo = new Date(T0.getTime() - 2 * 60 * MINUTE);
    seedRecord({ status: 'submitted', statusChangedAt: twoHoursAgo, lastSyncedAt: twoHoursAgo });

    const report = await verification.reconcile({ now: clock.clock.now() });

    expect(report).toMatchObject({ checked: 1, undecided: 1 });
  });
});
