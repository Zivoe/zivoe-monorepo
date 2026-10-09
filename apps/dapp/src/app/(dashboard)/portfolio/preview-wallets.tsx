'use client';

import { type Address } from 'viem';

import { Button } from '@zivoe/ui/core/button';

import { truncateAddress } from '@/lib/utils';

import Container from '@/components/container';

/** The read-only wallet switcher: local and Preview deployments only (see server/data/portfolio-preview-wallets.ts). */
export function PreviewWallets({
  wallets,
  selected,
  onSelect
}: {
  wallets: Array<Address>;
  selected: Address | null;
  onSelect: (address: Address | null) => void;
}) {
  return (
    <div className="border-b border-default bg-element-primary-light">
      <Container className="gap-2 py-3">
        <div className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-small font-medium text-primary">Preview wallet</p>
          <p className="text-extraSmall text-secondary">
            Read-only view. Vault actions always use your connected wallet.
          </p>
        </div>

        <div role="group" aria-label="Portfolio wallet preview" className="flex flex-wrap gap-2">
          <Button
            variant={selected === null ? 'primary' : 'border-light'}
            size="s"
            aria-pressed={selected === null}
            onPress={() => onSelect(null)}
          >
            My wallet
          </Button>
          {wallets.map((wallet) => {
            const isSelected = selected?.toLowerCase() === wallet.toLowerCase();
            return (
              <Button
                key={wallet}
                variant={isSelected ? 'primary' : 'border-light'}
                size="s"
                aria-pressed={isSelected}
                onPress={() => onSelect(wallet)}
                className="font-mono"
              >
                {truncateAddress(wallet)}
              </Button>
            );
          })}
        </div>
      </Container>
    </div>
  );
}
