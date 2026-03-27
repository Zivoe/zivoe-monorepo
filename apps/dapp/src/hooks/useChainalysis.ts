import { useQuery } from '@tanstack/react-query';
import { mainnet } from 'viem/chains';
import { useConnection } from 'wagmi';

import { type ApiResponseError, type ApiResponseSuccess } from '@/app/api/utils';
import { queryKeys } from '@/lib/query-keys';
import { handlePromise } from '@/lib/utils';

import { useAccount } from './useAccount';

type Assessment = {
  address: string;
  risk: 'Severe' | 'High' | 'Medium' | 'Low';
  riskReason: string | null;
};

export const useChainalysis = () => {
  const { address } = useAccount();

  const { chainId } = useConnection();
  const isMainnet = chainId === mainnet.id;

  const { data, isPending, isFetching, isSuccess } = useQuery({
    queryKey: queryKeys.account.chainalysis({ accountAddress: address }),

    queryFn: async () => {
      const { res, err } = await handlePromise(fetch('/api/chainalysis/assessment?address=' + address));

      if (err) throw err instanceof Error ? err : new Error('Chainalysis request failed', { cause: err });
      if (!res) throw new Error('No response from Chainalysis');

      const parsedResponse = (await res.json()) as ApiResponseSuccess<Assessment> | ApiResponseError;
      if (!res.ok) throw new Error((parsedResponse as ApiResponseError).error);

      return (parsedResponse as ApiResponseSuccess<Assessment>).data;
    },

    enabled: !!(address && isMainnet),
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
