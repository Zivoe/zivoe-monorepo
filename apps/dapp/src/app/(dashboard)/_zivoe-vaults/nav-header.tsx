import Container from '@/components/container';
import { HeroAsset } from '@/components/hero/asset';

import NavValue from './nav-value';

/** `nav` is the whole-book NAV in USD: null when unavailable, 'loading' while the page's data is on its way. */
export default function NavHeader({ nav }: { nav: number | null | 'loading' }) {
  return (
    <div className="relative bg-element-primary">
      <Container>
        <div className="flex flex-col gap-2 py-10 text-base lg:py-14">
          <p className="text-regular lg:text-leading">Net Asset Value</p>
          <p className="font-heading! text-h3 lg:text-h1">
            <NavValue nav={nav} skeletonClassName="w-40 bg-neutral-0/15 lg:w-56" />
          </p>
        </div>
      </Container>

      <HeroAsset className="absolute right-0 bottom-0 hidden lg:block" />
    </div>
  );
}
