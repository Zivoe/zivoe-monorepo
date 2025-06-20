import { useQuery } from '@tanstack/react-query';
import { sepolia } from 'viem/chains';
import { useAccount } from 'wagmi';

import { queryKeys } from '@/lib/query-keys';

import { env } from '@/env';

type Assessment = {
  address: string;
  risk: 'Severe' | 'High' | 'Medium' | 'Low';
  riskReason: string | null;
};

type ErrorResponse = {
  error: string;
};

export const useChainalysis = () => {
  const { address, chainId } = useAccount();
  const network = chainId ? (chainId === sepolia.id ? 'SEPOLIA' : 'MAINNET') : undefined;

  return useQuery({
    queryKey: queryKeys.account.chainalysis({ accountAddress: address, network }),

    queryFn: async () => {
      const response = await fetch(
        env.NEXT_PUBLIC_ZIVOE_ANALYTICS_URL + '/api/chainalysis/assessment?address=' + address + '&network=' + network
      );

      const parsedResponse = await response.json();
      if (!response.ok) throw new Error((parsedResponse as ErrorResponse).error);

      return parsedResponse.data as Assessment;
    },

    enabled: !!(address && network),
    staleTime: 60 * 60 * 1000,
    retry: false,
    meta: { toastErrorMessage: 'Error Assessing Account Risk!' }
  });
};
