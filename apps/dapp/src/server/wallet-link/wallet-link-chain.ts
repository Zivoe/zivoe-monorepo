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
        transport: fallback(getChainRpcUrls(chain).map((url) => http(url, { batch: true })))
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
      // viem fails closed: an RPC it cannot reach makes a smart wallet's
      // signature read as invalid (an EOA still recovers offline), so the
      // refusal copy also names the network as a reason to try again.
      return clientFor(chain).verifyTypedData({ address, signature, ...toSignableTypedData(typedData) });
    },

    async isSmartAccount({ chainId, address, signature }) {
      // A wallet not deployed yet has no code to find; its ERC-6492 signature is what says so.
      if (isErc6492Signature(signature)) return true;
      // A chain this deployment no longer serves cannot be asked; the request still goes out, unflagged.
      const chain = chainOfChainId(chainId);
      if (!chain) return false;
      const code = await clientFor(chain).getCode({ address });
      return !!code && code !== '0x' && !code.toLowerCase().startsWith(EIP_7702_DELEGATION_PREFIX);
    },

    readMembership: ({ addresses }) =>
      readAddressesMembership({
        addresses,
        targets: listMembershipTargets(),
        clientFor: (target) => clientFor(target.chain)
      })
  };
}
