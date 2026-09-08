import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { redis } from '@/server/clients/redis';

import { checkIpLimit } from './limit';

vi.mock('@/server/clients/redis', () => ({ redis: { evalsha: vi.fn() } }));
// handlePromise shares a module with UI helpers; keep this test outside the React runtime.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(redis.evalsha).mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('checkIpLimit', () => {
  it.each(['issue', 'redeem'] as const)('refuses %s when Redis times out', async (step) => {
    // Exercise Upstash's real timeout response, which reports success: true.
    vi.mocked(redis.evalsha).mockReturnValue(new Promise(() => undefined));
    const request = new Request('https://preview.example.com/api/agent-sign-in', {
      headers: { 'x-real-ip': '192.0.2.1' }
    });

    const result = checkIpLimit(step, request);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(await result).toBe('error');
  });
});
