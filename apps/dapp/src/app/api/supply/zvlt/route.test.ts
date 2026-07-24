import { NextRequest } from 'next/server';

import { encodeAbiParameters } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rateLimitMock = vi.hoisted(() => vi.fn());
vi.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    static fixedWindow = vi.fn(() => 'fixed-window');
    limit = rateLimitMock;
  }
  return { Ratelimit };
});
vi.mock('@/server/clients/redis', () => ({ redis: {} }));
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));

import { GET } from './route';

const TOTAL_SUPPLY = 101_009345794392523364n;

beforeEach(() => {
  rateLimitMock.mockResolvedValue({ success: true, limit: 15, remaining: 14 });

  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: string | URL, init?: { body?: string }) => {
      const body = init?.body ? (JSON.parse(init.body) as { id?: number } | Array<{ id: number }>) : undefined;
      const respond = (request: { id?: number }) => ({
        jsonrpc: '2.0',
        id: request.id ?? 1,
        result: encodeAbiParameters([{ type: 'uint256' }], [TOTAL_SUPPLY])
      });

      if (Array.isArray(body)) return jsonResponse(body.map(respond));
      return jsonResponse(respond(body ?? {}));
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('GET /api/supply/zvlt', () => {
  it("serves the Centrifuge share token's total supply in the unchanged response shape", async () => {
    const res = await GET(new NextRequest('http://localhost/api/supply/zvlt'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: '101.009345794392523364' });
  });

  it('rate limits', async () => {
    rateLimitMock.mockResolvedValue({ success: false, limit: 15, remaining: 0 });

    const res = await GET(new NextRequest('http://localhost/api/supply/zvlt'));
    expect(res.status).toBe(429);
  });
});
