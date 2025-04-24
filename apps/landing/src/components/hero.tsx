import { cn } from '@zivoe/ui/lib/tw-utils';

import { HeroElement1 } from '@/app/home/_components/hero/element-01';
import { HeroElement2 } from '@/app/home/_components/hero/element-02';
import { HeroElement2Mobile } from '@/app/home/_components/hero/element-02-mobile';
import { HeroElement2Tablet } from '@/app/home/_components/hero/elemet-02-tablet';

export function HeroElemet1Component() {
  return (
    <div className="absolute -right-[12%] -top-[18%] -z-20 hidden h-full w-full grid-cols-2 items-end gap-4 lg:grid xl:-right-[10%] 2xl:-right-[8%]">
      <div></div>
      <div className="flex w-full justify-end">
        <HeroElement1 className="-z-20" />
      </div>
    </div>
  );
}

export function HeroElemet2Component() {
  return (
    <div className="absolute bottom-0 left-0 -z-10 hidden h-full w-full grid-cols-3 items-end gap-4 lg:grid">
      <div></div>
      <div className="col-span-2 flex w-full justify-end">
        <HeroElement2 className="mt-[20px] xl:mt-[0px]" />
      </div>
    </div>
  );
}

export function HeroElement2TabletComponent() {
  return <HeroElement2Tablet className="absolute bottom-0 right-0 -z-10 hidden w-[95%] sm:block lg:hidden" />;
}

export function HeroElement2MobileComponent({ className }: { className?: string }) {
  return <HeroElement2Mobile className={cn('absolute bottom-0 right-0 -z-10 sm:hidden', className)} />;
}
