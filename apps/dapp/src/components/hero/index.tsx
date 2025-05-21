import { ZVltLogo } from '@zivoe/ui/icons';

import Container from '../container';
import { HeroAsset } from './asset';

export default function Hero({ title, description }: { title: string; description: string }) {
  return (
    <div className="relative bg-element-primary">
      <Container>
        <div className="flex gap-2 py-8 lg:py-12">
          <ZVltLogo className="size-10 lg:size-12" />

          <div className="flex flex-col gap-2 text-base">
            <p className="text-h4 lg:text-h2">{title}</p>
            <p className="text-regular lg:text-leading">{description}</p>
          </div>
        </div>
      </Container>

      <HeroAsset className="absolute bottom-0 right-0 hidden lg:block" />
    </div>
  );
}
