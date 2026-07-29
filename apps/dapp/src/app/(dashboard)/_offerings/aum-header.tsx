import { customNumber } from '@/lib/utils';

import Container from '@/components/container';
import { HeroAsset } from '@/components/hero/asset';

export default function AumHeader({ aum }: { aum: number | null }) {
  return (
    <div className="relative bg-element-primary">
      <Container>
        <div className="flex flex-col gap-2 py-10 text-base lg:py-14">
          <p className="text-regular lg:text-leading">Assets Under Management</p>
          <p className="font-heading! text-h3 lg:text-h1">{aum !== null ? `$${customNumber(aum)}` : '—'}</p>
        </div>
      </Container>

      <HeroAsset className="absolute right-0 bottom-0 hidden lg:block" />
    </div>
  );
}
