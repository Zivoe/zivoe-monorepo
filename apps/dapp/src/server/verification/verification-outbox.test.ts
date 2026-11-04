import { type Client } from '@upstash/qstash';
import { describe, expect, it } from 'vitest';

import { type VerificationNotification } from './verification';
import {
  KYC_OPERATOR_MESSAGE_PATH,
  KYC_STATUS_EMAIL_PATH,
  createQstashOutbox,
  parseVerificationNotificationJob
} from './verification-outbox';
import { type VerificationEmailStatus, type VerificationOperatorStatus } from './verification-status';

const BASE_URL = 'https://app.example.com';
const USER_ID = '7b6f9a1e-0c1d-4e6f-9a2b-3c4d5e6f7a8b';
const STATUS_CHANGED_AT = new Date('2026-08-25T10:00:00.000Z');

/** Captures what the adapter would publish, without a QStash client. */
function setup() {
  const published: Array<Record<string, unknown>> = [];
  const qstash = {
    publishJSON: async (request: Record<string, unknown>) => {
      published.push(request);
      return { messageId: 'msg_1' };
    }
  } as unknown as Client;

  return { published, outbox: createQstashOutbox({ qstash, baseUrl: BASE_URL }) };
}

const base = { userId: USER_ID, inquiryId: 'inq_1', statusChangedAt: STATUS_CHANGED_AT };
const emailJob = (status: VerificationEmailStatus): VerificationNotification => ({
  ...base,
  kind: 'status_email',
  status
});
const operatorJob = (status: VerificationOperatorStatus): VerificationNotification => ({
  ...base,
  kind: 'operator_message',
  status
});

describe('createQstashOutbox', () => {
  it('carries a raw case move on the operator channel, after the settle delay', async () => {
    const { published, outbox } = setup();

    await outbox.enqueue({
      ...base,
      kind: 'case_status',
      status: 'pending_review',
      caseId: 'case_1',
      caseStatus: 'Ready for Review'
    });

    expect(published[0]).toMatchObject({
      url: `${BASE_URL}${KYC_OPERATOR_MESSAGE_PATH}`,
      delay: '5s',
      body: {
        ...base,
        statusChangedAt: STATUS_CHANGED_AT.toISOString(),
        status: 'pending_review',
        caseId: 'case_1',
        caseStatus: 'Ready for Review'
      }
    });
  });

  it('holds the pending_review email a minute, so a new KYB case has settled on who it waits on', async () => {
    const { published, outbox } = setup();

    await outbox.enqueue(emailJob('pending_review'));

    expect(published[0]).toMatchObject({ url: `${BASE_URL}${KYC_STATUS_EMAIL_PATH}`, delay: '1m' });
  });

  it('does not hold the operator message for the same transition beyond the settle delay', async () => {
    const { published, outbox } = setup();

    await outbox.enqueue(operatorJob('pending_review'));

    expect(published[0]).toMatchObject({ url: `${BASE_URL}${KYC_OPERATOR_MESSAGE_PATH}`, delay: '5s' });
  });

  it.each(['approved', 'declined', 'expired'] as const)(
    'gives the %s email only the settle delay, so the persist lands before the first delivery',
    async (status) => {
      const { published, outbox } = setup();

      await outbox.enqueue(emailJob(status));

      expect(published[0]).toMatchObject({ delay: '5s' });
    }
  );

  it('carries the transition the receiver checks against the record', async () => {
    const { published, outbox } = setup();

    await outbox.enqueue(emailJob('approved'));

    expect(published[0]?.body).toEqual({
      userId: USER_ID,
      inquiryId: 'inq_1',
      status: 'approved',
      statusChangedAt: STATUS_CHANGED_AT.toISOString()
    });
  });
});

describe('the wire contract between the outbox and its receivers', () => {
  it('reads a raw case move on the operator channel, and a body queued before case moves existed as before', () => {
    const body = { ...base, statusChangedAt: STATUS_CHANGED_AT.toISOString(), status: 'pending_review' };

    expect(
      parseVerificationNotificationJob({
        kind: 'operator_message',
        body: { ...body, caseId: 'case_1', caseStatus: 'Open' }
      })
    ).toEqual({ kind: 'case_status', ...base, status: 'pending_review', caseId: 'case_1', caseStatus: 'Open' });
    expect(parseVerificationNotificationJob({ kind: 'operator_message', body })).toEqual({
      kind: 'operator_message',
      ...base,
      status: 'pending_review'
    });
    // The email channel never carries a case move.
    expect(
      parseVerificationNotificationJob({
        kind: 'status_email',
        body: { ...body, caseId: 'case_1', caseStatus: 'Open' }
      })
    ).toEqual({ kind: 'status_email', ...base, status: 'pending_review' });
  });

  it.each([
    emailJob('approved'),
    operatorJob('submitted'),
    { ...emailJob('pending_review'), previousDecision: 'approved' } as const,
    { ...operatorJob('pending_review'), previousDecision: 'declined' } as const
  ])('publishes a body the receiver parses back to the same $kind', async (notification) => {
    const { published, outbox } = setup();

    await outbox.enqueue(notification);

    expect(parseVerificationNotificationJob({ kind: notification.kind, body: published[0]?.body })).toEqual(
      notification
    );
  });

  it("refuses a status the route's channel does not announce, and a body this outbox never produced", () => {
    const body = { ...base, status: 'submitted', statusChangedAt: STATUS_CHANGED_AT.toISOString() };

    expect(parseVerificationNotificationJob({ kind: 'status_email', body })).toBeNull();
    expect(parseVerificationNotificationJob({ kind: 'operator_message', body: { userId: USER_ID } })).toBeNull();
  });
});
