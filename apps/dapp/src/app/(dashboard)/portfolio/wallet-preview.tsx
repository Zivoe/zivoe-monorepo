import { type Address } from 'viem';

import { Button } from '@zivoe/ui/core/button';

import { truncateAddress } from '@/lib/utils';

import Container from '@/components/container';

export const PREVIEW_WALLETS = [
  '0xcf43d6670800f8eda45451bf1a5cf57162199543',
  '0x5611ab9a1be761187df7d0377beb4c45a1f69296',
  '0xe350c554ba695037e4040a60e8844a44c6c3a406',
  '0xa76c3662daf3e250e5ff61efe14351c5221049b2',
  '0xda8907993c37cfd742fa308d23b2811cf72545f3',
  '0xfa071893e752e2400caa33ce14df48c8ac10c035'
] as const satisfies ReadonlyArray<Address>;

export function WalletPreview({
  selected,
  onSelect
}: {
  selected: Address | null;
  onSelect: (address: Address | null) => void;
}) {
  return (
    <div className="border-b border-default bg-element-primary-light">
      <Container className="gap-2 py-3">
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-small font-medium text-primary">Preview wallet</p>
          <p className="text-extraSmall text-secondary">Development only · Vault actions use your connected wallet.</p>
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
          {PREVIEW_WALLETS.map((address) => (
            <Button
              key={address}
              variant={selected === address ? 'primary' : 'border-light'}
              size="s"
              aria-label={`Preview ${address}`}
              aria-pressed={selected === address}
              onPress={() => onSelect(address)}
              className="font-normal tabular-nums"
            >
              <span title={address}>{truncateAddress(address)}</span>
            </Button>
          ))}
        </div>
      </Container>
    </div>
  );
}
