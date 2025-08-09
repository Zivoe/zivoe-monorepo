'use client';

import { ReactNode, useMemo, useState } from 'react';

import Image from 'next/image';

import { Dialog, DialogContent } from '@zivoe/ui/core/dialog';
import { Button } from '@zivoe/ui/core/button';
import { Link } from '@zivoe/ui/core/link';
import { LinkedInIcon, XIcon } from '@/components/footer/assets';
import { ArrowRightIcon } from '@zivoe/ui/icons';

import Container from '@/components/container';

export default function Team() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const selected = useMemo(() => TEAM_MEMBERS.find((m) => m.name === selectedName) ?? null, [selectedName]);

  return (
    <>
    <Container className="grid max-w-fit grid-cols-1 gap-4 px-8 py-8 sm:grid-cols-2 sm:gap-8 sm:px-4 sm:py-[10rem] md:grid-cols-3 lg:max-w-[60rem] xl:max-w-[73.5rem] xl:grid-cols-4">
      {TEAM_MEMBERS.map(({ name, title, image }) => (
          <TeamMember key={name} name={name} title={title} onOpen={() => { setSelectedName(name); setIsOpen(true); }}>
            <Image src={image} alt={name} width={262} height={322} className="h-[322px] w-[262px] object-cover" />
        </TeamMember>
      ))}
    </Container>

      <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
        <DialogContent isFullScreen showFullScreenHeader={false} isDismissable={false} className="bg-[#10393B] text-base">
          {selected && (
            <div className="relative mx-auto w-full max-w-[120rem] flex-1">
              {/* Background accents */}
              <div className="pointer-events-none fixed right-0 top-0 z-0 h-[8rem] w-[12rem] bg-[#038788] md:left-0 md:right-auto md:h-[20rem] md:w-[28rem]" />
              <div className="pointer-events-none fixed bottom-0 left-0 z-0 h-[6rem] w-[12rem] bg-[#F08F48] md:left-auto md:right-0 md:h-[7.5rem] md:w-[20rem]" />

              {/* Content */}
              <div className="relative z-10 mt-3 md:mt-20 lg:mt-20 flex w-full max-w-[90rem] min-w-0 flex-col gap-10 px-2 py-6 sm:px-6 md:flex-row md:items-start md:gap-16 lg:-ml-[8em] xl:-ml-[8em]">

                <div className="relative mx-auto w-full max-w-[21rem] shrink-0 rounded-lg md:ml-0 lg:ml-[-2rem] xl:ml-[-4rem]">
                  {/* Mobile: small close inside image corner */}
                  <button
                    aria-label="Close team member"
                    onClick={() => setIsOpen(false)}
                    className="absolute right-2 top-2 z-20 text-h3 text-base md:hidden top-[-40px]"
                  >
                    ×
                  </button>
                  {/* Desktop: noticeable close above image, aligned to its top-left edge */}
                  <div className="absolute left-0 z-20 hidden md:block md:top-[-40px]">
                    <button
                      aria-label="Close"
                      onClick={() => setIsOpen(false)}
                      className="text-h5 text-white leading-none hover:opacity-80 focus-visible:outline-none"
                    >
                      ×
                    </button>
                  </div>
                  <Image
                    src={selected.image}
                    alt={selected.name}
                    width={300}
                    height={300}
                    className="h-auto w-full rounded-lg object-cover"
                  />
                </div>

                <div className="flex w-full max-w-full flex-col gap-6 text-base md:pt-2 md:basis-[44rem] lg:basis-[60rem] lg:min-w-[30rem] xl:basis-[70rem] xl:min-w-[30rem] md:flex-[1.2]">
                  {/* Row 1: Name */}
                  <p className="hyphens-auto text-balance text-h4 leading-tight sm:text-h3 lg:text-h2">{selected.name}</p>
                  {/* Row 2: Description */}
                  {selected.title ? (
                    <p className="hyphens-auto text-pretty text-regular opacity-80">{selected.title}</p>
                  ) : null}
                  {/* Row 3: Bio */}
                  <p className="break-words hyphens-auto text-pretty text-leading opacity-90">{selected.bio ?? 'Bio coming soon.'}</p>

                  {(selected.linkedIn || selected.x) && (
                    <div className="mt-2 flex w-full items-center gap-3">
                      {selected.x && (
                        <Link
                          href={selected.x}
                          target="_blank"
                          hideExternalLinkIcon
                          variant="link-base"
                          size="m"
                          className="grid size-12 place-items-center rounded-[10px] bg-[#038788] text-white"
                        >
                          <XIcon color="currentColor" />
                        </Link>
                      )}
                      {selected.linkedIn && (
                        <Link
                          href={selected.linkedIn}
                          target="_blank"
                          hideExternalLinkIcon
                          variant="link-base"
                          size="m"
                          className="grid size-12 place-items-center rounded-[10px] bg-element-neutral-contrast-subtle"
                        >
                          <LinkedInIcon color="white" />
                        </Link>
                      )}

                      {/* Mobile: show the Next button inline with socials */}
                      <Button
                        variant="primary-light"
                        size="m"
                        className="group md:hidden ml-auto"
                        onPress={() => {
                          if (!selected) return;
                          const idx = TEAM_MEMBERS.findIndex((m) => m.name === selected.name);
                          if (idx < 0 || TEAM_MEMBERS.length === 0) return;
                          const nextIndex = (idx + 1) % TEAM_MEMBERS.length;
                          const nextName = TEAM_MEMBERS[nextIndex]?.name;
                          if (!nextName) return;
                          setSelectedName(nextName);
                        }}
                      >
                        Next
                        <ArrowRightIcon className="ml-2 transition-transform group-hover:translate-x-0.5" />
                      </Button>
                    </div>
                  )}

                  <div className="mt-8 hidden w-full justify-center md:flex md:justify-end">
                    <Button
                      variant="primary-light"
                      size="m"
                      className="group"
                      onPress={() => {
                        if (!selected) return;
                        const idx = TEAM_MEMBERS.findIndex((m) => m.name === selected.name);
                        if (idx < 0 || TEAM_MEMBERS.length === 0) return;
                        const nextIndex = (idx + 1) % TEAM_MEMBERS.length;
                        const nextName = TEAM_MEMBERS[nextIndex]?.name;
                        if (!nextName) return;
                        setSelectedName(nextName);
                      }}
                    >
                      Next team member
                      <ArrowRightIcon className="ml-2 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TeamMember({ name, title, children, onOpen }: { name: string; title: string; children: ReactNode; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group flex h-full max-w-[262px] cursor-pointer flex-col text-left outline-none"
      aria-label={`Open profile for ${name}`}
    >
      <div className="relative overflow-hidden">
      {children}
        <div className="pointer-events-none absolute inset-0 bg-element-primary/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      </div>

      <div className="flex flex-grow flex-col gap-2 bg-surface-elevated px-6 py-5">
        <p className="text-subheading text-primary">{name}</p>
        <p className="text-regular text-primary">{title}</p>
      </div>
    </button>
  );
}

type TeamMemberData = {
  name: string;
  title: string;
  image: string;
  bio?: string;
  linkedIn?: string;
  x?: string;
};

const TEAM_MEMBERS: Array<TeamMemberData> = [
  {
    name: 'Jay Abbasi',
    title: 'Founder',
    image: '/team/jay.png',
    bio:
      'Entrepreneur with 20+ years of executive leadership in finance and technology. Former CEO of Plain Green Lending, where he drove nationwide expansion and growth.',
    linkedIn: 'https://www.linkedin.com/in/jay-abbasi/',
    x: 'https://x.com/jayabbasi'
  },
  {
    name: 'Kristal Gruevski',
    title: 'Founder & General Counsel',
    image: '/team/kristal.png',
    bio:
      'Business lawyer with over a decade of experience in corporate law, compliance, and government relations. Former General Counsel at Atoske.',
    linkedIn: 'https://www.linkedin.com/in/kristal-gruevski/',
    x: 'https://x.com/HumbleGal__'
  },
  {
    name: 'John Quarnstrom',
    title: 'Head of Technology',
    image: '/team/john.png',
    bio:
      'Solidity engineer with nearly a decade of blockchain development experience. Early engineer at Maple Finance and holder of the Certificate in Quantitative Finance.',
    linkedIn: 'https://www.linkedin.com/in/johnny-q/',
    x: 'https://x.com/ZivoeJohn'
  },
  {
    name: 'Thor Abbasi',
    title: 'Head of Investor Relations',
    image: '/team/thor.png',
    bio:
      'Leads investor relations, community management, and operations at Zivoe. Active in crypto since 2017, with a background in finance and data science.',
    linkedIn: 'https://www.linkedin.com/in/thor-abbasi/',
    x: 'https://x.com/thorabbasi'
  },
  {
    name: 'Dennis Baca',
    title: 'Head of Product',
    image: '/team/dennis.png',
    bio:
      'Product leader with expertise in both traditional and on-chain finance. Former M&A Analyst at Family First.',
    x: 'https://x.com/TheDennisBaca'
  },
  {
    name: 'Walt Ramsey',
    title: 'Head of Risk',
    image: '/team/walt.png',
    bio:
      'Credit risk leader with 20+ years of experience managing consumer credit portfolios at top financial institutions. Held senior risk roles at JP Morgan Chase, Lloyds Bank, Elevate, and Liberty Lending.',
    linkedIn: 'https://www.linkedin.com/in/walt-ramsey-109755/'
  },
  {
    name: 'Stephanie Puzzo',
    title: 'Head of Marketing',
    image: '/team/stephanie.png',
    bio:
      'Marketing strategist with 10+ years in B2B and B2C marketing. Former marketing leader at Mercantile and Capital One.',
    linkedIn: 'https://www.linkedin.com/in/stephaniepuzzo/'
  },
  {
    name: 'Alex Serban',
    title: 'Lead Engineer',
    image: '/team/alex.png',
    bio:
      'Full-stack developer with 4+ years of experience building applications that integrate on-chain components.',
    linkedIn: 'https://www.linkedin.com/in/alexsserban/'
  },
  {
    name: 'Chad Deal',
    title: 'Head of Compliance',
    image: '/team/chad.png',
    bio:
      'Lending industry veteran with over 20 years of experience. Former Chief Operating Officer at Plain Green.',
    linkedIn: 'https://www.linkedin.com/in/chad-deal-6b24135b/'
  },
  {
    name: 'Shannon Wright',
    title: 'Controller',
    image: '/team/shannon.png',
    bio:
      'Certified Public Accountant with corporate finance experience at USA Rare Earth, CONMED Corporation, and FIS.',
    linkedIn: 'https://www.linkedin.com/in/shannonwright9339/'
  }
  // Bo Zhang can be added here when asset is available
  // {
  //   name: 'Bo Zhang',
  //   title: 'Advisor',
  //   image: '/team/bo.png',
  //   bio:
  //     "Former Multi-Strategy Portfolio Manager at JP Morgan’s Chief Investment Office. Currently Head of Investments at Fyde, advising on $800M+ in capital.",
  //   linkedIn: 'https://www.linkedin.com/in/bo-zhang-6097a739/'
  // }
];
