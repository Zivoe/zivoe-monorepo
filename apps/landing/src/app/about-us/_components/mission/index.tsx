import Container from '@/components/container';

import { MissionIcon } from './icon';

export default function Mission() {
  return (
    <div className="bg-element-tertiary-gentle">
      <Container className="w-full items-start gap-10 py-10 sm:w-fit sm:items-center sm:py-32">
        <MissionIcon />

        <div className="flex flex-col items-start gap-4 sm:max-w-[31.25rem] sm:items-center lg:max-w-[45rem]">
          <p className="!font-heading text-h5 text-primary sm:text-h3">Our Mission</p>
          <p className="text-regular text-primary sm:text-center sm:text-leading">
            Zivoe (“z-eye-voh”) is a Balkan word meaning “to life,” reflecting our belief that finance should improve
            life, not limit it. We are modernizing private credit by connecting on-chain capital to real-world lending
            opportunities with greater transparency, access, and efficiency. By building open financial infrastructure
            that enables sustainable yield and expands credit access to underserved markets, Zivoe is reshaping how
            capital moves across the global lending landscape.
          </p>
        </div>
      </Container>
    </div>
  );
}
