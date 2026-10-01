import Footer from '../../components/footer';
import Diversify from './_components/diversify';
import Experience from './_components/experience';
import Hero from './_components/hero';
import HowItWorks from './_components/how-it-works';
import LighthouseShowcase from './_components/lighthouse-showcase';

// TODO: Portfolio and Infrastructure are hidden for the Centrifuge migration, not retired. Restore
// them (and their imports) once the post-migration portfolio data is available, or delete the
// sections outright if they are not coming back.

export default function Home() {
  return (
    <>
      <Hero />
      <Diversify />
      <LighthouseShowcase />
      <HowItWorks />
      {/* <Portfolio /> */}
      {/* <Infrastructure /> */}
      <Experience />
      <Footer />
    </>
  );
}
