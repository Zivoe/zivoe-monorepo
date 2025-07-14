import { ReactNode } from 'react';

import Image from 'next/image';

import Container from '@/components/container';

export default function Team() {
  return (
    <Container className="grid max-w-fit grid-cols-1 gap-4 px-8 py-8 sm:grid-cols-2 sm:gap-8 sm:px-4 sm:py-[10rem] md:grid-cols-3 lg:max-w-[60rem] xl:max-w-[73.5rem] xl:grid-cols-4">
      {TEAM_MEMBERS.map(({ name, title, image }) => (
        <TeamMember key={name} name={name} title={title}>
          <Image src={image} alt={name} width={262} height={322} />
        </TeamMember>
      ))}
    </Container>
  );
}

function TeamMember({ name, title, children }: { name: string; title: string; children: ReactNode }) {
  return (
    <div className="flex h-full max-w-[262px] flex-col">
      {children}

      <div className="flex flex-grow flex-col gap-2 bg-surface-elevated px-6 py-5">
        <p className="text-subheading text-primary">{name}</p>
        <p className="text-regular text-primary">{title}</p>
      </div>
    </div>
  );
}

const TEAM_MEMBERS: Array<{ name: string; title: string; image: string }> = [
  {
    name: 'Jay Abbasi',
    title: 'Founder',
    image: '/team/jay.png'
  },
  {
    name: 'Kristal Gruevski',
    title: 'Founder & General Counsel',
    image: '/team/kristal.png'
  },
  {
    name: 'John Quarnstrom',
    title: 'Head of Technology',
    image: '/team/john.png'
  },
  {
    name: 'Thor Abbasi',
    title: 'Head of Investor Relations',
    image: '/team/thor.png'
  },
  {
    name: 'Dennis Baca',
    title: 'Head of Product',
    image: '/team/dennis.png'
  },
  {
    name: 'Walt Ramsey',
    title: 'Head of Risk',
    image: '/team/walt.png'
  },
  {
    name: 'Stephanie Puzzo',
    title: 'Head of Marketing',
    image: '/team/stephanie.png'
  },
  {
    name: 'Alex Serban',
    title: 'Lead Engineer',
    image: '/team/alex.png'
  },
  {
    name: 'Chad Deal',
    title: 'Head of Compliance',
    image: '/team/chad.png'
  },
  {
    name: 'Shannon Wright',
    title: 'Controller',
    image: '/team/shannon.png'
  }
];
