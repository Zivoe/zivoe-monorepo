import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { type Address, type WalletClient, createWalletClient, custom, parseAbi } from 'viem';
import { getChainId, signTypedData, writeContract } from 'viem/actions';
import { mainnet } from 'viem/chains';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSimulationSigner } from '@/centrifuge/simulate';

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

// Guards patches/@dynamic-labs__ethereum-core@5.9.3.patch: Dynamic wraps every
// wallet in viem transports that retry failed prompts, so one click could reach
// a custody wallet (Fireblocks) as several transactions. Dynamic exports
// neither EthereumWallet (ethereum-core is a transitive dependency) nor its
// wagmi connector factory, so the installed files are loaded directly.
const require = createRequire(import.meta.url);
const connectorDir = path.dirname(require.resolve('@dynamic-labs/wagmi-connector/package.json'));
const coreDir = path.dirname(
  createRequire(path.join(connectorDir, 'package.json')).resolve('@dynamic-labs/ethereum-core/package.json')
);
const load = (file: string) => import(/* @vite-ignore */ pathToFileURL(file).href);

const ADDRESS: Address = '0x0000000000000000000000000000000000000001';
const SEND_TX = { method: 'eth_sendTransaction', params: [{ from: ADDRESS, to: ADDRESS, data: '0x' }] };

const WALLET_ERRORS = {
  'WalletConnect expiry (no code)': () => new Error('Request expired. Please try again.'),
  'internal error (-32603)': () => Object.assign(new Error('Internal JSON-RPC error.'), { code: -32603 }),
  'user rejection (4001)': () => Object.assign(new Error('User rejected the request.'), { code: 4001 })
};

/** The real Dynamic stack (EthereumWallet -> wagmi connector client) over a wallet that fails every prompt. */
async function dynamicStack(walletError: () => Error, { failReads = false } = {}) {
  const { EthereumWallet } = await load(path.join(coreDir, 'src/wallet/EthereumWallet.js'));
  const { getCreateConnectorFn } = await load(path.join(connectorDir, 'src/lib/Connector.js'));

  const calls: Record<string, number> = {};
  // As WalletConnectConnector.getWalletClient builds it: a custom transport over the EIP-1193 provider.
  const connectorClient = createWalletClient({
    account: ADDRESS,
    chain: mainnet,
    transport: custom({
      request: async ({ method }: { method: string }) => {
        calls[method] = (calls[method] ?? 0) + 1;
        if (method === 'eth_chainId' && !failReads) return '0x1';
        throw walletError();
      }
    })
  });

  const wallet = new EthereumWallet({
    address: ADDRESS,
    chain: 'EVM',
    id: 'test',
    key: 'walletconnect',
    isAuthenticated: true,
    connector: {
      getWalletClient: async () => connectorClient,
      validateActiveWallet: async () => undefined,
      providersConfig: {}
    }
  });
  const connector = getCreateConnectorFn({ connectorId: 'test', wallet })({ chains: [mainnet] });

  return {
    calls,
    dynamicClient: (await wallet.getWalletClient()) as WalletClient,
    wagmiClient: (await connector.getClient({ chainId: mainnet.id })) as WalletClient
  };
}

/** Retries back off on timers: drain them so a resend shows up as a count, not a test timeout. */
async function settle(request: Promise<unknown>) {
  const settled = request.then(
    () => undefined,
    () => undefined
  );
  await vi.runAllTimersAsync();
  await settled;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe.each(Object.entries(WALLET_ERRORS))('a wallet prompt failing with %s', (_name, walletError) => {
  it('reaches the wallet once through a viem write (useTx)', async () => {
    const { calls, wagmiClient } = await dynamicStack(walletError);

    await settle(
      writeContract(wagmiClient, {
        abi: parseAbi(['function approve(address spender, uint256 amount)']),
        address: ADDRESS,
        functionName: 'approve',
        args: [ADDRESS, 1n],
        account: ADDRESS,
        chain: mainnet
      })
    );

    expect(calls.eth_sendTransaction).toBe(1);
  });

  it('reaches the wallet once through the Centrifuge signer', async () => {
    const { calls, wagmiClient } = await dynamicStack(walletError);
    const signer = createSimulationSigner({
      walletClient: wagmiClient,
      simulationClient: { call: async () => ({ data: '0x' }), getBalance: async () => 0n },
      errorCopy: {},
      nativeCurrency: { symbol: 'ETH', decimals: 18 }
    });

    await settle(signer.request(SEND_TX));

    expect(calls.eth_sendTransaction).toBe(1);
  });

  it('reaches the wallet once through a typed-data signature on the Dynamic client (wallet link)', async () => {
    const { calls, dynamicClient } = await dynamicStack(walletError);

    await settle(
      signTypedData(dynamicClient, {
        account: ADDRESS,
        domain: { name: 'Zivoe' },
        types: { Link: [{ name: 'nonce', type: 'uint256' }] },
        primaryType: 'Link',
        message: { nonce: 1n }
      })
    );

    expect(calls.eth_signTypedData_v4).toBe(1);
  });
});

it('keeps retrying wallet-routed reads', async () => {
  const { calls, wagmiClient } = await dynamicStack(WALLET_ERRORS['internal error (-32603)'], { failReads: true });

  await settle(getChainId(wagmiClient));

  expect(calls.eth_chainId).toBeGreaterThan(1);
});
