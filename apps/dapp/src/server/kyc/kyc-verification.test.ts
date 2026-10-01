import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { type KycStatus, kycStatusValues } from '@zivoe/database/kyc';

import { type KycNotification, type KycVerificationRecord, createKycVerification } from './kyc-verification';
import {
  FAKE_TEMPLATE_ID,
  FAKE_TEMPLATE_VERSION_ID,
  createFakePersonaApi,
  createInMemoryKycStore,
  createInMemoryOperatorMessenger,
  createInMemoryOutbox,
  createInMemoryStatusEmailSender,
  createManualClock
} from './kyc-verification.fakes';

const USER_ID = '7b6f9a1e-0c1d-4e6f-9a2b-3c4d5e6f7a8b';
const T0 = new Date('2026-08-22T10:00:00.000Z');
const WEBHOOK_SECRET = 'test-secret';
const MINUTE = 60_000;

const INDIVIDUAL_PROFILE = {
  accountType: 'individual',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  countryCode: 'GB'
} as const;

function setup() {
  const manualClock = createManualClock(T0);
  const memoryStore = createInMemoryKycStore();
  const fakePersona = createFakePersonaApi({ clock: manualClock.clock });
  const memoryOutbox = createInMemoryOutbox();
  const memoryEmails = createInMemoryStatusEmailSender();
  const memoryOperator = createInMemoryOperatorMessenger();

  const kyc = createKycVerification({
    store: memoryStore.store,
    persona: fakePersona.persona,
    outbox: memoryOutbox.outbox,
    statusEmails: memoryEmails.sender,
    operatorMessages: memoryOperator.messenger,
    clock: manualClock.clock,
    // Most fixtures name no template at all, so they also prove that such an inquiry is let through.
    config: { webhookSecret: WEBHOOK_SECRET, templateVersionId: FAKE_TEMPLATE_VERSION_ID, templateId: FAKE_TEMPLATE_ID }
  });

  memoryStore.profiles.set(USER_ID, INDIVIDUAL_PROFILE);

  const seedRecord = (overrides: Partial<KycVerificationRecord> & { status: KycStatus }) => {
    const record: KycVerificationRecord = {
      userId: USER_ID,
      personaInquiryId: 'inq_seeded',
      personaAccountId: 'act_seeded',
      attemptCount: 1,
      statusChangedAt: T0,
      lastSyncedAt: T0,
      ...overrides
    };
    memoryStore.records.set(record.userId, record);
    return record;
  };

  return {
    kyc,
    clock: manualClock,
    store: memoryStore,
    persona: fakePersona,
    outbox: memoryOutbox,
    emails: memoryEmails,
    operator: memoryOperator,
    seedRecord
  };
}

