import Container from '@/components/container';
import { HeroElement2MobileComponent, HeroElemet1Component, HeroElemet2Component } from '@/components/hero';
import NavigationSection from '@/components/navigation';

export default function Hero() {
  return (
    <div className="relative z-0 h-[33.75rem] overflow-clip bg-element-tertiary lg:h-[45rem]">
      <NavigationSection />

      <Container className="mt-[3.125rem] sm:px-10 md:px-[6.25rem] lg:mt-[10rem]">
        <div className="flex max-w-[21.45rem] flex-col gap-4 sm:max-w-[36rem] lg:gap-[12.5rem]">
          <div className="flex flex-col gap-4">
            <p className="text-h4 text-primary sm:text-h2">Meet the Team</p>
            <p className="text-regular text-primary sm:max-w-full sm:text-leading">
              We come from leading financial institutions and DeFi protocols including JP Morgan Chase, Wells Fargo, and
              Maple Finance.
            </p>
          </div>
        </div>
      </Container>

      <HeroElemet1Component />
      <HeroElemet2Component />
      <HeroElement2MobileComponent className="sm:block lg:hidden" />
    </div>
  );
}
