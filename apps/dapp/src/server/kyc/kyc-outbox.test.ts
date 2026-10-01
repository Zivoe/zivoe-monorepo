import { type Client } from '@upstash/qstash';
import { describe, expect, it } from 'vitest';

import {
  KYC_OPERATOR_MESSAGE_PATH,
  KYC_STATUS_EMAIL_PATH,
  createQstashOutbox,
  parseKycNotificationJob
} from './kyc-outbox';
import { type KycEmailStatus, type KycOperatorStatus } from './kyc-status';
import { type KycNotification } from './kyc-verification';

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
const emailJob = (status: KycEmailStatus): KycNotification => ({
  ...base,
  kind: 'status_email',
  status
});
const operatorJob = (status: KycOperatorStatus): KycNotification => ({
  ...base,
  kind: 'operator_message',
  status
});

describe('createQstashOutbox', () => {
  it('holds the pending_review email so a review that resolves quickly sends one email, not two', async () => {
    const { published, outbox } = setup();

    await outbox.enqueue(emailJob('pending_review'));

    expect(published[0]).toMatchObject({ url: `${BASE_URL}${KYC_STATUS_EMAIL_PATH}`, delay: '30m' });
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
  it.each([emailJob('approved'), operatorJob('submitted')])(
    'publishes a body the receiver parses back to the same $kind',
    async (notification) => {
      const { published, outbox } = setup();

      await outbox.enqueue(notification);

      expect(parseKycNotificationJob({ kind: notification.kind, body: published[0]?.body })).toEqual(notification);
    }
  );

  it("refuses a status the route's channel does not announce, and a body this outbox never produced", () => {
    const body = { ...base, status: 'submitted', statusChangedAt: STATUS_CHANGED_AT.toISOString() };

    expect(parseKycNotificationJob({ kind: 'status_email', body })).toBeNull();
    expect(parseKycNotificationJob({ kind: 'operator_message', body: { userId: USER_ID } })).toBeNull();
  });
});
