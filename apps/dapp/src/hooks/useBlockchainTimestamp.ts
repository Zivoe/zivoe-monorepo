import { skipToken, useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';

import { queryKeys } from '@/lib/query-keys';

import { useAccount } from './useAccount';

export const useBlockchainTimestamp = () => {
  const web3 = usePublicClient();
  const { address } = useAccount();

  return useQuery({
    queryKey: queryKeys.app.blockchainTimestamp,
    meta: { toastErrorMessage: 'Error fetching blockchain timestamp' },
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    queryFn:
      !web3 || !address
        ? skipToken
        : async () => {
            const block = await web3.getBlock({ blockTag: 'latest' });
            return block.timestamp;
          }
  });
};
