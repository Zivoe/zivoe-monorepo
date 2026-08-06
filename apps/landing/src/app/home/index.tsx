import { Separator } from '@zivoe/ui/core/separator';

import Footer from '../../components/footer';
import Diversify from './_components/diversify';
import Experience from './_components/experience';
import Hero from './_components/hero';
import HowItWorks from './_components/how-it-works';

// TODO: Portfolio and Infrastructure are hidden for the Centrifuge migration, not retired. Restore
// them (and their imports) once the post-migration portfolio data is available, or delete the
// sections outright if they are not coming back.

export default function Home() {
  return (
    <>
      <Hero />
      <Diversify />
      <Separator />
      <HowItWorks />
      {/* <Portfolio /> */}
      {/* <Infrastructure /> */}
      <Experience />
      <Footer />
    </>
  );
}
