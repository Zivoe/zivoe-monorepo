import { skipToken, useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { handlePromise } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';

import { PortfolioData } from '@/app/api/portfolio/route';
import { ApiResponseError, ApiResponseSuccess } from '@/app/api/utils';

const DEFAULT_ERROR_MESSAGE = 'Failed to fetch portfolio';

export const usePortfolio = () => {
  const { address } = useAccount();

  const skip = !address;

  return useQuery({
    queryKey: queryKeys.account.portfolio({ accountAddress: address }),
    queryFn: skip
      ? skipToken
      : async () => {
          const { err, res } = await handlePromise(fetch(`/api/portfolio?address=${encodeURIComponent(address)}`));
          if (err || !res) throw new Error(DEFAULT_ERROR_MESSAGE);

          if (!res.ok) {
            const errorData = (await res.json().catch(() => ({ error: DEFAULT_ERROR_MESSAGE }))) as ApiResponseError;
            throw new Error(errorData.error);
          }

          const portfolio = (await res.json()) as ApiResponseSuccess<PortfolioData>;
          if (!portfolio.data) throw new Error(DEFAULT_ERROR_MESSAGE);

          const filledSnapshots = portfolio.data.snapshots.map((snapshot) => {
            const timestamp = new Date(Number(snapshot.timestamp) * 1000);
            const balance = BigInt(snapshot.balance);
            const balanceNumeric = Number(balance) / 1e18; // Convert to decimal for charting

            return { timestamp, balance, balanceNumeric };
          });

          // Calculate portfolio change
          let change: { value: bigint; isPositive: boolean } | null = null;

          if (filledSnapshots.length > 1) {
            const firstBalance = filledSnapshots[0]?.balance;
            const lastBalance = filledSnapshots[filledSnapshots.length - 1]?.balance;

            console.log(firstBalance, lastBalance);

            if (firstBalance && firstBalance !== 0n && lastBalance) {
              const changeValue = ((lastBalance - firstBalance) * 10n ** 4n) / firstBalance;
              change = { value: changeValue, isPositive: changeValue >= 0n };
            }
          }

          return {
            zVLTBalance: portfolio.data.zVLTBalance ? BigInt(portfolio.data.zVLTBalance) : null,
            value: portfolio.data.value ? BigInt(portfolio.data.value) : null,
            timestamp: portfolio.data.timestamp ? new Date(Number(portfolio.data.timestamp) * 1000) : null,
            snapshots: filledSnapshots,
            change
          };
        }
  });
};
