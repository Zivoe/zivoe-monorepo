'use client';

import { type ReactNode, useState } from 'react';

import { type Address } from 'viem';

import { ZSmbLogo } from '@zivoe/ui/icons';

import { truncateAddress } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';

import ConnectedAccount from '@/components/connected-account';
import Container from '@/components/container';
import { HeroAsset } from '@/components/hero/asset';
import Page from '@/components/page';
import { TokenIconStack } from '@/components/zivoe-vault-icons';

import { type TransactionIdentity } from '@/centrifuge/types';
import { usePortfolio } from '@/portfolio/use-portfolio';

import { Activity } from './activity';
import { WalletChart } from './chart';
import { money } from './common';
import { Allocation, Holdings } from './holdings';
import { QuickActions } from './quick-actions';
import { Requests } from './requests';
import { WalletPreview } from './wallet-preview';

type Props = { identities: ReadonlyArray<TransactionIdentity>; userInfo: ReactNode };
export default function Portfolio(props: Props) {
  const { address: connectedAddress } = useAccount();
  const [previewAddress, setPreviewAddress] = useState<Address | null>(null);
  const isPreview = process.env.NODE_ENV === 'development' && previewAddress !== null;
  const address = isPreview ? previewAddress : connectedAddress;
  return (
    <>
      {process.env.NODE_ENV === 'development' && (
        <WalletPreview selected={previewAddress} onSelect={setPreviewAddress} />
      )}
      {address ? (
        // Remount on account changes: dialogs and local selections belong to the displayed wallet.
        <ConnectedPortfolio key={address.toLowerCase()} {...props} address={address} isPreview={isPreview} />
      ) : (
        <Page className="min-h-120 items-center justify-center gap-6 text-center">
          <h1 className="font-heading! text-h3 text-primary">Your portfolio</h1>
          <p className="text-secondary">
            Connect your wallet to view your holdings and redemption requests across chains.
          </p>
          <ConnectedAccount fullWidth={false}>
            <span>Connecting wallet…</span>
          </ConnectedAccount>
        </Page>
      )}
    </>
  );
}
function ConnectedPortfolio({
  identities,
  userInfo,
  address,
  isPreview
}: Props & { address: Address; isPreview: boolean }) {
  const { model, history, historyQuery, nowMs, refresh } = usePortfolio(identities, address);
  const assetValues = model.complete
    ? model.holdings.reduce(
        (totals, row) => {
          totals[row.asset === 'zSMB' ? 'zsmb' : 'stablecoins'] += row.valueD18 ?? 0n;
          return totals;
        },
        { zsmb: 0n, stablecoins: 0n }
      )
    : null;
  const breakdown = [
    {
      label: 'zSMB',
      value: assetValues?.zsmb ?? null,
      icon: <ZSmbLogo aria-hidden="true" focusable="false" className="size-5 shrink-0" />
    },
    {
      label: 'Stablecoins',
      value: assetValues?.stablecoins ?? null,
      icon: <TokenIconStack symbols={['USDC', 'USDT', 'USD1']} surface="primary" />
    }
  ];

  return (
    <div>
      <div className="relative overflow-hidden bg-element-primary text-base">
        <Container className="relative z-10 gap-6 py-10 lg:py-12">
          <div className="flex w-full flex-wrap items-start justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-3 text-regular">
                {isPreview ? 'Portfolio preview' : 'My Portfolio'}
                <span aria-hidden="true" className="opacity-50">
                  |
                </span>
                <span className="text-small opacity-80" title={address}>
                  {truncateAddress(address)}
                </span>
              </h1>
              <p className="mt-2 font-heading! text-h2 lg:text-h1">{money(model.totalD18)}</p>
            </div>
            {!isPreview && userInfo}
          </div>
          <dl className="flex flex-wrap gap-x-10 gap-y-4">
            {breakdown.map(({ label, value, icon }) => (
              <div key={label}>
                <dt className="flex items-center gap-2 text-small">
                  {icon}
                  <span className="opacity-80">{label}</span>
                </dt>
                <dd className="mt-1 text-leading">{money(value)}</dd>
              </div>
            ))}
          </dl>
          {!model.complete && (
            <p role="status" className="max-w-xl text-small">
              {model.failedChains.length
                ? 'Some chain data is unavailable. Your portfolio total is incomplete.'
                : model.priceUnavailable
                  ? 'Token Price is unavailable.'
                  : model.unpricedAssets.length
                    ? `Unpriced proceeds (${model.unpricedAssets.join(', ')}) prevent a complete total.`
                    : 'Checking balances, requests and Token Price…'}
            </p>
          )}
        </Container>
        <HeroAsset className="absolute right-0 bottom-0 hidden opacity-70 lg:block" />
      </div>
      <Page className="gap-6">
        <div className="flex w-full flex-col gap-6 lg:grid lg:grid-cols-5 lg:items-start">
          <div className="contents lg:col-span-3 lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
            <WalletChart
              history={history}
              nowMs={nowMs}
              loading={historyQuery.isPending}
              error={historyQuery.isError}
              refresh={refresh}
            />
            <Holdings model={model} />
            <QuickActions />
          </div>
          <div className="contents lg:col-span-2 lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
            <Allocation model={model} />
            <Activity identities={identities} accountAddress={address} />
            <Requests model={model} refresh={refresh} />
          </div>
        </div>
      </Page>
    </div>
  );
}
