import { Separator } from '@zivoe/ui/core/separator';

import Diversify from './_components/diversify';
import Hero from './_components/hero';

export default function Home() {
  return (
    <>
      <Hero />
      <Diversify />

      <Separator />
      <div className="h-20 bg-element-base" />
    </>
  );
}