describe('getKycStatus', () => {
  it('answers not_started for a user without a record', async () => {
    const { kyc, persona } = setup();

    await expect(kyc.getKycStatus({ userId: USER_ID })).resolves.toEqual({
      status: 'not_started',
      path: 'individual',
      canStart: true,
      canResume: false,
      inquiryId: null,
      attemptCount: 0
    });
    expect(persona.calls).toHaveLength(0);
  });

  // Who may do what from each stored status — the same table startKyc enforces.
  const EXPECTED_FLAGS: Record<KycStatus, { canStart: boolean; canResume: boolean }> = {
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

  it.each(kycStatusValues)('maps a stored %s record to its view', async (status) => {
    const { kyc, seedRecord, persona } = setup();
    seedRecord({ status, attemptCount: 1 });

    const view = await kyc.getKycStatus({ userId: USER_ID });

    expect(view).toEqual({
      status,
      path: 'individual',
      ...EXPECTED_FLAGS[status],
      inquiryId: EXPECTED_FLAGS[status].canResume ? 'inq_seeded' : null,
      attemptCount: 1
    });
    expect(persona.calls).toHaveLength(0);
  });

  it('puts organization accounts on the team path regardless of the stored status', async () => {
    const { kyc, store, seedRecord } = setup();
    store.profiles.set(USER_ID, { ...INDIVIDUAL_PROFILE, accountType: 'organization' });
    seedRecord({ status: 'manually_approved' });

    await expect(kyc.getKycStatus({ userId: USER_ID })).resolves.toEqual({
      status: 'manually_approved',
      path: 'organization',
      canStart: false,
      canResume: false,
      inquiryId: null,
      attemptCount: 1
    });
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
  kyc,
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
  kyc: ReturnType<typeof setup>['kyc'];
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
  return kyc.receiveWebhook({
    rawBody,
    signatureHeader: signatureHeader === undefined ? sign({ rawBody, secret, at: receivedAt }) : signatureHeader,
    receivedAt
  });
}

describe('receiveWebhook — signature', () => {
  it('accepts a correctly signed event', async () => {
    const { kyc, seedRecord } = setup();
    seedRecord({ status: 'in_progress' });

    await expect(delivery({ kyc, name: 'inquiry.completed', status: 'completed' })).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });
  });

  it('rejects a tampered body', async () => {
    const { kyc, seedRecord } = setup();
    seedRecord({ status: 'in_progress' });
    const rawBody = personaEvent({ name: 'inquiry.approved', createdAt: T0, status: 'approved' });
    const signatureHeader = sign({ rawBody, at: T0 });

    const result = await kyc.receiveWebhook({
      rawBody: rawBody.replace('"approved"', '"declined"'),
      signatureHeader,
      receivedAt: T0
    });

    expect(result).toEqual({ ok: false, error: { code: 'bad_signature' } });
  });

  it('rejects a signature made with another secret, and a missing header', async () => {
    const { kyc } = setup();

    await expect(delivery({ kyc, name: 'inquiry.approved', status: 'approved', secret: 'other' })).resolves.toEqual({
      ok: false,
      error: { code: 'bad_signature' }
    });
    await expect(
      delivery({ kyc, name: 'inquiry.approved', status: 'approved', signatureHeader: null })
    ).resolves.toEqual({ ok: false, error: { code: 'bad_signature' } });
  });

  it('rejects a valid signature whose timestamp is older than five minutes', async () => {
    const { kyc } = setup();
    const rawBody = personaEvent({ name: 'inquiry.approved', createdAt: T0, status: 'approved' });

    const result = await kyc.receiveWebhook({
      rawBody,
      signatureHeader: sign({ rawBody, at: T0 }),
      receivedAt: new Date(T0.getTime() + 6 * MINUTE)
    });

    expect(result).toEqual({ ok: false, error: { code: 'stale_timestamp' } });
  });

  it('accepts either set during secret rotation', async () => {
    const { kyc, seedRecord } = setup();
    seedRecord({ status: 'in_progress' });
    const rawBody = personaEvent({
      name: 'inquiry.completed',
      createdAt: new Date(T0.getTime() + 30_000),
      status: 'completed'
    });
    const receivedAt = new Date(T0.getTime() + MINUTE);
    const oldSet = sign({ rawBody, secret: 'retired-secret', at: receivedAt });
    const newSet = sign({ rawBody, at: receivedAt });

    await expect(kyc.receiveWebhook({ rawBody, signatureHeader: `${oldSet} ${newSet}`, receivedAt })).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });
  });

  it('checks every v1 a set carries, not just the last one', async () => {
    const { kyc, seedRecord } = setup();
    seedRecord({ status: 'in_progress' });
    const rawBody = personaEvent({
      name: 'inquiry.completed',
      createdAt: new Date(T0.getTime() + 30_000),
      status: 'completed'
    });
    const receivedAt = new Date(T0.getTime() + MINUTE);
    const [t, good] = sign({ rawBody, at: receivedAt }).split(',');

    await expect(
      kyc.receiveWebhook({ rawBody, signatureHeader: `${t},${good},v1=${'0'.repeat(64)}`, receivedAt })
    ).resolves.toEqual({ ok: true, value: { outcome: 'applied' } });
  });

  it('reports a body that is not a Persona event as malformed', async () => {
    const { kyc } = setup();
    const rawBody = '{"data":{"id":"evt_1"}}';

    await expect(
      kyc.receiveWebhook({ rawBody, signatureHeader: sign({ rawBody, at: T0 }), receivedAt: T0 })
    ).resolves.toEqual({ ok: false, error: { code: 'malformed' } });
  });

  it('refuses an oversized body as oversized before looking at the signature', async () => {
    const { kyc } = setup();
    const rawBody = '0'.repeat(1_000_001);

    await expect(kyc.receiveWebhook({ rawBody, signatureHeader: null, receivedAt: T0 })).resolves.toEqual({
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
    const { kyc, seedRecord, store } = setup();
    seedRecord({ status: 'in_progress' });

    await expect(delivery({ kyc, name, status: personaStatus })).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });

    const record = store.records.get(USER_ID);
    expect(record?.status).toBe(expected);
    expect(record?.statusChangedAt).toEqual(new Date(T0.getTime() + MINUTE));
  });

  it('answers an ops event with ops_alert, touching no status, and dedupes its replay', async () => {
    const { kyc, seedRecord, store, outbox } = setup();
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

    await expect(kyc.receiveWebhook({ rawBody, signatureHeader, receivedAt })).resolves.toEqual({
      ok: true,
      value: { outcome: 'ops_alert', eventName: 'workflow-run.errored', resourceId: 'wfr_1' }
    });
    await expect(kyc.receiveWebhook({ rawBody, signatureHeader, receivedAt })).resolves.toEqual({
      ok: true,
      value: { outcome: 'duplicate' }
    });
    expect(store.records.get(USER_ID)?.status).toBe('submitted');
    expect(outbox.notifications).toHaveLength(0);
  });

  it('ignores an event we do not subscribe to', async () => {
    const { kyc, seedRecord, store } = setup();
    seedRecord({ status: 'in_progress' });

    await expect(delivery({ kyc, name: 'inquiry.transitioned', status: 'pending' })).resolves.toEqual({
      ok: true,
      value: { outcome: 'ignored', reason: 'unsubscribed_event', eventName: 'inquiry.transitioned' }
    });
    expect(store.records.get(USER_ID)?.status).toBe('in_progress');
    expect(store.events.size).toBe(0);
  });

  it('ignores an inquiry status the mapping does not cover, naming the drift', async () => {
    const { kyc, seedRecord, store } = setup();
    seedRecord({ status: 'in_progress' });

    await expect(delivery({ kyc, name: 'inquiry.approved', status: 'quarantined' })).resolves.toEqual({
      ok: true,
      value: { outcome: 'ignored', reason: 'unmapped_status', eventName: 'inquiry.approved' }
    });
    expect(store.records.get(USER_ID)?.status).toBe('in_progress');
    expect(store.events.size).toBe(0);
  });

  it('answers a replayed event id with duplicate and neither writes nor enqueues again', async () => {
    const { kyc, seedRecord, store, outbox } = setup();
    seedRecord({ status: 'submitted' });

    await delivery({ kyc, name: 'inquiry.approved', status: 'approved', id: 'evt_once' });
    const approvedAt = store.records.get(USER_ID)?.lastSyncedAt;
    const replay = await delivery({
      kyc,
      name: 'inquiry.approved',
      status: 'approved',
      id: 'evt_once',
      minutesAfterT0: 30
    });

    expect(replay).toEqual({ ok: true, value: { outcome: 'duplicate' } });
    expect(store.records.get(USER_ID)?.lastSyncedAt).toEqual(approvedAt);
    expect(outbox.notifications).toHaveLength(2);
  });

  it('does not regress on an out-of-order delivery (completed arriving after approved)', async () => {
    const { kyc, seedRecord, store } = setup();
    seedRecord({ status: 'in_progress' });

    await delivery({ kyc, name: 'inquiry.approved', status: 'approved', id: 'evt_a', minutesAfterT0: 10 });
    await delivery({ kyc, name: 'inquiry.completed', status: 'completed', id: 'evt_b', minutesAfterT0: 5 });

    expect(store.records.get(USER_ID)?.status).toBe('approved');
  });

  it('never replaces a Decision with a non-Decision from the same inquiry, even a newer one', async () => {
    const { kyc, seedRecord, store } = setup();
    seedRecord({ status: 'approved', statusChangedAt: T0 });

    await delivery({ kyc, name: 'inquiry.expired', status: 'expired', minutesAfterT0: 60 });

    expect(store.records.get(USER_ID)?.status).toBe('approved');
  });

  it('answers unchanged, not applied, for an event older than the record', async () => {
    const { kyc, seedRecord, store } = setup();
    seedRecord({ status: 'approved', statusChangedAt: new Date(T0.getTime() + 10 * MINUTE) });

    await expect(delivery({ kyc, name: 'inquiry.completed', status: 'completed', minutesAfterT0: 5 })).resolves.toEqual(
      {
        ok: true,
        value: { outcome: 'unchanged' }
      }
    );
    expect(store.records.get(USER_ID)?.status).toBe('approved');
  });

  it('ignores an event for an inquiry that is no longer the current one', async () => {
    const { kyc, seedRecord, store } = setup();
    seedRecord({ status: 'in_progress', personaInquiryId: 'inq_retry' });

    const result = await delivery({
      kyc,
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
    const { kyc, seedRecord, store } = setup();
    // Declined a minute before the follow-up inquiry (created at T0) existed.
    seedRecord({ status: 'declined', statusChangedAt: new Date(T0.getTime() - MINUTE) });

    const result = await delivery({ kyc, name: 'inquiry.approved', status: 'approved', inquiryId: 'inq_follow_up' });

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
      const { kyc, seedRecord, store, outbox } = setup();
      seedRecord({ status });

      await delivery({ kyc, name: 'inquiry.approved', status: 'approved', minutesAfterT0: 60 });
      await delivery({ kyc, name: 'inquiry.declined', status: 'declined', id: 'evt_2', minutesAfterT0: 61 });

      expect(store.records.get(USER_ID)?.status).toBe(status);
      expect(outbox.notifications).toHaveLength(0);
    }
  );

  it('creates the record for a user who has none (inquiry made in the dashboard)', async () => {
    const { kyc, store } = setup();

    await expect(
      delivery({ kyc, name: 'inquiry.completed', status: 'completed', inquiryId: 'inq_dash' })
    ).resolves.toEqual({ ok: true, value: { outcome: 'applied' } });

    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'submitted',
      personaInquiryId: 'inq_dash',
      personaAccountId: 'act_seeded',
      attemptCount: 1
    });
  });

  it("ignores another template's inquiry, even under a user's reference id", async () => {
    const { kyc, store, outbox } = setup();

    const result = await delivery({
      kyc,
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
    const { kyc, seedRecord, store } = setup();
    seedRecord({ status: 'submitted' });

    await delivery({ kyc, name: 'inquiry.approved', status: 'approved', templateId: FAKE_TEMPLATE_ID });

    expect(store.records.get(USER_ID)?.status).toBe('approved');
  });

  it('ignores an inquiry that carries no reference id', async () => {
    const { kyc, store } = setup();

    await expect(delivery({ kyc, name: 'inquiry.approved', status: 'approved', referenceId: null })).resolves.toEqual({
      ok: true,
      value: { outcome: 'ignored', reason: 'foreign_inquiry', eventName: 'inquiry.approved' }
    });
    expect(store.records.size).toBe(0);
  });

  it('ignores an inquiry for a user id the app no longer has, without enqueueing anything', async () => {
    const { kyc, store, outbox } = setup();
    store.profiles.delete(USER_ID);

    await expect(delivery({ kyc, name: 'inquiry.expired', status: 'expired' })).resolves.toEqual({
      ok: true,
      value: { outcome: 'ignored', reason: 'foreign_inquiry', eventName: 'inquiry.expired' }
    });
    expect(store.records.size).toBe(0);
    expect(outbox.notifications).toHaveLength(0);
  });

  it('ignores a reference id that is not a user id rather than failing on it', async () => {
    const { kyc, store } = setup();

    await expect(
      delivery({ kyc, name: 'inquiry.approved', status: 'approved', referenceId: 'dashboard-test-user' })
    ).resolves.toEqual({
      ok: true,
      value: { outcome: 'ignored', reason: 'foreign_inquiry', eventName: 'inquiry.approved' }
    });
    expect(store.records.size).toBe(0);
  });

  it('surfaces a store failure as store_failure so the caller can ask for a retry', async () => {
    const { kyc, seedRecord, store } = setup();
    seedRecord({ status: 'in_progress' });
    store.failNextCall(new Error('connection reset'), 'upsert');

    const result = await delivery({ kyc, name: 'inquiry.approved', status: 'approved' });

    expect(result).toMatchObject({ ok: false, error: { code: 'store_failure' } });
  });

  it('lets the retry of a delivery that failed mid-write apply it', async () => {
    const { kyc, seedRecord, store, outbox } = setup();
    seedRecord({ status: 'submitted' });
    store.failNextCall(new Error('connection reset'), 'upsert');

    const failed = await delivery({ kyc, name: 'inquiry.approved', status: 'approved', id: 'evt_retry' });
    const retried = await delivery({ kyc, name: 'inquiry.approved', status: 'approved', id: 'evt_retry' });

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
    const { kyc, seedRecord, store, outbox } = setup();
    seedRecord({ status: 'submitted' });
    outbox.failNextCall(new Error('qstash down'));

    const result = await delivery({ kyc, name: 'inquiry.approved', status: 'approved' });

    expect(result).toMatchObject({ ok: false, error: { code: 'outbox_failure' } });
    expect(store.records.get(USER_ID)?.status).toBe('submitted');
    expect(store.events.size).toBe(0);
  });
});

describe('receiveWebhook — notifications', () => {
  const byKind = (notifications: Array<KycNotification>) => notifications.map((n) => `${n.kind}:${n.status}`);

  it.each([
    ['inquiry.approved', 'approved', ['status_email:approved', 'operator_message:approved']],
    ['inquiry.declined', 'declined', ['status_email:declined', 'operator_message:declined']],
    ['inquiry.marked-for-review', 'needs_review', ['status_email:pending_review', 'operator_message:pending_review']],
    ['inquiry.failed', 'failed', ['operator_message:failed']],
    ['inquiry.expired', 'expired', ['status_email:expired']],
    ['inquiry.completed', 'completed', ['operator_message:submitted']]
  ] as const)('%s enqueues %j', async (name, personaStatus, expected) => {
    const { kyc, seedRecord, outbox } = setup();
    seedRecord({ status: 'in_progress' });

    await delivery({ kyc, name, status: personaStatus });

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
    const { kyc, seedRecord, outbox } = setup();
    seedRecord({ status: 'pending_review' });

    await delivery({ kyc, name: 'inquiry.marked-for-review', status: 'needs_review' });

    expect(outbox.notifications).toHaveLength(0);
  });

  it('does not email an expiry for an inquiry the app never had a record of, but still records it', async () => {
    const { kyc, store, outbox } = setup();

    await expect(delivery({ kyc, name: 'inquiry.expired', status: 'expired', inquiryId: 'inq_dash' })).resolves.toEqual(
      { ok: true, value: { outcome: 'applied' } }
    );

    expect(store.records.get(USER_ID)).toMatchObject({ status: 'expired', personaInquiryId: 'inq_dash' });
    expect(outbox.notifications).toHaveLength(0);
  });
});

describe('startKyc', () => {
  it('creates a prefilled inquiry for a user without a record and records attempt 1', async () => {
    const { kyc, store, persona } = setup();

    const result = await kyc.startKyc({ userId: USER_ID });

    expect(result).toEqual({ ok: true, value: { inquiryId: 'inq_1', sessionToken: 'session_inq_1_1' } });
    expect(persona.calls).toEqual([
      { method: 'listInquiries', input: { referenceId: USER_ID } },
      {
        method: 'createInquiry',
        input: {
          referenceId: USER_ID,
          prefill: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', countryCode: 'GB' },
          idempotencyKey: expect.any(String)
        }
      }
    ]);
    expect(store.records.get(USER_ID)).toEqual({
      userId: USER_ID,
      status: 'in_progress',
      personaInquiryId: 'inq_1',
      personaAccountId: `act_${USER_ID}`,
      attemptCount: 1,
      statusChangedAt: T0,
      lastSyncedAt: T0
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
    await first.kyc.startKyc({ userId: USER_ID });
    const second = setup();
    await second.kyc.startKyc({ userId: USER_ID });

    expect(keyOf(first.persona.calls)).toMatch(/^[0-9a-f-]{36}$/);
    expect(keyOf(second.persona.calls)).toMatch(/^[0-9a-f-]{36}$/);
    expect(keyOf(second.persona.calls)).not.toBe(keyOf(first.persona.calls));
  });

  it('announces a handed-out session to operators, on create and on resume', async () => {
    const { kyc, seedRecord, persona, outbox } = setup();

    await kyc.startKyc({ userId: USER_ID });
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
    await kyc.startKyc({ userId: USER_ID });
    expect(outbox.notifications.map((n) => `${n.kind}:${n.status}:${n.inquiryId}`)).toEqual([
      'operator_message:in_progress:inq_seeded'
    ]);
  });

  it('still starts when the operator ping cannot be enqueued', async () => {
    const { kyc, store, outbox } = setup();
    outbox.failNextCall(new Error('qstash down'));

    const result = await kyc.startKyc({ userId: USER_ID });

    expect(result).toMatchObject({ ok: true, value: { inquiryId: 'inq_1' } });
    expect(store.records.get(USER_ID)?.status).toBe('in_progress');
    expect(outbox.notifications).toHaveLength(0);
  });

  it('hands out the session within seconds when the operator ping hangs', async () => {
    const s = setup();
    // A queue that never answers — the QStash client has no deadline of its own.
    const kyc = createKycVerification({
      store: s.store.store,
      statusEmails: s.emails.sender,
      operatorMessages: s.operator.messenger,
      persona: s.persona.persona,
      clock: s.clock.clock,
      outbox: { enqueue: () => new Promise<void>(() => undefined) },
      config: { webhookSecret: WEBHOOK_SECRET, templateVersionId: FAKE_TEMPLATE_VERSION_ID }
    });

    vi.useFakeTimers();
    try {
      const started = kyc.startKyc({ userId: USER_ID });
      await vi.advanceTimersByTimeAsync(5_000);

      expect(await started).toMatchObject({ ok: true, value: { inquiryId: 'inq_1' } });
      expect(s.store.records.get(USER_ID)?.status).toBe('in_progress');
    } finally {
      vi.useRealTimers();
    }
  });

  it('resumes an inquiry Persona already holds for a user the app has no record of', async () => {
    const { kyc, store, persona, outbox } = setup();
    persona.inquiries.set('inq_orphan', {
      id: 'inq_orphan',
      status: 'pending',
      referenceId: USER_ID,
      accountId: 'act_orphan',
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      createdAt: T0,
      updatedAt: T0
    });

    const result = await kyc.startKyc({ userId: USER_ID });

    expect(result).toMatchObject({ ok: true, value: { inquiryId: 'inq_orphan' } });
    expect(persona.calls.map((call) => call.method)).toEqual(['listInquiries', 'resumeInquiry']);
    expect(store.records.get(USER_ID)).toMatchObject({ personaInquiryId: 'inq_orphan', attemptCount: 1 });
    // The adoption already announced the session; the resume does not announce it again.
    expect(outbox.notifications.map((n) => `${n.kind}:${n.status}`)).toEqual(['operator_message:in_progress']);
  });

  it('creates a fresh inquiry when Persona no longer lists the one the record points at, at no attempt cost', async () => {
    const { kyc, store, persona, seedRecord } = setup();
    seedRecord({ status: 'in_progress', attemptCount: 1, personaInquiryId: 'inq_retained_away' });

    const result = await kyc.startKyc({ userId: USER_ID });

    expect(result).toMatchObject({ ok: true, value: { inquiryId: 'inq_1' } });
    expect(persona.calls.map((call) => call.method)).toEqual(['listInquiries', 'createInquiry']);
    expect(store.records.get(USER_ID)).toMatchObject({ personaInquiryId: 'inq_1', attemptCount: 1 });
  });

  it('creates a fresh inquiry when Persona has redacted the one the record points at, at no attempt cost', async () => {
    const { kyc, store, persona, seedRecord } = setup();
    seedRecord({ status: 'expired', attemptCount: 1 });
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

    const result = await kyc.startKyc({ userId: USER_ID });

    expect(result).toMatchObject({ ok: true, value: { inquiryId: 'inq_1' } });
    expect(persona.calls.map((call) => call.method)).toEqual(['listInquiries', 'createInquiry']);
    expect(store.records.get(USER_ID)).toMatchObject({ personaInquiryId: 'inq_1', attemptCount: 1 });
  });

  it('adopts a decided inquiry Persona holds for a user the app has no record of, then refuses', async () => {
    const { kyc, store, persona, outbox } = setup();
    persona.inquiries.set('inq_done', {
      id: 'inq_done',
      status: 'completed',
      referenceId: USER_ID,
      accountId: 'act_done',
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      createdAt: T0,
      updatedAt: T0
    });

    await expect(kyc.startKyc({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'awaiting_decision' }
    });
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'submitted', personaInquiryId: 'inq_done' });
    // The adoption announces the discovered submission to operators; no email exists for it.
    expect(outbox.notifications.map((n) => `${n.kind}:${n.status}`)).toEqual(['operator_message:submitted']);
  });

  it('resumes an in-progress inquiry with a fresh session token and no new attempt', async () => {
    const { kyc, store, persona, seedRecord } = setup();
    persona.inquiries.set('inq_seeded', {
      id: 'inq_seeded',
      status: 'pending',
      referenceId: USER_ID,
      accountId: 'act_seeded',
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      createdAt: T0,
      updatedAt: T0
    });
    seedRecord({ status: 'in_progress', attemptCount: 1 });

    const result = await kyc.startKyc({ userId: USER_ID });

    expect(result).toEqual({ ok: true, value: { inquiryId: 'inq_seeded', sessionToken: 'session_inq_seeded_1' } });
    // Always a fresh read first: a start never trusts the staleness gate.
    expect(persona.calls.map((call) => call.method)).toEqual(['listInquiries', 'resumeInquiry']);
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'in_progress', attemptCount: 1, statusChangedAt: T0 });
  });

  it('creates a fresh inquiry instead of resuming one made on an older template version, at no attempt', async () => {
    const { kyc, store, persona, seedRecord } = setup();
    persona.inquiries.set('inq_seeded', {
      id: 'inq_seeded',
      status: 'pending',
      referenceId: USER_ID,
      accountId: 'act_seeded',
      templateVersionId: 'itmplv_retired',
      createdAt: T0,
      updatedAt: T0
    });
    seedRecord({ status: 'in_progress', attemptCount: 1 });

    const result = await kyc.startKyc({ userId: USER_ID });

    expect(result).toMatchObject({ ok: true, value: { inquiryId: 'inq_1' } });
    expect(persona.calls.map((call) => call.method)).toEqual(['listInquiries', 'createInquiry']);
    expect(store.records.get(USER_ID)).toMatchObject({ personaInquiryId: 'inq_1', attemptCount: 1 });
  });

  it('refuses a fresh in_progress record whose inquiry Persona has meanwhile completed, and moves it on', async () => {
    const { kyc, store, persona, seedRecord, clock } = setup();
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

    await expect(kyc.startKyc({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'awaiting_decision' }
    });
    expect(persona.calls.map((call) => call.method)).toEqual(['listInquiries']);
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'submitted', personaInquiryId: 'inq_seeded' });
  });

  it('resumes an expired inquiry and moves the record back to in_progress', async () => {
    const { kyc, store, persona, seedRecord, clock } = setup();
    persona.inquiries.set('inq_seeded', {
      id: 'inq_seeded',
      status: 'expired',
      referenceId: USER_ID,
      accountId: 'act_seeded',
      templateVersionId: FAKE_TEMPLATE_VERSION_ID,
      createdAt: T0,
      updatedAt: T0
    });
    seedRecord({ status: 'expired', attemptCount: 1 });
    clock.advance(60 * MINUTE);

    const result = await kyc.startKyc({ userId: USER_ID });

    expect(result).toMatchObject({ ok: true, value: { inquiryId: 'inq_seeded' } });
    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'in_progress',
      attemptCount: 1,
      statusChangedAt: new Date(T0.getTime() + 60 * MINUTE)
    });
    expect(persona.inquiries.get('inq_seeded')?.status).toBe('pending');
  });

  it("resumes an expired inquiry inside the expiry's own second — Persona answers in whole seconds", async () => {
    const s = setup();
    // Persona's updated-at carries whole seconds; the stored expiry carries the event's milliseconds.
    const kyc = createKycVerification({
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
      config: { webhookSecret: WEBHOOK_SECRET, templateVersionId: FAKE_TEMPLATE_VERSION_ID }
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
    s.seedRecord({ status: 'expired', attemptCount: 1, statusChangedAt: expiredAt, lastSyncedAt: expiredAt });
    s.clock.set(new Date(T0.getTime() + 10_900));

    const result = await kyc.startKyc({ userId: USER_ID });

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
    const { kyc, store, persona, seedRecord } = setup();
    const seeded = seedRecord({ status });

    await expect(kyc.startKyc({ userId: USER_ID })).resolves.toEqual({ ok: false, error: { code } });
    expect(persona.calls).toHaveLength(0);
    expect(store.records.get(USER_ID)).toEqual(seeded);
  });

  it.each([
    ['submitted', 'completed'],
    ['pending_review', 'needs_review'],
    ['failed', 'failed']
  ] as const)('refuses from %s only after re-reading Persona, which still says %s', async (status, personaStatus) => {
    const { kyc, store, persona, seedRecord } = setup();
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

    await expect(kyc.startKyc({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'awaiting_decision' }
    });
    expect(persona.calls.map((call) => call.method)).toEqual(['listInquiries']);
    expect(store.records.get(USER_ID)).toEqual(seeded);
  });

  it('refuses from failed once Persona has decided it, and moves the record on to the decision', async () => {
    const { kyc, store, persona, seedRecord } = setup();
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

    await expect(kyc.startKyc({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'awaiting_decision' }
    });
    expect(persona.calls.map((call) => call.method)).toEqual(['listInquiries']);
    expect(store.records.get(USER_ID)).toMatchObject({ status: 'pending_review', personaInquiryId: 'inq_seeded' });
  });

  it('refuses organization accounts before consulting the status', async () => {
    const { kyc, store, persona } = setup();
    store.profiles.set(USER_ID, { ...INDIVIDUAL_PROFILE, accountType: 'organization' });

    await expect(kyc.startKyc({ userId: USER_ID })).resolves.toEqual({ ok: false, error: { code: 'organization' } });
    expect(persona.calls).toHaveLength(0);
    expect(store.records.size).toBe(0);
  });

  it('refuses a user who has not completed onboarding', async () => {
    const { kyc, store } = setup();
    store.profiles.delete(USER_ID);

    await expect(kyc.startKyc({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'profile_missing' }
    });
  });

  it('surfaces a Persona failure as persona_unavailable and creates no record', async () => {
    const { kyc, store, persona } = setup();
    persona.failNextCall({ reason: 'http', message: 'Bad Gateway', httpStatus: 502 });

    await expect(kyc.startKyc({ userId: USER_ID })).resolves.toEqual({
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
    status: KycStatus;
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
      attemptCount: 1,
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

    const report = await s.kyc.reconcile({ now: T0 });

    expect(report).toEqual({ checked: 1, changed: 1, unavailable: 0, undecided: 0, awaitingReview: 0 });
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
    const kyc = createKycVerification({
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
      config: { webhookSecret: WEBHOOK_SECRET, templateVersionId: FAKE_TEMPLATE_VERSION_ID }
    });

    const sweep = kyc.reconcile({ now: T0 });
    await sweepRead.opened;
    const started = await kyc.startKyc({ userId: USER_ID });
    expect(started).toMatchObject({ ok: true, value: { inquiryId: 'inq_1' } });
    startLanded.open();
    const report = await sweep;

    // The stale answer neither re-pointed nor confirmed the record; the replacement's own events apply.
    expect(report).toMatchObject({ checked: 1, changed: 0 });
    expect(s.store.records.get(USER_ID)).toMatchObject({
      status: 'in_progress',
      personaInquiryId: 'inq_1',
      attemptCount: 1
    });
    await expect(delivery({ kyc, name: 'inquiry.approved', status: 'approved', inquiryId: 'inq_1' })).resolves.toEqual({
      ok: true,
      value: { outcome: 'applied' }
    });
    expect(s.store.records.get(USER_ID)).toMatchObject({ status: 'approved', personaInquiryId: 'inq_1' });
  });

  it('re-reads a stale failed record and applies the Workflow decision whose webhook was lost', async () => {
    const s = setup();
    seedSynced({ setup: s, userId: 'u-failed', status: 'failed', personaStatus: 'needs_review', staleMinutes: 45 });

    const report = await s.kyc.reconcile({ now: T0 });

    expect(report).toEqual({ checked: 1, changed: 1, unavailable: 0, undecided: 0, awaitingReview: 0 });
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

    const report = await s.kyc.reconcile({ now: T0 });

    expect(report).toMatchObject({ checked: 1, changed: 0 });
    expect(s.store.records.get(USER_ID)).toMatchObject({
      status: 'pending_review',
      personaInquiryId: `inq_${USER_ID}`,
      attemptCount: 1
    });

    await delivery({ kyc: s.kyc, name: 'inquiry.approved', status: 'approved', inquiryId: `inq_${USER_ID}` });
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

    const first = await s.kyc.reconcile({ now: T0 });
    const second = await s.kyc.reconcile({ now: T0 });

    expect(first).toEqual({ checked: 1, changed: 1, unavailable: 0, undecided: 0, awaitingReview: 0 });
    expect(s.store.records.get('u-retried')).toMatchObject({
      status: 'approved',
      personaInquiryId: 'inq_newer',
      attemptCount: 2,
      lastSyncedAt: T0
    });
    // Confirmed, so it is not re-read on the very next sweep.
    expect(second).toEqual({ checked: 0, changed: 0, unavailable: 0, undecided: 0, awaitingReview: 0 });
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

    await s.kyc.reconcile({ now: T0 });

    expect(s.store.records.get('u-manual')).toMatchObject({ status: 'submitted', lastSyncedAt: T0 });
  });

  it('stops re-reading when the budget is spent and drains the rest next sweep', async () => {
    const s = setup();
    const kyc = createKycVerification({
      store: s.store.store,
      statusEmails: s.emails.sender,
      operatorMessages: s.operator.messenger,
      persona: s.persona.persona,
      outbox: s.outbox.outbox,
      clock: { now: () => s.clock.clock.now() },
      config: { webhookSecret: WEBHOOK_SECRET, reconcileBudgetMs: 0 }
    });
    for (const userId of ['u-1', 'u-2', 'u-3', 'u-4', 'u-5', 'u-6']) {
      seedSynced({ setup: s, userId, status: 'submitted', personaStatus: 'approved', staleMinutes: 45 });
    }
    s.clock.advance(1);

    const report = await kyc.reconcile({ now: T0 });

    // One batch of concurrent reads went out before the clock check cut the pass short.
    expect(report).toEqual({ checked: 5, changed: 5, unavailable: 0, undecided: 0, awaitingReview: 0 });
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

    const report = await s.kyc.reconcile({ now: T0 });

    expect(report).toMatchObject({ checked: 1, changed: 1 });
    expect(s.persona.calls.map((call) => call.input)).toEqual([{ referenceId: 'u-awaiting-decision' }]);
    expect(s.store.records.get('u-awaiting-decision')?.status).toBe('approved');
    // Untouched, and served by the next start if they ever come back.
    expect(s.store.records.get('u-walked-away')?.lastSyncedAt).toEqual(new Date(T0.getTime() - 45 * MINUTE));
  });

  it('re-reads a review every six hours for 45 days, not every sweep for seven', async () => {
    const s = setup();
    const review = { status: 'pending_review', personaStatus: 'needs_review' } as const;
    seedSynced({ setup: s, userId: 'u-read-recently', ...review, staleMinutes: 5 * 60, changedHoursAgo: 24 * 20 });
    seedSynced({ setup: s, userId: 'u-due', ...review, staleMinutes: 7 * 60, changedHoursAgo: 24 * 20 });
    seedSynced({ setup: s, userId: 'u-forgotten', ...review, staleMinutes: 7 * 60, changedHoursAgo: 24 * 50 });

    const report = await s.kyc.reconcile({ now: T0 });

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

    const report = await s.kyc.reconcile({ now: T0 });

    expect(report).toEqual({ checked: 0, changed: 0, unavailable: 0, undecided: 0, awaitingReview: 0 });
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

    const first = await s.kyc.reconcile({ now: T0 });
    const afterFirst = s.store.records.get('u-still-pending');
    const second = await s.kyc.reconcile({ now: T0 });

    expect(first).toEqual({ checked: 1, changed: 0, unavailable: 0, undecided: 0, awaitingReview: 0 });
    // Confirmed against Persona (lastSyncedAt moves), but nothing about the status moved.
    expect(afterFirst).toEqual({ ...before, lastSyncedAt: T0 });
    expect(second).toEqual({ checked: 0, changed: 0, unavailable: 0, undecided: 0, awaitingReview: 0 });
    expect(s.store.records.get('u-still-pending')).toEqual(afterFirst);
    expect(s.outbox.notifications).toHaveLength(0);
  });

  it('never fetches terminal or freshly synced records', async () => {
    const s = setup();
    seedSynced({ setup: s, userId: 'u-approved', status: 'approved', personaStatus: 'approved', staleMinutes: 600 });
    seedSynced({ setup: s, userId: 'u-declined', status: 'declined', personaStatus: 'declined', staleMinutes: 600 });
    seedSynced({
      setup: s,
      userId: 'u-manual',
      status: 'manually_approved',
      personaStatus: 'declined',
      staleMinutes: 600
    });
    seedSynced({ setup: s, userId: 'u-fresh', status: 'in_progress', personaStatus: 'approved', staleMinutes: 5 });

    const report = await s.kyc.reconcile({ now: T0 });

    expect(report).toEqual({ checked: 0, changed: 0, unavailable: 0, undecided: 0, awaitingReview: 0 });
    expect(s.persona.calls).toHaveLength(0);
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

    const report = await s.kyc.reconcile({ now: T0 });

    // The freshly synced pending_review row is not re-read but still counts;
    // the abandoned (expired) row is past its own horizon and is not re-read
    // at all; `u-recent` submitted moments ago, inside the decision threshold.
    expect(report).toEqual({ checked: 3, changed: 0, unavailable: 0, undecided: 2, awaitingReview: 1 });
  });

  it('applies a transition Persona made inside the same second as the last event', async () => {
    // Event timestamps carry milliseconds, a fetched inquiry's updated-at only
    // seconds: the lost approval at :01.000 must not read as older than the
    // completion event at :01.598.
    const { kyc, seedRecord, store, persona, clock } = setup();
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
    await kyc.receiveWebhook({ rawBody, signatureHeader: sign({ rawBody, at: completedAt }), receivedAt: completedAt });
    persona.setInquiryStatus({ inquiryId: 'inq_seeded', status: 'approved', at: new Date(T0.getTime() + MINUTE) });
    clock.advance(45 * MINUTE);

    const report = await kyc.reconcile({ now: clock.clock.now() });

    expect(report).toMatchObject({ checked: 1, changed: 1 });
    // One millisecond after the event it followed: never equal, so the receivers can order them.
    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'approved',
      statusChangedAt: new Date(completedAt.getTime() + 1)
    });
  });

  it('still refuses a fetch that is a full second behind the last event', async () => {
    const { kyc, seedRecord, store, persona, clock } = setup();
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

    const report = await kyc.reconcile({ now: clock.clock.now() });

    expect(report).toMatchObject({ checked: 1, changed: 0 });
    expect(store.records.get(USER_ID)?.status).toBe('submitted');
  });

  it('leaves a record alone when the newest inquiry carries a status the mapping does not cover', async () => {
    // Adopting the previous (readable) inquiry instead would re-point the
    // record backwards and charge an attempt for a status Persona just added.
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

    const report = await s.kyc.reconcile({ now: T0 });

    expect(report).toMatchObject({ checked: 1, changed: 0, unavailable: 1 });
    // Confirmed (so it is re-read on the cadence, not every sweep), nothing else touched.
    expect(s.store.records.get('u-new-status')).toEqual({ ...before, lastSyncedAt: T0 });
  });

  it('leaves a record alone when Persona is unavailable and retries it next sweep', async () => {
    const s = setup();
    seedSynced({ setup: s, userId: 'u-outage', status: 'submitted', personaStatus: 'approved', staleMinutes: 45 });
    const before = s.store.records.get('u-outage');
    s.persona.failNextCall({ reason: 'network', message: 'ECONNRESET' });

    const first = await s.kyc.reconcile({ now: T0 });
    const afterOutage = s.store.records.get('u-outage');
    const second = await s.kyc.reconcile({ now: T0 });

    expect(first).toEqual({
      checked: 1,
      changed: 0,
      unavailable: 1,
      unavailableCause: { reason: 'network', message: 'ECONNRESET' },
      undecided: 0,
      awaitingReview: 0
    });
    expect(afterOutage).toEqual(before);
    expect(second).toEqual({ checked: 1, changed: 1, unavailable: 0, undecided: 0, awaitingReview: 0 });
  });
});

