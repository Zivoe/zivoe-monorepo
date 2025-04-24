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
            Zivoe (”z-eye-voh”) is a Balkan word meaning “to life.” At Zivoe, we believe finance should empower life—not
            limit it. Yet, millions of people around the world are financially excluded, unable to access the credit
            they need to build their futures. Zivoe is changing that. By leveraging blockchain, we connect borrowers and
            lenders across borders, creating an open financial system that is accessible to everyone. With greater
            transparency, efficiency, and fairness, we are reshaping the global credit market—one loan at a time.
          </p>
        </div>
      </Container>
    </div>
  );
}
