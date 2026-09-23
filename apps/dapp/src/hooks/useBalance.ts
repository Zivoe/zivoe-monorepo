import { queryOptions, skipToken, useQueries, useQuery } from '@tanstack/react-query';
import { type Address, erc20Abi } from 'viem';
import { useConfig, usePublicClient } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';

import { getChainId } from '@/lib/chains';
import { queryKeys } from '@/lib/query-keys';

import { useAccount } from './useAccount';

/** The one balance query, shared by the single- and the many-token readers. */
function balanceQueryOptions({
  chain,
  tokenAddress,
  holder,
  web3
}: {
  chain: CentrifugeChain;
  tokenAddress: Address;
  holder: Address | undefined;
  web3: ReturnType<typeof usePublicClient>;
}) {
  // queryOptions keeps the bigint result typed through both useQuery and useQueries.
  return queryOptions({
    queryKey: queryKeys.account.balanceOf({ accountAddress: holder, chain, id: tokenAddress }),
    // Silent on purpose: the many-token reader runs for every chain on every
    // page load, and one flaky RPC would otherwise toast per chain. The forms
    // name a failed read of the coin they spend in place, with a Retry.
    meta: { skipErrorToast: true },
    queryFn:
      !web3 || !holder
        ? skipToken
        : () =>
            web3.readContract({
              abi: erc20Abi,
              address: tokenAddress,
              functionName: 'balanceOf',
              args: [holder]
            })
  });
}

/**
 * ERC-20 balance of `accountAddress` on ONE chain, defaulting to the
 * connected wallet when omitted. The chain is explicit because one token
 * address can exist on several chains with independent balances.
 */
export const useBalance = ({
  chain,
  tokenAddress,
  accountAddress
}: {
  chain: CentrifugeChain;
  tokenAddress: Address;
  accountAddress?: Address;
}) => {
  const { address: connectedAddress } = useAccount();
  const web3 = usePublicClient({ chainId: getChainId(chain) });

  return useQuery(balanceQueryOptions({ chain, tokenAddress, holder: accountAddress ?? connectedAddress, web3 }));
};

export type TokenOnChain = { chain: CentrifugeChain; tokenAddress: Address };

/**
 * The connected wallet's balances of several tokens across chains at once,
 * for ordering selector rows; the same query per token as useBalance. Returns
 * a lookup that is undefined while a balance is unknown (no wallet, loading,
 * failed), so callers treat "unknown" as nothing to sort by, not as zero.
 */
export function useTokenBalances(tokens: ReadonlyArray<TokenOnChain>): (token: TokenOnChain) => bigint | undefined {
  const results = useTokenBalanceQueries(tokens);

  const balances = new Map(
    tokens.map(({ chain, tokenAddress }, index) => [balanceKey({ chain, tokenAddress }), results[index]?.data])
  );
  return (token) => balances.get(balanceKey(token));
}

/** Full read states for surfaces that must distinguish zero, unknown and stale balances. */
export function useTokenBalanceQueries(tokens: ReadonlyArray<TokenOnChain>, accountAddress?: Address) {
  const { address: connectedAddress } = useAccount();
  const holder = accountAddress ?? connectedAddress;
  const config = useConfig();
  return useQueries({
    queries: tokens.map(({ chain, tokenAddress }) =>
      balanceQueryOptions({
        chain,
        tokenAddress,
        holder,
        // usePublicClient reads one chain per call; the action form resolves each token's own.
        web3: getPublicClient(config, { chainId: getChainId(chain) })
      })
    )
  });
}

function balanceKey({ chain, tokenAddress }: TokenOnChain): string {
  return `${chain}:${tokenAddress.toLowerCase()}`;
}
