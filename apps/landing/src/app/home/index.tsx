import { Separator } from '@zivoe/ui/core/separator';

import Footer from '../../components/footer';
import Diversify from './_components/diversify';
import Experience from './_components/experience';
import Hero from './_components/hero';
import HowItWorks from './_components/how-it-works';
import Infrastructure from './_components/infrastructure';
import Portfolio from './_components/portfolio';

export default function Home() {
  return (
    <>
      <Hero />
      <Diversify />
      <Separator />
      <HowItWorks />
      <Portfolio />
      <Infrastructure />
      <Experience />
      <Footer />
    </>
  );
}
