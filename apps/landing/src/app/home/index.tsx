import { Separator } from '@zivoe/ui/core/separator';

import Diversify from './_components/diversify';
import Hero from './_components/hero';
import HowItWorks from './_components/how-it-works';
import Portfolio from './_components/portfolio';

export default function Home() {
  return (
    <>
      <Hero />
      <Diversify />
      <Separator />
      <HowItWorks />
      <Portfolio />

      <div className="h-20 bg-element-base" />
    </>
  );
}
