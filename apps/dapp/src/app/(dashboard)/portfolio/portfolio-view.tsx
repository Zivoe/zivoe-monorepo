'use client';

import { useEffect, useState } from 'react';

import { type Address } from 'viem';

import { useAccount } from '@/hooks/useAccount';

import ConnectedAccount from '@/components/connected-account';
import Page from '@/components/page';

import { type TransactionIdentity } from '@/centrifuge';
import { usePortfolio } from '@/portfolio';

import { Actions } from './actions';
import { Activity } from './activity';
import { BalanceChart } from './balance-chart';
import { PortfolioHero } from './hero';
import { PortfolioGrid } from './portfolio-grid';
import { PortfolioSkeleton } from './portfolio-skeleton';
import { PreviewWallets } from './preview-wallets';
import { Redemptions } from './redemptions';
import { Tokens } from './tokens';

export type PortfolioVaultLink = { name: string; path: string };

const SDK_PATIENCE_MS = 8_000;

export default function PortfolioView({
  zivoeVault,
  identities,
  previewWallets
}: {
  zivoeVault: PortfolioVaultLink;
  identities: [TransactionIdentity, ...Array<TransactionIdentity>];
  /** Empty everywhere but local and Preview deployments with the switcher enabled. */
  previewWallets: Array<Address>;
}) {
  const account = useAccount();
  const [previewAddress, setPreviewAddress] = useState<Address | null>(null);
  const address = previewAddress ?? account.address;

  // The wallet SDK normally settles in well under a second. Past this, the
  // skeleton would sit there for good (an SDK that cannot start never reports
  // it), so the page falls back to the connect prompt, whose button keeps
  // showing the SDK's own pending state.
  const [isSdkSlow, setIsSdkSlow] = useState(false);
  useEffect(() => {
    if (!account.isPending) return;
    const timer = setTimeout(() => setIsSdkSlow(true), SDK_PATIENCE_MS);
    return () => clearTimeout(timer);
  }, [account.isPending]);

  return (
    // The soft canvas the cards lift off; the hero and the preview bar paint their own.
    <div className="bg-surface-elevated">
      {previewWallets.length > 0 && (
        <PreviewWallets wallets={previewWallets} selected={previewAddress} onSelect={setPreviewAddress} />
      )}

      {address ? (
        // Keyed by wallet: dialogs and range selections belong to the wallet on screen.
        <WalletPortfolio
          key={address.toLowerCase()}
          zivoeVault={zivoeVault}
          identities={identities}
          address={address}
          isPreview={previewAddress !== null}
        />
      ) : account.isPending && !isSdkSlow ? (
        <PortfolioSkeleton zivoeVault={zivoeVault} shareSymbol={identities[0].centrifugeVault.shareClass.symbol} />
      ) : (
        <Page className="min-h-120 items-center justify-center gap-6 text-center">
          <h1 className="font-heading! text-h5 text-primary lg:text-h4">Your portfolio</h1>
          <p className="max-w-md text-regular text-secondary">
            {isSdkSlow && account.isPending
              ? 'The wallet connection is taking longer than usual. Reload the page to try again.'
              : 'Connect your wallet to see your holdings, redemption requests and activity across every network.'}
          </p>
          <ConnectedAccount fullWidth={false}>{null}</ConnectedAccount>
        </Page>
      )}
    </div>
  );
}

function WalletPortfolio({
  zivoeVault,
  identities,
  address,
  isPreview
}: {
  zivoeVault: PortfolioVaultLink;
  identities: [TransactionIdentity, ...Array<TransactionIdentity>];
  address: Address;
  isPreview: boolean;
}) {
  const { portfolio, isHolding, sharePrice, refetch, isRefetching } = usePortfolio({
    identities,
    accountAddress: address
  });
  const shareClass = identities[0].centrifugeVault.shareClass;
  // The share token's whereabouts once every chain has answered: the chart names what sits outside the wallet.
  // `tokens` lists only what the wallet holds, so no share row means zero, not "still loading".
  const shareAmounts =
    portfolio.totalD18 === null
      ? undefined
      : (portfolio.tokens.find((token) => token.kind === 'share') ?? {
          wallet: 0n,
          inRedemption: 0n,
          readyToClaim: 0n
        });

  return (
    <>
      <PortfolioHero
        address={address}
        isPreview={isPreview}
        portfolio={portfolio}
        isHolding={isHolding}
        refetch={refetch}
        isRefetching={isRefetching}
      />

      <Page className="gap-6">
        <PortfolioGrid
          main={
            <>
              <BalanceChart
                identities={identities}
                accountAddress={address}
                shareSymbol={shareClass.symbol}
                shareAmounts={shareAmounts}
              />
              <Tokens portfolio={portfolio} isHolding={isHolding} refetch={refetch} isRefetching={isRefetching} />
            </>
          }
          aside={
            <>
              <Actions zivoeVault={zivoeVault} />
              <Redemptions
                identities={identities}
                portfolio={portfolio}
                isHolding={isHolding}
                sharePrice={sharePrice}
                zivoeVault={zivoeVault}
                refetch={refetch}
              />
              <Activity identities={identities} accountAddress={address} />
            </>
          }
        />
      </Page>
    </>
  );
}
