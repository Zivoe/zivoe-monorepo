import { NextRequest } from 'next/server';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

// The module reaches @/lib/utils, whose toast import drags in the React runtime.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
// Signature verification is QStash's contract; the route's own is under test.
vi.mock('@/lib/qstash', async (importOriginal) => ({
  ...(await importOriginal()),
  withQstashSignature: (handler: unknown) => handler
}));
// Hoisted so the mock factory below can reach it; the tests set what the module answers.
const deliverNotification = vi.hoisted(() => vi.fn());
vi.mock('@/server/kyc', () => ({ kycVerification: { deliverNotification } }));
vi.mock('@sentry/nextjs', () => ({ setTag: vi.fn(), captureException: vi.fn() }));

const USER_ID = '7b6f9a1e-0c1d-4e6f-9a2b-3c4d5e6f7a8b';
const CHANGED_AT = new Date('2026-09-06T10:00:00.000Z');
const JOB = { userId: USER_ID, inquiryId: 'inq_new', status: 'submitted', statusChangedAt: CHANGED_AT.toISOString() };

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/telegram/kyc', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
  );
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/telegram/kyc — transport for deliverNotification', () => {
  it('hands the job to the module as an operator message and answers 200 for a send', async () => {
    deliverNotification.mockResolvedValue({ ok: true, value: 'sent' });

    const response = await post(JOB);

    expect(response.status).toBe(200);
    expect(deliverNotification).toHaveBeenCalledWith({
      notification: {
        kind: 'operator_message',
        userId: USER_ID,
        inquiryId: 'inq_new',
        status: 'submitted',
        statusChangedAt: CHANGED_AT
      }
    });
  });

  it('answers 200 for a job the record has moved past, so QStash does not retry it', async () => {
    deliverNotification.mockResolvedValue({ ok: true, value: 'skipped' });

    expect((await post(JOB)).status).toBe(200);
  });

  it.each([
    ['the record has not caught up', { code: 'not_caught_up' }],
    ['the send failed', { code: 'send_failed', cause: new Error('Telegram is down') }]
  ])('answers 500 so QStash retries when %s', async (_label, error) => {
    deliverNotification.mockResolvedValue({ ok: false, error });

    expect((await post(JOB)).status).toBe(500);
  });

  it.each([
    ['a status operators are not told about', { ...JOB, status: 'expired' }],
    ['a body this outbox never produced', { userId: USER_ID }]
  ])('refuses %s as non-retryable without consulting the module', async (_label, body) => {
    const response = await post(body);

    expect(response.status).toBe(489);
    expect(response.headers.get('Upstash-NonRetryable-Error')).toBe('true');
    expect(deliverNotification).not.toHaveBeenCalled();
  });
});
