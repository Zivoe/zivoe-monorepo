import { revalidatePath } from 'next/cache';

import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { inviteMembers, resendInvitation } from './organizations';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  captureServerEvent: vi.fn(),
  canActForSubject: vi.fn(),
  invite: vi.fn(),
  recipientOf: vi.fn(),
  resend: vi.fn(),
  /** Tokens used per limiter key, like Upstash's fixed-window counters. */
  used: new Map<string, number>(),
  /** Set to make every limiter time out, as Upstash does when Redis cannot answer; or one prefix only. */
  timeout: { on: false, prefix: null as string | null },
  /** A limiter prefix whose charge throws, as a Redis error would. */
  failCharge: { prefix: null as string | null },
  /** A limiter prefix whose window ends as it is charged: a refund would land in the next one. */
  endingWindow: { prefix: null as string | null },
  /** Each limiter made, by prefix: whether it keeps Upstash's in-memory block cache. */
  limiters: new Map<string, { cached: boolean }>()
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/server', () => ({ after: (run: () => unknown) => run() }));
vi.mock('@/server/utils/analytics', () => ({ captureServerEvent: mocks.captureServerEvent }));
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.captureException, captureMessage: mocks.captureMessage }));
// The module reaches @/lib/utils, whose toast import drags in the React runtime.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn() }));
vi.mock('@/server/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock('@/server/data/auth', () => ({ getRequiredStep: async () => null }));
vi.mock('@/server/clients/redis', () => ({ redis: {} }));
vi.mock('@/server/organizations', () => ({
  organizations: {
    canActForSubject: mocks.canActForSubject,
    invite: mocks.invite,
    recipientOf: mocks.recipientOf,
    resend: mocks.resend
  }
}));
// An in-memory fixed window: every call counts, and it passes while the count stays within the tokens.
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static fixedWindow = (tokens: number) => ({ tokens });
    private readonly prefix: string;
    private readonly tokens: number;
    constructor({
      prefix,
      limiter,
      ephemeralCache
    }: {
      prefix: string;
      limiter: { tokens: number };
      ephemeralCache?: false;
    }) {
      mocks.limiters.set(prefix, { cached: ephemeralCache !== false });
      this.prefix = prefix;
      this.tokens = limiter.tokens;
    }
    async limit(key: string, options?: { rate?: number }) {
      if (mocks.timeout.on || mocks.timeout.prefix === this.prefix) return { success: true, reason: 'timeout' };
      if (mocks.failCharge.prefix === this.prefix) throw new Error('Redis is down');
      const id = `${this.prefix}:${key}`;
      const used = (mocks.used.get(id) ?? 0) + (options?.rate ?? 1);
      mocks.used.set(id, used);
      const reset = mocks.endingWindow.prefix === this.prefix ? Date.now() - 1 : Date.now() + 60_000;
      return { success: used <= this.tokens, reset };
    }
    async getRemaining(key: string) {
      return { remaining: this.tokens - (mocks.used.get(`${this.prefix}:${key}`) ?? 0) };
    }
  }
}));

const ORGANIZATION_ID = '9b1c2d3e-4f50-4a61-8b72-1c2d3e4f5061';
/** The send budgets' counters, without the attempts limiter every try passes. */
const sendBudgets = () => [...mocks.used].filter(([key]) => key.startsWith('organizations:invite:'));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.used.clear();
  mocks.timeout.on = false;
  mocks.timeout.prefix = null;
  mocks.failCharge.prefix = null;
  mocks.endingWindow.prefix = null;
  mocks.getSession.mockResolvedValue({ user: { id: 'user_1', email: 'jane@acme.com' } });
  mocks.canActForSubject.mockResolvedValue(true);
  mocks.invite.mockImplementation(async ({ email }: { email: string }) => ({
    ok: true,
    value: { invitationId: `inv_${email}` }
  }));
  mocks.recipientOf.mockResolvedValue({ organizationId: ORGANIZATION_ID, email: 'a@acme.com' });
  mocks.resend.mockResolvedValue({ ok: true, value: undefined });
});

describe('the send budgets', () => {
  it('keep no in-memory block, which a refund elsewhere would leave standing for the whole window', () => {
    const budgets = [...mocks.limiters].filter(([prefix]) => prefix.startsWith('organizations:invite:'));

    expect(budgets).toHaveLength(7);
    for (const [prefix, { cached }] of budgets) expect(cached, prefix).toBe(false);
  });
});

