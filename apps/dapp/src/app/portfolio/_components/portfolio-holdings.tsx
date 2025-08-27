'use client';

import { Link } from '@zivoe/ui/core/link';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { WalletIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { DEPOSIT_TOKENS, DEPOSIT_TOKEN_DECIMALS, Token } from '@/types/constants';

import { formatBigIntWithCommas } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import { useDepositBalances } from '@/hooks/useDepositBalances';

import InfoSection from '@/components/info-section';
import { TOKEN_INFO } from '@/components/token-info';

import { usePortfolio } from '../_hooks/usePortfolio';

export function PortfolioHoldings() {
  return (
    <InfoSection title="Holdings" icon={<WalletIcon />} className="w-full">
      <HoldingsContainer />
    </InfoSection>
  );
}

function HoldingsContainer() {
  const account = useAccount();
  const { data: portfolio, isFetching } = usePortfolio();
  const depositBalances = useDepositBalances();

  const hasZVLTBalance = !!portfolio?.zVLTBalance && portfolio.zVLTBalance > 0n;

  if (account.isPending || isFetching || depositBalances.isFetching)
    return (
      <HoldingsContent>
        <AssetInfo isLoading />
        <AssetInfo isLoading />
        <AssetInfo isLoading />
      </HoldingsContent>
    );

  if (account.isDisconnected)
    return (
      <div className="flex h-[8.5rem] flex-col items-center justify-center gap-2 text-center">
        <h3 className="text-h7 text-primary">Connect Wallet</h3>
        <p className="text-regular text-secondary">Your holdings will appear here once you connect your wallet</p>
      </div>
    );

  return (
    <HoldingsContent>
      <></>
      <AssetInfo
        asset="zVLT"
        balance={formatBigIntWithCommas({ value: portfolio?.zVLTBalance ?? 0n })}
        value={`$${formatBigIntWithCommas({ value: portfolio?.value ?? 0n })}`}
        action={hasZVLTBalance ? { text: 'Redeem', href: '/?view=redeem' } : { text: 'Deposit', href: '/' }}
      />

      {DEPOSIT_TOKENS.map((token) => {
        const balance = depositBalances.data?.[token];
        if (!balance || balance <= 0n) return null;

        const formattedBalance = formatBigIntWithCommas({
          value: balance,
          tokenDecimals: DEPOSIT_TOKEN_DECIMALS[token]
        });

        return (
          <AssetInfo
            key={token}
            asset={token}
            balance={formattedBalance}
            value={`$${formattedBalance}`}
            action={{ text: 'Deposit', href: '/' }}
          />
        );
      })}
    </HoldingsContent>
  );
}

function HoldingsContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(320px,_1fr)_minmax(140px,_1fr)_minmax(140px,_1fr)_1fr] md:gap-0 lg:grid-cols-[minmax(360px,_1fr)_minmax(200px,_1fr)_minmax(200px,_1fr)_1fr] xl:grid-cols-[minmax(360px,_1fr)_minmax(360px,_1fr)_minmax(360px,_1fr)_1fr]">
      <TableHeader title="Asset" />
      <TableHeader title="Balance" />
      <TableHeader title="Value" />
      <TableHeader title="" />

      {children}
    </div>
  );
}

function AssetInfo(
  props: { isLoading: true } | { asset: Token; balance: string; value: string; action: { text: string; href: string } }
) {
  const isLoading = 'isLoading' in props;
  const info = isLoading ? null : TOKEN_INFO[props.asset];

  return (
    <>
      {/* Desktop View */}
      <TableElement>
        <div className="flex items-center gap-3">
          {!info ? (
            <>
              <Skeleton className="size-8 rounded-full" />

              <div className="flex flex-col gap-1 py-0.5">
                <Skeleton className="h-5 w-11 rounded-md" />
                <Skeleton className="h-4 w-[5.75rem] rounded-md" />
              </div>
            </>
          ) : (
            <>
              <span className="[&_svg]:size-8 [&_svg]:flex-shrink-0">{info.icon}</span>

              <div>
                <p className="text-regular text-primary">{info.label}</p>
                <p className="text-small text-secondary">{info.description}</p>
              </div>
            </>
          )}
        </div>
      </TableElement>

      <TableElement>
        {isLoading ? <AssetInfoSkeleton /> : <p className="text-regular text-primary">{props.balance}</p>}
      </TableElement>

      <TableElement>
        {isLoading ? <AssetInfoSkeleton /> : <p className="text-regular text-primary">{props.value}</p>}
      </TableElement>

      <TableElement className="justify-end">
        {isLoading ? (
          <Skeleton className="h-8 w-[4.695rem] rounded-md" />
        ) : (
          <Link variant="border" size="s" href={props.action.href}>
            {props.action.text}
          </Link>
        )}
      </TableElement>

      {/* Mobile View */}
      <div className="flex flex-col gap-4 rounded-xl border border-default p-5 md:hidden">
        <div className="flex items-center gap-3">
          {!info ? (
            <>
              <Skeleton className="size-8 rounded-full" />

              <div className="flex flex-col gap-1 py-0.5">
                <Skeleton className="h-6 w-11 rounded-md" />
                <Skeleton className="h-4 w-[5.75rem] rounded-md" />
              </div>
            </>
          ) : (
            <>
              <span className="[&_svg]:size-8 [&_svg]:flex-shrink-0">{info.icon}</span>

              <div>
                <p className="text-smallSubheading font-medium text-primary">{info.label}</p>
                <p className="text-small text-secondary">{info.description}</p>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            {isLoading ? <AssetInfoSkeleton /> : <p className="text-h7 text-primary">{props.balance}</p>}
            <p className="text-small text-secondary">Balance</p>
          </div>

          <div>
            {isLoading ? <AssetInfoSkeleton /> : <p className="text-h7 text-primary">{props.value}</p>}
            <p className="text-small text-secondary">Value</p>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-10 w-full rounded-md"></Skeleton>
        ) : (
          <Link variant="border" size="m" fullWidth href="/">
            Deposit
          </Link>
        )}
      </div>
    </>
  );
}

function AssetInfoSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('h-6 w-28 rounded-md', className)} />;
}

function TableHeader({ title }: { title: string }) {
  return (
    <div className="hidden bg-surface-elevated px-4 py-2 md:block">
      <p className="text-small text-secondary">{title}</p>
    </div>
  );
}

function TableElement({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('hidden h-[5.25rem] items-center px-4 md:flex', className)}>{children}</div>;
}
