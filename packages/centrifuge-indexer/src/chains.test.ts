import { createPublicClient, fallback, http } from 'viem';
import { afterEach, expect, it, vi } from 'vitest';

import { CENTRIFUGE_CHAINS, getChainDeployment, getChainId, getChainRpcUrls } from './chains';

afterEach(() => vi.unstubAllGlobals());

it.each(CENTRIFUGE_CHAINS)(
  'keeps %s readable when Alchemy is inactive and the default public RPC is rate limited',
  async (chain) => {
    const additionalRpcUrls = chain === 'pharos' ? ['https://pharos-backup.example'] : [];
    const urls = getChainRpcUrls({ chain, alchemyKey: 'test', additionalRpcUrls });
    const backup = urls.at(-1)!;
    const hosts: Array<string> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const request = new Request(input, init);
        const host = new URL(request.url).host;
        hosts.push(host);
        if (host.includes('alchemy.com')) return new Response('App is inactive', { status: 403 });
        if (request.url !== new URL(backup).href) return new Response('Rate limited', { status: 429 });
        const body = await request.json();
        return Response.json({ jsonrpc: '2.0', id: body.id, result: `0x${getChainId(chain).toString(16)}` });
      })
    );
    const client = createPublicClient({
      transport: fallback(
        urls.map((url) => http(url, { retryCount: 0 })),
        { retryCount: 0 }
      )
    });
    expect(await client.getChainId()).toBe(getChainId(chain));
    expect(hosts).toEqual(urls.map((url) => new URL(url).host));
  }
);

it.each(CENTRIFUGE_CHAINS.filter((chain) => chain !== 'pharos'))(
  'provides a distinct public backup on %s without an Alchemy key',
  (chain) => {
    const urls = getChainRpcUrls({ chain, alchemyKey: undefined });
    const defaults = getChainDeployment(chain).viem.rpcUrls.default.http;
    expect(urls.slice(0, defaults.length)).toEqual(defaults);
    expect(urls.some((url) => !defaults.includes(url))).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((url) => new URL(url).protocol === 'https:')).toBe(true);
  }
);

it('keeps Pharos on its compatible default unless an additional provider is configured', () => {
  const defaults = getChainDeployment('pharos').viem.rpcUrls.default.http;
  expect(getChainRpcUrls({ chain: 'pharos', alchemyKey: undefined })).toEqual(defaults);
  const urls = getChainRpcUrls({
    chain: 'pharos',
    alchemyKey: 'test',
    additionalRpcUrls: ['https://pharos-backup.example', ...defaults]
  });
  expect(urls).toEqual(['https://pharos-mainnet.g.alchemy.com/v2/test', ...defaults, 'https://pharos-backup.example']);
});
