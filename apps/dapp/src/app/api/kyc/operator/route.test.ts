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
// Hoisted so the mock factories below can reach them; the tests set what the module answers.
const { revoke, approveManually, resyncFromPersona, sendTelegramMessage } = vi.hoisted(() => ({
  revoke: vi.fn(),
  approveManually: vi.fn(),
  resyncFromPersona: vi.fn(),
  sendTelegramMessage: vi.fn()
}));
vi.mock('@/server/verification', () => ({ verification: { revoke, approveManually, resyncFromPersona } }));
vi.mock('@/server/utils/send-telegram', () => ({ sendTelegramMessage }));
// `select(...).from(organization).where(...).limit(1)`: the one organization the reply names.
vi.mock('@/server/clients/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [{ name: 'Acme & Co', deletedAt: new Date('2026-11-01T00:00:00Z') }] })
      })
    })
  }
}));
vi.mock('@/env', () => ({ env: { TELEGRAM_PERSONA_CHAT_ID: 'persona-chat' } }));
vi.mock('@sentry/nextjs', () => ({ setTag: vi.fn(), captureException: vi.fn() }));

const USER_ID = '7b6f9a1e-0c1d-4e6f-9a2b-3c4d5e6f7a8b';

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/kyc/operator', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
  );
}

const reported = () => (sendTelegramMessage.mock.calls[0]?.[0] as { chatId: string; text: string } | undefined)?.text;

beforeEach(() => {
  vi.clearAllMocks();
  sendTelegramMessage.mockResolvedValue({});
});

describe('POST /api/kyc/operator', () => {
  it('lifts a revocation through resync and reports the change to the Persona channel', async () => {
    resyncFromPersona.mockResolvedValue({ ok: true, value: { from: 'revoked', to: 'approved', inquiryId: 'inq_1' } });

    const response = await post({ action: 'resync', subjectId: USER_ID });

    expect(response.status).toBe(200);
    expect(resyncFromPersona).toHaveBeenCalledWith({ subjectId: USER_ID });
    expect(sendTelegramMessage.mock.calls[0]?.[0]).toMatchObject({ chatId: 'persona-chat' });
    expect(reported()).toContain('<b>Action:</b> resync');
    expect(reported()).toContain('<b>Status:</b> revoked → approved');
    expect(reported()).toContain('<b>Inquiry:</b> inq_1');
  });

  it('says so when a resync found no Inquiry and left the record unchanged', async () => {
    resyncFromPersona.mockResolvedValue({ ok: true, value: { from: 'revoked', to: 'revoked', inquiryId: null } });

    expect((await post({ action: 'resync', subjectId: USER_ID })).status).toBe(200);
    expect(reported()).toContain('<b>Status:</b> revoked (unchanged)');
    expect(reported()).toContain('<b>Inquiry:</b> none in Persona');
  });

  it('revokes, and a failed report does not fail the action', async () => {
    revoke.mockResolvedValue({ ok: true, value: { from: 'approved', to: 'revoked', inquiryId: 'inq_1' } });
    sendTelegramMessage.mockRejectedValue(new Error('Telegram is down'));

    expect((await post({ action: 'revoke', subjectId: USER_ID })).status).toBe(200);
    expect(revoke).toHaveBeenCalledWith({ subjectId: USER_ID });
  });

  it('approves manually and reports the change', async () => {
    approveManually.mockResolvedValue({
      ok: true,
      value: { from: 'not_started', to: 'manually_approved', inquiryId: null, path: 'individual' }
    });

    expect((await post({ action: 'approve', subjectId: USER_ID })).status).toBe(200);
    expect(approveManually).toHaveBeenCalledWith({ subjectId: USER_ID });
    expect(reported()).toContain('<b>Status:</b> not started → manually approved');
    expect(reported()).toContain(`<b>Person:</b> ${USER_ID}`);
    expect(reported()).toContain('<b>Inquiry:</b> none');
    expect(reported()).not.toContain('⚠️');
  });

  it('warns when the manually approved user has an Inquiry', async () => {
    approveManually.mockResolvedValue({
      ok: true,
      value: { from: 'declined', to: 'manually_approved', inquiryId: 'inq_1' }
    });

    expect((await post({ action: 'approve', subjectId: USER_ID })).status).toBe(200);
    expect(reported()).toContain('⚠️ This user has an Inquiry');
  });

  it('names an organization by name and id, and says when it is deleted', async () => {
    revoke.mockResolvedValue({
      ok: true,
      value: { from: 'approved', to: 'revoked', inquiryId: null, path: 'organization', case: null }
    });

    await post({ action: 'revoke', subjectId: USER_ID });

    expect(reported()).toContain(`<b>Organization:</b> Acme &amp; Co (${USER_ID}) (deleted)`);
  });

  it('reports an unknown user and tells QStash not to retry', async () => {
    revoke.mockResolvedValue({ ok: false, error: { code: 'subject_missing' } });

    const response = await post({ action: 'revoke', subjectId: USER_ID });

    expect(response.status).toBe(489);
    expect(reported()).toContain('refused');
  });

  it.each([
    ['Persona cannot be read', 'resync', { code: 'persona_unavailable', cause: { reason: 'network', message: 'x' } }],
    ['the record changed under a revocation', 'revoke', { code: 'conflict' }],
    ['the record changed under a manual approval', 'approve', { code: 'conflict' }]
  ])('answers 500 so QStash retries when %s', async (_label, action, error) => {
    ({ revoke, approve: approveManually, resync: resyncFromPersona })[action]!.mockResolvedValue({ ok: false, error });

    expect((await post({ action, subjectId: USER_ID })).status).toBe(500);
    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });

  it.each([
    ['an action it does not know', { action: 'delete', subjectId: USER_ID }],
    ['a user id that is not a UUID', { action: 'revoke', subjectId: 'ada@example.com' }]
  ])('refuses %s as non-retryable without consulting the module', async (_label, body) => {
    const response = await post(body);

    expect(response.status).toBe(489);
    expect(response.headers.get('Upstash-NonRetryable-Error')).toBe('true');
    expect(revoke).not.toHaveBeenCalled();
    expect(approveManually).not.toHaveBeenCalled();
    expect(resyncFromPersona).not.toHaveBeenCalled();
  });
});
