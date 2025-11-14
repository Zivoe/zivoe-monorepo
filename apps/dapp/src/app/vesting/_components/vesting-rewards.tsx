'use client';

import { ReactNode } from 'react';

import { Label, PolarAngleAxis, PolarRadiusAxis, RadialBar, RadialBarChart } from 'recharts';

import { Button } from '@zivoe/ui/core/button';
import { ChartContainer } from '@zivoe/ui/core/chart';
import { ContextualHelp, ContextualHelpDescription, ContextualHelpTitle } from '@zivoe/ui/core/contextual-help';
import { Skeleton } from '@zivoe/ui/core/skeleton';

import { formatBigIntWithCommas } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import { useBlockchainTimestamp } from '@/hooks/useBlockchainTimestamp';

import ConnectedAccount from '@/components/connected-account';
import { TOKEN_INFO } from '@/components/token-info';

import { TransactionDialog } from '@/app/home/deposit/_components/transaction-dialog';
import { Card } from '@/app/transparency/_components/card';

import { useClaimVesting } from '../_hooks/useClaimVesting';
import { useClaimableAmount } from '../_hooks/useClaimableAmount';
import { useVestingSchedule } from '../_hooks/useVestingSchedule';

export function VestingRewards() {
  const account = useAccount();

  const { data: vestingSchedule, isFetching: isScheduleFetching } = useVestingSchedule();
  const { data: claimableAmount, isFetching: isClaimableFetching } = useClaimableAmount();
  const blockchainTimestamp = useBlockchainTimestamp();

  const isFetching = isScheduleFetching || isClaimableFetching || blockchainTimestamp.isFetching;

  const hasSchedule = !!vestingSchedule;
  const vestedAmount = hasSchedule ? vestingSchedule.vestedAmount : 0n;
  const totalVesting = hasSchedule ? vestingSchedule.totalVesting : 1n;
  const isDuringCliff = hasSchedule ? vestingSchedule.isDuringCliff : false;

  const claimVesting = useClaimVesting();

  return (
    <>
      <Card>
        <Card.Header title="Vesting rewards" />

        <CardBody>
          <VestedChart hasSchedule={hasSchedule} vestedAmount={vestedAmount} totalVesting={totalVesting} />

          <div className="-mt-28 flex w-full flex-col gap-4">
            <div className="flex w-full items-center justify-between rounded-[4px] border border-default bg-surface-base px-6 py-4">
              <div className="flex items-center gap-2 py-2">
                <p className="text-leading font-medium text-primary">Claimable Now</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="[&_svg]:size-7 [&_svg]:flex-shrink-0">{TOKEN_INFO['zVLT'].icon}</span>
                <p className="text-smallSubheading font-medium text-primary">
                  {!hasSchedule || account.isDisconnected || claimableAmount === undefined
                    ? '-'
                    : formatBigIntWithCommas({ value: claimableAmount, showUnderZero: true })}
                </p>
              </div>
            </div>

            <ConnectedAccount>
              {isFetching ? (
                <Button fullWidth isPending={true} pendingContent="Loading..." />
              ) : isDuringCliff ? (
                <Button fullWidth isDisabled>
                  Cliff period is not over yet
                </Button>
              ) : claimableAmount === undefined || claimableAmount === 0n ? (
                <Button fullWidth isDisabled>
                  Nothing to claim
                </Button>
              ) : (
                <Button
                  fullWidth
                  onPress={() => claimVesting.mutate()}
                  isPending={claimVesting.isPending}
                  pendingContent={
                    claimVesting.isTxPending
                      ? `Claiming...`
                      : claimVesting.isPending
                        ? `Signing Transaction...`
                        : undefined
                  }
                >
                  Claim
                </Button>
              )}
            </ConnectedAccount>
          </div>
        </CardBody>
      </Card>

      <TransactionDialog />
    </>
  );
}

function CardBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[25rem] flex-col items-center justify-between gap-10 rounded-[4px] bg-surface-base p-4">
      {children}
    </div>
  );
}

function VestedChart({
  hasSchedule,
  vestedAmount,
  totalVesting
}: {
  hasSchedule: boolean;
  vestedAmount: bigint;
  totalVesting: bigint;
}) {
  const account = useAccount();

  const percentage = hasSchedule ? Math.min((Number(vestedAmount) / Number(totalVesting)) * 100, 100) : 0;

  return (
    <div className="relative h-[300px] w-full">
      <ChartContainer
        config={{}}
        className="mx-auto aspect-square h-full w-full [&_.recharts-radial-bar-background-sector]:fill-[#EEF0F5]"
      >
        <RadialBarChart
          data={[
            {
              name: 'vested',
              value: percentage
            }
          ]}
          startAngle={200}
          endAngle={-20}
          innerRadius="80%"
          outerRadius="105%"
          barSize={20}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
            <Label
              content={({ viewBox }) => {
                if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                  return (
                    <g>
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                        <tspan
                          x={(viewBox.cx || 0) - 5}
                          y={(viewBox.cy || 0) - 20}
                          className="fill-primary font-heading text-h6"
                        >
                          {hasSchedule && !account.isDisconnected
                            ? formatBigIntWithCommas({ value: vestedAmount, showUnderZero: true })
                            : '-'}
                        </tspan>
                      </text>
                      <text x={(viewBox.cx || 0) - 15} y={(viewBox.cy || 0) + 20} textAnchor="middle">
                        <tspan className="fill-secondary text-small font-normal">Vested to date</tspan>
                      </text>
                      <foreignObject x={(viewBox.cx || 0) + 35} y={(viewBox.cy || 0) + 3} width={30} height={30}>
                        <ContextualHelp variant="info">
                          <ContextualHelpTitle>Vested to date</ContextualHelpTitle>
                          <ContextualHelpDescription>
                            Amount of ZVE that has already been unlocked and is eligible to claim.
                          </ContextualHelpDescription>
                        </ContextualHelp>
                      </foreignObject>
                    </g>
                  );
                }
              }}
            />
          </PolarRadiusAxis>
          <RadialBar dataKey="value" cornerRadius={10} fill="#0A6061" background={{ fill: '#EEF0F5' }} />
        </RadialBarChart>
      </ChartContainer>
    </div>
  );
}

export function VestingRewardsSkeleton() {
  return (
    <Card>
      <Card.Header title="Vesting rewards" />

      <CardBody>
        <Skeleton className="mt-[1.875rem] h-[16.875rem] w-[15.625rem] rounded-md" />
        <div className="flex w-full flex-col gap-4">
          <Skeleton className="h-[4.5rem] w-full rounded-[4px]" />
          <Skeleton className="h-12 w-full rounded-[4px]" />
        </div>
      </CardBody>
    </Card>
  );
}