describe('deliverNotification — the receiving half of the Outbox', () => {
  const LATER = new Date(T0.getTime() + 10 * MINUTE);
  const approvalOfNew: KycNotification = {
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
    const { kyc, seedRecord, emails } = setup();
    if (stored) seedRecord(stored);

    await expect(kyc.deliverNotification({ notification: approvalOfNew })).resolves.toEqual({
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
    const { kyc, seedRecord, emails } = setup();
    seedRecord({ status: 'approved', personaInquiryId: 'inq_new', statusChangedAt: LATER });

    await expect(kyc.deliverNotification({ notification })).resolves.toEqual({ ok: true, value: 'skipped' });
    expect(emails.sent).toHaveLength(0);
  });

  it('emails the onboarding profile, never an address from the job, once the row shows the transition', async () => {
    const { kyc, seedRecord, emails, operator } = setup();
    seedRecord({ status: 'approved', personaInquiryId: 'inq_new', statusChangedAt: LATER });

    await expect(kyc.deliverNotification({ notification: approvalOfNew })).resolves.toEqual({
      ok: true,
      value: 'sent'
    });
    expect(emails.sent).toEqual([
      { to: 'ada@example.com', name: 'Ada', status: 'approved', inquiryId: 'inq_new', statusChangedAt: LATER }
    ]);
    expect(operator.sent).toHaveLength(0);
  });

  it('sends an operator message with the attempt count from the record', async () => {
    const { kyc, seedRecord, operator, emails } = setup();
    seedRecord({ status: 'pending_review', personaInquiryId: 'inq_new', statusChangedAt: LATER, attemptCount: 2 });

    await expect(
      kyc.deliverNotification({
        notification: { ...approvalOfNew, kind: 'operator_message', status: 'pending_review' }
      })
    ).resolves.toEqual({ ok: true, value: 'sent' });
    expect(operator.sent).toEqual([
      { status: 'pending_review', userId: USER_ID, email: 'ada@example.com', inquiryId: 'inq_new', attemptCount: 2 }
    ]);
    expect(emails.sent).toHaveLength(0);
  });

  it('reports a channel that refused the send as send_failed, so the queue retries', async () => {
    const { kyc, seedRecord, emails } = setup();
    seedRecord({ status: 'approved', personaInquiryId: 'inq_new', statusChangedAt: LATER });
    emails.failNextCall(new Error('Resend is down'));

    await expect(kyc.deliverNotification({ notification: approvalOfNew })).resolves.toMatchObject({
      ok: false,
      error: { code: 'send_failed' }
    });
  });

  it('still sends the operator message when the onboarding profile is gone, without an email', async () => {
    const { kyc, seedRecord, store, operator } = setup();
    seedRecord({ status: 'approved', personaInquiryId: 'inq_new', statusChangedAt: LATER });
    store.profiles.delete(USER_ID);

    await expect(
      kyc.deliverNotification({ notification: { ...approvalOfNew, kind: 'operator_message', status: 'approved' } })
    ).resolves.toEqual({ ok: true, value: 'sent' });
    expect(operator.sent).toEqual([
      { status: 'approved', userId: USER_ID, email: null, inquiryId: 'inq_new', attemptCount: 1 }
    ]);
  });

  it('cannot address an email for a user whose onboarding profile is gone', async () => {
    const { kyc, seedRecord, store, emails } = setup();
    seedRecord({ status: 'approved', personaInquiryId: 'inq_new', statusChangedAt: LATER });
    store.profiles.delete(USER_ID);

    await expect(kyc.deliverNotification({ notification: approvalOfNew })).resolves.toMatchObject({
      ok: false,
      error: { code: 'send_failed' }
    });
    expect(emails.sent).toHaveLength(0);
  });

  it('delivers what the write path enqueued: a webhook approval ends as one email and one operator message', async () => {
    const { kyc, seedRecord, outbox, emails, operator } = setup();
    seedRecord({ status: 'submitted' });

    await delivery({ kyc, name: 'inquiry.approved', status: 'approved' });
    for (const notification of outbox.notifications) {
      await expect(kyc.deliverNotification({ notification })).resolves.toEqual({ ok: true, value: 'sent' });
    }

    expect(emails.sent).toEqual([
      expect.objectContaining({ to: 'ada@example.com', name: 'Ada', status: 'approved', inquiryId: 'inq_seeded' })
    ]);
    expect(operator.sent).toEqual([
      { status: 'approved', userId: USER_ID, email: 'ada@example.com', inquiryId: 'inq_seeded', attemptCount: 1 }
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
    const { kyc, persona, seedRecord, clock } = setup();
    seedRecord({ status, lastSyncedAt: T0 });
    clock.advance(minutesOld * MINUTE);

    const view = await kyc.getKycStatus({ userId: USER_ID });

    expect(view.status).toBe(status);
    expect(persona.calls).toHaveLength(0);
  });
});

describe('operator actions — revoke and resyncFromPersona', () => {
  /** The user's Inquiry as Persona holds it, decided `minutesAfterT0` after the seed time. */
  function personaHolds({
    s,
    status,
    minutesAfterT0
  }: {
    s: ReturnType<typeof setup>;
    status: 'approved' | 'declined';
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
    const { kyc, seedRecord, store, outbox } = setup();
    // Persona's clock ran ahead of ours: the approval is stamped later than "now".
    seedRecord({ status: 'approved', statusChangedAt: new Date(T0.getTime() + MINUTE) });

    await expect(kyc.revoke({ userId: USER_ID })).resolves.toEqual({
      ok: true,
      value: { from: 'approved', to: 'revoked', inquiryId: 'inq_seeded' }
    });

    expect(store.records.get(USER_ID)).toMatchObject({
      status: 'revoked',
      personaInquiryId: 'inq_seeded',
      statusChangedAt: new Date(T0.getTime() + MINUTE + 1)
    });
    expect(outbox.notifications).toHaveLength(0);
  });

  it('revokes a user who never started, which also refuses a start', async () => {
    const { kyc, store, persona } = setup();

    await expect(kyc.revoke({ userId: USER_ID })).resolves.toEqual({
      ok: true,
      value: { from: 'not_started', to: 'revoked', inquiryId: null }
    });

    expect(store.records.get(USER_ID)).toMatchObject({ status: 'revoked', personaInquiryId: null, attemptCount: 0 });
    await expect(kyc.startKyc({ userId: USER_ID })).resolves.toEqual({ ok: false, error: { code: 'revoked' } });
    expect(persona.calls).toHaveLength(0);
  });

  it('refuses a user id that is no onboarded user', async () => {
    const { kyc, store } = setup();

    await expect(kyc.revoke({ userId: 'nobody' })).resolves.toEqual({ ok: false, error: { code: 'profile_missing' } });
    await expect(kyc.resyncFromPersona({ userId: 'nobody' })).resolves.toEqual({
      ok: false,
      error: { code: 'profile_missing' }
    });
    expect(store.records.size).toBe(0);
  });

  it('releases a revoked record to what Persona holds now, not to what the record held before', async () => {
    const s = setup();
    s.seedRecord({ status: 'approved' });
    s.clock.advance(60 * MINUTE);
    await s.kyc.revoke({ userId: USER_ID });
    // Persona declined the Inquiry while the record was revoked; the event was dropped by guard 1.
    await delivery({ kyc: s.kyc, name: 'inquiry.declined', status: 'declined', minutesAfterT0: 90 });
    expect(s.store.records.get(USER_ID)?.status).toBe('revoked');
    personaHolds({ s, status: 'declined', minutesAfterT0: 90 });
    s.clock.advance(60 * MINUTE);

    await expect(s.kyc.resyncFromPersona({ userId: USER_ID })).resolves.toEqual({
      ok: true,
      value: { from: 'revoked', to: 'declined', inquiryId: 'inq_seeded' }
    });

    expect(s.store.records.get(USER_ID)).toMatchObject({ status: 'declined', attemptCount: 1 });
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
    await s.kyc.revoke({ userId: USER_ID });
    const revokedAt = s.store.records.get(USER_ID)!.statusChangedAt;

    const result = await s.kyc.resyncFromPersona({ userId: USER_ID });

    expect(result).toEqual({ ok: true, value: { from: 'revoked', to: 'approved', inquiryId: 'inq_seeded' } });
    expect(s.store.records.get(USER_ID)!.statusChangedAt.getTime()).toBeGreaterThan(revokedAt.getTime());
  });

  it('applies a decline to a stale approved record, which the sweep never re-reads', async () => {
    const s = setup();
    s.seedRecord({ status: 'approved', lastSyncedAt: new Date(T0.getTime() - 24 * 60 * MINUTE) });
    personaHolds({ s, status: 'declined', minutesAfterT0: 30 });

    await expect(s.kyc.reconcile({ now: new Date(T0.getTime() + 60 * MINUTE) })).resolves.toMatchObject({ checked: 0 });
    expect(s.store.records.get(USER_ID)?.status).toBe('approved');

    await expect(s.kyc.resyncFromPersona({ userId: USER_ID })).resolves.toEqual({
      ok: true,
      value: { from: 'approved', to: 'declined', inquiryId: 'inq_seeded' }
    });
  });

  it('keeps a revocation that lands while a start is creating an inquiry', async () => {
    const s = setup();
    // The operator revokes while Persona is still answering the create; the
    // created inquiry is stamped after the revocation, so only the
    // Human-owned check at the store can keep it from landing.
    const create = s.persona.persona.createInquiry.bind(s.persona.persona);
    s.persona.persona.createInquiry = async (input) => {
      await s.kyc.revoke({ userId: USER_ID });
      s.clock.advance(1_000);
      return create(input);
    };

    await expect(s.kyc.startKyc({ userId: USER_ID })).resolves.toEqual({ ok: false, error: { code: 'revoked' } });
    expect(s.store.records.get(USER_ID)?.status).toBe('revoked');
  });

  it('releases a manually approved record to what Persona holds, and revokes one', async () => {
    const s = setup();
    s.seedRecord({ status: 'manually_approved' });
    personaHolds({ s, status: 'declined', minutesAfterT0: 30 });
    s.clock.advance(60 * MINUTE);

    await expect(s.kyc.resyncFromPersona({ userId: USER_ID })).resolves.toEqual({
      ok: true,
      value: { from: 'manually_approved', to: 'declined', inquiryId: 'inq_seeded' }
    });

    s.seedRecord({ status: 'manually_approved' });
    await expect(s.kyc.revoke({ userId: USER_ID })).resolves.toMatchObject({
      ok: true,
      value: { from: 'manually_approved', to: 'revoked' }
    });
  });

  it('leaves a revoked record as it is when Persona holds no Inquiry to go back to', async () => {
    const { kyc, seedRecord, store } = setup();
    seedRecord({ status: 'revoked' });

    await expect(kyc.resyncFromPersona({ userId: USER_ID })).resolves.toEqual({
      ok: true,
      value: { from: 'revoked', to: 'revoked', inquiryId: null }
    });
    expect(store.records.get(USER_ID)?.status).toBe('revoked');
  });

  it('answers persona_unavailable and changes nothing when Persona cannot be read', async () => {
    const { kyc, seedRecord, store, persona } = setup();
    seedRecord({ status: 'revoked' });
    persona.failNextCall({ reason: 'network', message: 'timeout' });

    await expect(kyc.resyncFromPersona({ userId: USER_ID })).resolves.toEqual({
      ok: false,
      error: { code: 'persona_unavailable', cause: { reason: 'network', message: 'timeout' } }
    });
    expect(store.records.get(USER_ID)?.status).toBe('revoked');
  });
});
