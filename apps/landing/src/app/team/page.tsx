import Footer from '../../components/footer';
import Newsletter from '../../components/newsletter';
import Hero from '../about-us/_components/hero';
import Mission from '../about-us/_components/mission';
import Team from '../about-us/_components/team';

export const dynamic = 'force-static';

export default function TeamPage() {
  return (
    <>
      <Hero />
      <Team />
      <Mission />
      <Newsletter />
      <Footer />
    </>
  );
}