describe('inviteMembers', () => {
  it('answers a failure on one address for that address only, and reports it', async () => {
    mocks.invite.mockImplementation(async ({ email }: { email: string }) => {
      if (email === 'b@acme.com') throw new Error('QStash is down');
      return { ok: true, value: { invitationId: `inv_${email}` } };
    });

    const result = await inviteMembers({
      organizationId: ORGANIZATION_ID,
      emails: ['a@acme.com', 'b@acme.com', 'c@acme.com']
    });

    expect(result).toEqual({
      ok: true,
      value: {
        results: [
          { email: 'a@acme.com', error: null },
          { email: 'b@acme.com', error: 'failed' },
          { email: 'c@acme.com', error: null }
        ]
      }
    });
    expect(mocks.captureException).toHaveBeenCalledTimes(1);
  });

  it("charges the inviter per address, so a batch past the day's budget sends what fits", async () => {
    mocks.used.set('organizations:invite:inviter-day:user_1', 97);

    const result = await inviteMembers({
      organizationId: ORGANIZATION_ID,
      emails: ['a@acme.com', 'b@acme.com', 'c@acme.com', 'd@acme.com', 'e@acme.com']
    });

    expect(result.ok && result.value.results.map((row) => row.error)).toEqual([
      null,
      null,
      null,
      'rate_limited',
      'rate_limited'
    ]);
  });

  it("never reaches everyone's budget once the person's own is spent", async () => {
    mocks.used.set('organizations:invite:inviter-day:user_1', 100);

    await inviteMembers({ organizationId: ORGANIZATION_ID, emails: ['a@acme.com', 'b@acme.com'] });

    expect(mocks.used.get('organizations:invite:global:all')).toBeUndefined();
    expect(mocks.invite).not.toHaveBeenCalled();
  });

  it('allows ten a minute, so one full batch fits and a second one waits', async () => {
    const emails = Array.from({ length: 10 }, (_, index) => `person${index}@acme.com`);

    const first = await inviteMembers({ organizationId: ORGANIZATION_ID, emails });
    const second = await inviteMembers({ organizationId: ORGANIZATION_ID, emails: ['late@acme.com'] });

    expect(first.ok && first.value.results.every((row) => row.error === null)).toBe(true);
    expect(second.ok && second.value.results[0]?.error).toBe('rate_limited');
  });

  it('records one event per batch that sent something', async () => {
    mocks.invite.mockImplementation(async ({ email }: { email: string }) =>
      email === 'b@acme.com'
        ? { ok: false, error: { code: 'already_member' } }
        : { ok: true, value: { invitationId: `inv_${email}` } }
    );

    await inviteMembers({ organizationId: ORGANIZATION_ID, emails: ['a@acme.com', 'b@acme.com'] });

    expect(mocks.captureServerEvent).toHaveBeenCalledExactlyOnceWith({
      distinctId: 'user_1',
      event: 'organization:members_invited',
      properties: { organization_id: ORGANIZATION_ID, sent: 1, refused: 1 }
    });
  });

  it("leaves the page alone, so onboarding's invite step stays to show what was refused", async () => {
    await inviteMembers({ organizationId: ORGANIZATION_ID, emails: ['a@acme.com'] });

    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("leaves no trace of a try a budget refused, so it can't fill that budget up", async () => {
    const key = createHash('sha256').update('a@acme.com').digest('hex');
    mocks.used.set(`organizations:invite:recipient:${key}`, 5);

    await inviteMembers({ organizationId: ORGANIZATION_ID, emails: ['a@acme.com'] });
    await inviteMembers({ organizationId: ORGANIZATION_ID, emails: ['a@acme.com'] });

    expect(mocks.used.get(`organizations:invite:recipient:${key}`)).toBe(5);
    expect(mocks.used.get('organizations:invite:inviter-day:user_1')).toBe(0);
  });

  it('gives nothing back off the next window when the one it charged has ended', async () => {
    mocks.endingWindow.prefix = 'organizations:invite:inviter-burst';
    mocks.invite.mockResolvedValue({ ok: false, error: { code: 'already_member' } });

    await inviteMembers({ organizationId: ORGANIZATION_ID, emails: ['a@acme.com'] });

    // The ended window keeps its count and expires with it; the other budgets are given back.
    expect(mocks.used.get('organizations:invite:inviter-burst:user_1')).toBe(1);
    expect(mocks.used.get('organizations:invite:inviter-day:user_1')).toBe(0);
  });

  it('gives back what a refused invite charged, so only invitations that went out count', async () => {
    mocks.invite.mockResolvedValue({ ok: false, error: { code: 'already_member' } });

    const result = await inviteMembers({ organizationId: ORGANIZATION_ID, emails: ['a@acme.com', 'b@acme.com'] });

    expect(result.ok && result.value.results.map((row) => row.error)).toEqual(['already_member', 'already_member']);
    for (const prefix of [
      'inviter-burst:user_1',
      'inviter-day:user_1',
      `organization:${ORGANIZATION_ID}`,
      'global:all'
    ]) {
      expect(mocks.used.get(`organizations:invite:${prefix}`)).toBe(0);
    }
  });

  it('refuses when a limiter fails mid-way, and gives back what it had charged', async () => {
    mocks.failCharge.prefix = 'organizations:invite:recipient';

    const result = await inviteMembers({ organizationId: ORGANIZATION_ID, emails: ['a@acme.com'] });

    expect(result).toEqual({ ok: true, value: { results: [{ email: 'a@acme.com', error: 'failed' }] } });
    expect(mocks.invite).not.toHaveBeenCalled();
    expect(sendBudgets().length).toBeGreaterThan(0);
    for (const [key, used] of sendBudgets()) expect(used, key).toBe(0);
  });

  it("holds the recipient's budgets against requests in parallel", async () => {
    // One person, ten organizations, one stranger, all at once: the person may reach them three times.
    const organizationIds = Array.from({ length: 10 }, (_, index) => `9b1c2d3e-4f50-4a61-8b72-1c2d3e4f50${10 + index}`);

    const results = await Promise.all(
      organizationIds.map((organizationId) => inviteMembers({ organizationId, emails: ['stranger@acme.com'] }))
    );

    const sent = results.filter((result) => result.ok && result.value.results[0]?.error === null);
    expect(sent).toHaveLength(3);
    expect(mocks.invite).toHaveBeenCalledTimes(3);
  });

  it('refuses at the global limit, and says once who hit it', async () => {
    mocks.used.set('organizations:invite:global:all', 200);

    const result = await inviteMembers({ organizationId: ORGANIZATION_ID, emails: ['a@acme.com', 'b@acme.com'] });

    expect(result.ok && result.value.results.map((row) => row.error)).toEqual(['rate_limited', 'rate_limited']);
    expect(mocks.captureMessage).toHaveBeenCalledTimes(1);
    expect(mocks.captureMessage).toHaveBeenCalledWith(
      'Organization invitations hit the global limit',
      expect.objectContaining({
        level: 'error',
        extra: { userId: 'user_1', organizationId: ORGANIZATION_ID, addresses: 2 }
      })
    );
  });

  it('refuses when the limiter cannot answer, and reports the timeout', async () => {
    mocks.timeout.on = true;

    const result = await inviteMembers({ organizationId: ORGANIZATION_ID, emails: ['a@acme.com'] });

    expect(result).toEqual({ ok: false, error: { code: 'rate_limited' } });
    expect(mocks.invite).not.toHaveBeenCalled();
    expect(mocks.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('timed out'),
      expect.objectContaining({ level: 'warning' })
    );
  });

  it('refuses an address whose budget times out part-way, and gives back the ones before it', async () => {
    mocks.timeout.prefix = 'organizations:invite:pair';

    const result = await inviteMembers({ organizationId: ORGANIZATION_ID, emails: ['a@acme.com'] });

    expect(result).toEqual({ ok: true, value: { results: [{ email: 'a@acme.com', error: 'rate_limited' }] } });
    expect(mocks.invite).not.toHaveBeenCalled();
    expect(sendBudgets().length).toBeGreaterThan(0);
    for (const [key, used] of sendBudgets()) expect(used, key).toBe(0);
  });

  it('counts every try against the attempts limit, even one that sends nothing', async () => {
    mocks.invite.mockResolvedValue({ ok: false, error: { code: 'already_member' } });
    for (let attempt = 0; attempt < 30; attempt++) {
      await inviteMembers({ organizationId: ORGANIZATION_ID, emails: ['a@acme.com'] });
    }

    expect(await inviteMembers({ organizationId: ORGANIZATION_ID, emails: ['a@acme.com'] })).toEqual({
      ok: false,
      error: { code: 'rate_limited' }
    });
    expect(mocks.invite).toHaveBeenCalledTimes(30);
  });
});

describe('resendInvitation', () => {
  const INVITATION_ID = '1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b';

  it("spends the recipient's budgets like a first send, and refuses once they are used up", async () => {
    for (let send = 0; send < 3; send++) {
      expect(await resendInvitation({ invitationId: INVITATION_ID })).toEqual({ ok: true, value: undefined });
    }

    expect(await resendInvitation({ invitationId: INVITATION_ID })).toEqual({
      ok: false,
      error: { code: 'rate_limited' }
    });
    expect(mocks.resend).toHaveBeenCalledTimes(3);
    expect(mocks.captureServerEvent).toHaveBeenCalledTimes(3);
  });

  it('answers not_found for an invitation the person may not resend, spending nothing', async () => {
    mocks.recipientOf.mockResolvedValue(null);

    expect(await resendInvitation({ invitationId: INVITATION_ID })).toEqual({
      ok: false,
      error: { code: 'not_found' }
    });
    expect(sendBudgets()).toEqual([]);
  });
});
