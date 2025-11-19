import { useQuery } from '@tanstack/react-query';
import { useAccount as useAccountWagmi } from 'wagmi';

import { queryKeys } from '@/lib/query-keys';
import { handlePromise } from '@/lib/utils';

import { env } from '@/env';

import { useAccount } from './useAccount';

type Assessment = {
  address: string;
  risk: 'Severe' | 'High' | 'Medium' | 'Low';
  riskReason: string | null;
};

type ErrorResponse = {
  error: string;
};

export const useChainalysis = () => {
  const { address } = useAccount();

  const { chainId } = useAccountWagmi();
  const network = chainId ? 'MAINNET' : undefined;

  const { data, isPending, isFetching, isSuccess } = useQuery({
    queryKey: queryKeys.account.chainalysis({ accountAddress: address }),

    queryFn: async () => {
      const { res, err } = await handlePromise(
        fetch(
          env.NEXT_PUBLIC_ZIVOE_ANALYTICS_URL + '/api/chainalysis/assessment?address=' + address + '&network=' + network
        )
      );

      if (err) throw err;
      if (!res) throw new Error('No response from Chainalysis');

      const parsedResponse = await res.json();
      if (!res.ok) throw new Error((parsedResponse as ErrorResponse).error);

      return parsedResponse.data as Assessment;
    },

    enabled: !!(address && network),
    staleTime: 60 * 60 * 1000,
    retry: false,
    meta: { toastErrorMessage: 'Error Assessing Account Risk!' }
  });

  return {
    data,
    isPending,
    isFetching,
    isRiskyAddress: address && isSuccess && data && (data.risk === 'High' || data.risk === 'Severe')
  };
};
