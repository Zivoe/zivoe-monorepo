import 'server-only';

import { createPublicClient, fallback, http, isErc6492Signature } from 'viem';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';

import { chainOfChainId, getChainRpcUrls, getViemChain } from '@/lib/chains';

import { type ChainPort } from './wallet-link';
import { listMembershipTargets, readAddressesMembership } from './wallet-link-membership';
import { toSignableTypedData } from './wallet-link-typed-data';

/** What `eth_getCode` answers for an EOA that delegated under EIP-7702: still a key's account, on every chain. */
const EIP_7702_DELEGATION_PREFIX = '0xef0100';

/**
 * The transport behind every read: one retry per endpoint, not viem's three,
 * and none around them. A server action and the 60-second receivers wait on
 * these reads, so a hung endpoint must fail inside their budget — two
 * attempts of ten seconds. `fallback` retries on its own count on top of the
 * endpoints' (its default of three would make eight attempts, eighty seconds),
 * so it is told not to.
 */
export function createChainTransport(urls: ReadonlyArray<string>) {
  return fallback(
    urls.map((url) => http(url, { batch: true, timeout: 10_000, retryCount: 1 })),
    { retryCount: 0 }
  );
}

/**
 * The ChainPort over viem: one public client per active chain, built once
 * per instance (not through React's request cache — the reconcile runs
 * outside a render). `verifyTypedData` on a public client is the
 * contract-aware check: an EOA by recovery, a deployed smart wallet through
 * EIP-1271, a counterfactual one through ERC-6492, in the one call.
 */
export function createViemChainPort(): ChainPort {
  const clients = new Map<CentrifugeChain, ReturnType<typeof createPublicClient>>();
  const clientFor = (chain: CentrifugeChain) => {
    let client = clients.get(chain);
    if (!client) {
      client = createPublicClient({
        chain: getViemChain(chain),
        transport: createChainTransport(getChainRpcUrls(chain))
      });
      clients.set(chain, client);
    }
    return client;
  };

  return {
    async verifyTypedData({ chainId, address, typedData, signature }) {
      // A chain this deployment does not serve has no client to ask — and no vault to whitelist for.
      const chain = chainOfChainId(chainId);
      if (!chain) return false;
      // `mode: 'eoa'`: ECDSA recovery first, offline, so a key's signature
      // never waits on — or trusts — the RPC; only one recovery does not
      // explain goes to the chain (EIP-1271, ERC-6492). There viem fails
      // closed: an RPC it cannot reach makes a smart wallet's signature read
      // as invalid, so the refusal copy also names the network as a reason to try again.
      return clientFor(chain).verifyTypedData({
        address,
        signature,
        mode: 'eoa',
        ...toSignableTypedData(typedData)
      });
    },

    async isSmartAccount({ chainId, address, signature }) {
      // A wallet not deployed yet has no code to find; its ERC-6492 signature is what says so.
      if (isErc6492Signature(signature)) return true;
      // A chain this deployment no longer serves cannot be asked; the request still goes out, unflagged.
      const chain = chainOfChainId(chainId);
      if (!chain) return false;
      // Best effort: the answer is one label on an operator line. A chain that
      // cannot be read must not fail the delivery that carries it, or an RPC
      // outage would spend the Outbox's retries and lose the request — but it
      // is not "a key's account" either, so the line says it was not checked.
      try {
        const code = await clientFor(chain).getCode({ address });
        return !!code && code !== '0x' && !code.toLowerCase().startsWith(EIP_7702_DELEGATION_PREFIX);
      } catch {
        return null;
      }
    },

    readMembership: ({ addresses }) =>
      readAddressesMembership({
        addresses,
        targets: listMembershipTargets(),
        clientFor: (target) => clientFor(target.chain)
      })
  };
}
