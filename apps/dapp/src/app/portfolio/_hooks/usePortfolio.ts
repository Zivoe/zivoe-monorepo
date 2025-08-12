import { skipToken, useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { DAY_IN_SECONDS, handlePromise } from '@/lib/utils';

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

          // Add synthetic zero-balance snapshot when there is only one data point
          if (filledSnapshots.length === 1) {
            const firstSnapshot = filledSnapshots[0];

            if (firstSnapshot) {
              const syntheticTimestamp = new Date(firstSnapshot.timestamp.getTime() - DAY_IN_SECONDS * 1000); // 1 day before
              const syntheticSnapshot = {
                timestamp: syntheticTimestamp,
                balance: 0n,
                balanceNumeric: 0
              };
              filledSnapshots.unshift(syntheticSnapshot);
            }
          }

          return {
            zVLTBalance: portfolio.data.zVLTBalance ? BigInt(portfolio.data.zVLTBalance) : null,
            value: portfolio.data.value ? BigInt(portfolio.data.value) : null,
            timestamp: portfolio.data.timestamp ? new Date(Number(portfolio.data.timestamp) * 1000) : null,
            snapshots: filledSnapshots
          };
        }
  });
};
