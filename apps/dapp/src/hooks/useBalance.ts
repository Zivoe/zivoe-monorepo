import { queryOptions, skipToken, useQueries, useQuery } from '@tanstack/react-query';
import { type Address, erc20Abi } from 'viem';
import { useConfig, usePublicClient } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';

import { getChainId } from '@/lib/chains';
import { queryKeys } from '@/lib/query-keys';

import { useAccount } from './useAccount';

/** The one balance query — shared by the single- and the many-token readers so both hit the same cache entry. */
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
    // Silent on purpose: the many-token reader below runs for every chain on
    // every page load, and one flaky public RPC would otherwise toast "Error
    // fetching balance" per chain to a user who never picked it. Both readers
    // share this entry, so the flag cannot differ per reader; the forms name
    // a failed read of the coin they spend in place, with a Retry.
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
 * The connected wallet's balances of several tokens across chains at once —
 * what a selector needs to ORDER its rows, where the per-row reader
 * (ChainBalanceDetail) only prints each. Same query per token as useBalance,
 * so the two readers share cache entries and refetches. Returns a lookup:
 * undefined while a balance is unknown (no wallet, still loading, failed),
 * so callers treat "unknown" as "nothing to sort by" rather than as zero.
 */
export function useTokenBalances(tokens: ReadonlyArray<TokenOnChain>): (token: TokenOnChain) => bigint | undefined {
  const { address: holder } = useAccount();
  const config = useConfig();

  const results = useQueries({
    queries: tokens.map(({ chain, tokenAddress }) =>
      balanceQueryOptions({
        chain,
        tokenAddress,
        holder,
        // The hook form can only read one chain per call; the action form
        // resolves each token's own chain client off the same config.
        web3: getPublicClient(config, { chainId: getChainId(chain) })
      })
    )
  });

  const balances = new Map(
    tokens.map(({ chain, tokenAddress }, index) => [balanceKey({ chain, tokenAddress }), results[index]?.data])
  );
  return (token) => balances.get(balanceKey(token));
}

function balanceKey({ chain, tokenAddress }: TokenOnChain): string {
  return `${chain}:${tokenAddress.toLowerCase()}`;
}
