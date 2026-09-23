import { createPublicClient, fallback, http } from 'viem';
import { afterEach, expect, it, vi } from 'vitest';

import { getChainRpcUrls } from './chains';

afterEach(() => vi.unstubAllGlobals());

it.each([
  ['ethereum', 'eth-mainnet.g.alchemy.com', 'eth.merkle.io', 'ethereum-rpc.publicnode.com'],
  ['base', 'base-mainnet.g.alchemy.com', 'mainnet.base.org', 'base-rpc.publicnode.com']
] as const)(
  'keeps %s readable when Alchemy is inactive and the default public RPC is rate limited',
  async (chain, alchemyHost, defaultHost, fallbackHost) => {
    const hosts: Array<string> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const request = new Request(input, init);
        const host = new URL(request.url).host;
        hosts.push(host);
        if (host.includes('alchemy.com')) return new Response('App is inactive', { status: 403 });
        if (host === defaultHost) return new Response('Rate limited', { status: 429 });
        const body = await request.json();
        return Response.json({ jsonrpc: '2.0', id: body.id, result: '0x1' });
      })
    );
    const client = createPublicClient({
      transport: fallback(
        getChainRpcUrls({ chain, alchemyKey: 'test' }).map((url) => http(url, { retryCount: 0 })),
        { retryCount: 0 }
      )
    });
    expect(await client.getChainId()).toBe(1);
    expect(hosts).toEqual([alchemyHost, defaultHost, fallbackHost]);
  }
);
