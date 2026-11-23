import { beforeEach, describe, expect, it, vi } from 'vitest';

import { redis } from '@/server/clients/redis';

import { whileNotStarting } from './start-lock';

vi.mock('@/server/clients/redis', () => ({ redis: { set: vi.fn(), eval: vi.fn(async () => 1) } }));

describe('whileNotStarting', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not run while a start holds the key', async () => {
    vi.mocked(redis.set).mockResolvedValueOnce(null);
    const work = vi.fn();

    expect(await whileNotStarting('subject', work)).toBeNull();
    expect(work).not.toHaveBeenCalled();
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it('releases the key after the work, also when it throws', async () => {
    vi.mocked(redis.set).mockResolvedValue('OK');

    expect(await whileNotStarting('subject', async () => 'done')).toBe('done');
    await expect(whileNotStarting('subject', () => Promise.reject(new Error('no')))).rejects.toThrow('no');
    expect(redis.eval).toHaveBeenCalledTimes(2);
  });

  it('gives the key back only while it still holds its own token', async () => {
    vi.mocked(redis.set).mockResolvedValue('OK');

    await whileNotStarting('subject', async () => 'done');

    const [, token] = vi.mocked(redis.set).mock.calls[0]!;
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('get', KEYS[1]) == ARGV[1]"),
      ['kyc-start:lock:subject'],
      [token]
    );
  });
});
