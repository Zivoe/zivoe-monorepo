import { Skeleton } from '@zivoe/ui/core/skeleton';

import Container from '@/components/container';
import { HeroAsset } from '@/components/hero/asset';

import StreamedAum from './aum';

export default function AumHeader() {
  return (
    <div className="relative bg-element-primary">
      <Container>
        <div className="flex flex-col gap-2 py-10 text-base lg:py-14">
          <p className="text-regular lg:text-leading">Assets Under Management</p>
          {/* A div, not a p: the streaming fallback is a block element. */}
          <div className="font-heading! text-h3 lg:text-h1">
            <StreamedAum fallback={<Skeleton className="h-[1.2em] w-44 rounded-md" />} />
          </div>
        </div>
      </Container>

      <HeroAsset className="absolute right-0 bottom-0 hidden lg:block" />
    </div>
  );
}
