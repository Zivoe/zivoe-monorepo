import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CHAINALYSIS_ALERT_PATH,
  type ChainalysisAlertJob,
  enqueueChainalysisAlert,
  formatChainalysisAlert
} from './alert';

// Redis as a key set honouring NX, enough for the alert window.
const keys = vi.hoisted(() => new Set<string>());
vi.mock('@/server/clients/redis', () => ({
  redis: {
    set: async (key: string, _value: string, { nx }: { nx: boolean }) => {
      if (nx && keys.has(key)) return null;
      keys.add(key);
      return 'OK';
    }
  }
}));
const publishJSON = vi.hoisted(() => vi.fn());
vi.mock('@/server/clients/qstash', () => ({ qstash: { publishJSON } }));
vi.mock('@/server/clients/db', () => ({ db: {} }));
// handlePromise shares a module with UI helpers; keep this test outside the React runtime.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn() }));

const ADDRESS = '0xD27ac823D49d5d25AAd0ce5C929dbC71aA328a24';
const USER_ID = '7b6f9a1e-0c1d-4e6f-9a2b-3c4d5e6f7a8b';
const OTHER_USER_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const JOB: ChainalysisAlertJob = {
  userId: USER_ID,
  address: ADDRESS,
  risk: 'High',
  riskReason: '38% indirect exposure to Gambling'
};

beforeEach(() => {
  keys.clear();
  publishJSON.mockReset().mockResolvedValue({ messageId: 'msg' });
});

describe('enqueueChainalysisAlert', () => {
  it('queues the first alert and stays quiet when the same wallet is screened again', async () => {
    expect(await enqueueChainalysisAlert(JOB)).toBe('queued');
    expect(await enqueueChainalysisAlert({ ...JOB, address: ADDRESS.toLowerCase() })).toBe('already_alerted');
    expect(publishJSON).toHaveBeenCalledTimes(1);
    expect(publishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringMatching(new RegExp(`${CHAINALYSIS_ALERT_PATH}$`)) as unknown,
        body: JOB,
        label: 'telegram.chainalysis'
      })
    );
  });

  it('alerts again for another account on the same wallet, or a different risk', async () => {
    await enqueueChainalysisAlert(JOB);

    expect(await enqueueChainalysisAlert({ ...JOB, userId: OTHER_USER_ID })).toBe('queued');
    expect(await enqueueChainalysisAlert({ ...JOB, risk: 'Severe' })).toBe('queued');
  });

  it('keeps the window after a publish error, since the job may have been queued anyway', async () => {
    publishJSON.mockRejectedValueOnce(new Error('QStash timed out'));

    await expect(enqueueChainalysisAlert(JOB)).rejects.toThrow('QStash timed out');
    expect(await enqueueChainalysisAlert(JOB)).toBe('already_alerted');
  });
});

describe('formatChainalysisAlert', () => {
  const person = {
    email: 'investor@example.com',
    name: 'Google Name',
    accountType: 'individual' as const,
    firstName: 'Ada',
    lastName: 'Lovelace',
    entityName: null,
    countryOfResidence: 'Philippines (the)',
    countryOfIncorporation: null,
    amountOfInterest: '100k_250k' as const
  };

  it('names the person, their profile and their other wallets', () => {
    expect(formatChainalysisAlert({ job: JOB, person, otherWallets: ['0xaa65'] })).toBe(
      [
        '🚩 <b>Chainalysis: High risk</b>',
        '<b>Reason:</b> 38% indirect exposure to Gambling',
        '<b>Who:</b> Ada Lovelace · investor@example.com',
        '<b>Profile:</b> Individual · Philippines (the) · $100k - $250k',
        `<b>Wallet:</b> <code>${ADDRESS}</code>`,
        '<b>Other wallets:</b> <code>0xaa65</code>'
      ].join('\n')
    );
  });

  it('describes an organization by its entity and country of incorporation', () => {
    const organization = {
      ...person,
      accountType: 'organization' as const,
      entityName: 'Acme & Co',
      countryOfResidence: null,
      countryOfIncorporation: 'Singapore'
    };

    expect(formatChainalysisAlert({ job: JOB, person: organization, otherWallets: [] })).toContain(
      '<b>Profile:</b> Organization · Acme &amp; Co · Singapore · $100k - $250k'
    );
  });

  it('caps the other wallets it lists', () => {
    const otherWallets = ['0x1', '0x2', '0x3', '0x4', '0x5', '0x6', '0x7'];

    expect(formatChainalysisAlert({ job: JOB, person, otherWallets })).toContain('<code>0x5</code> and 2 more');
  });

  it('still alerts on the wallet when the account is gone', () => {
    const message = formatChainalysisAlert({ job: { ...JOB, riskReason: null }, person: null, otherWallets: [] });

    expect(message).toContain('<b>Who:</b> Account not found');
    expect(message).toContain('<b>Reason:</b> None given');
    expect(message).toContain(`<code>${ADDRESS}</code>`);
  });
});
