import { ReactNode } from 'react';

import NextLink from 'next/link';

import { ZivoeLogo } from '@zivoe/ui/assets/zivoe-logo';
import { Link } from '@zivoe/ui/core/link';

import Container from '@/components/container';

import { DiscordIcon, LinkedInIcon, TelegramIcon, XIcon, YoutubeIcon } from './assets';

export default function Footer() {
  return (
    <div className="bg-surface-brand">
      <Container className="py-10 sm:px-10 xl:pt-20">
        <div className="flex w-full flex-col gap-20 lg:flex-row lg:justify-between lg:gap-14 xl:gap-20">
          <div className="flex flex-col gap-8">
            <ZivoeLogo type="light" />

            <div className="flex items-center gap-6">
              {SOCIALS.map(({ href, icon }) => (
                <NextLink href={href} key={href} className="text-base/50 hover:text-base">
                  {icon}
                </NextLink>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 gap-y-10 xl:gap-x-8">
            {FOOTER_SECTIONS.map(({ title, links }) => (
              <FooterSection key={title} title={title} links={links} />
            ))}
          </div>
        </div>

        <div className="mt-16 flex w-full flex-col justify-between gap-8 lg:mt-14 lg:flex-row">
          <p className="text-small text-base">©Zivoe 2025. All Right Reserved.</p>

          <div className="order-2 flex gap-8 lg:order-1">
            <Link href="/" variant="link-base" size="s">
              Terms of Use
            </Link>

            <Link href="/" variant="link-base" size="s">
              Reg S Complicance
            </Link>
          </div>
        </div>

        <p className="mt-12 text-extraSmall text-disabled lg:mt-20">
          Zivoe is a technology services provider. Use of the Zivoe Protocol involves risks, including but not limited
          to the potential loss of digital assets. Before using the Zivoe Protocol, you should review our documentation
          to ensure you understand how the Protocol works. As described in our Terms, the Zivoe Protocol is provided on
          an “as is” and “as available” basis, at your own risk. We explicitly disclaim any representation or warranties
          of any kind relating to the Protocol, and no developer or entity will be liable for claims or damages of any
          kind associated with use or inability to use the Protocol.
        </p>
      </Container>
    </div>
  );
}

function FooterSection({ title, links }: { title: string; links: Array<FooterSectionLink> }) {
  return (
    <div className="flex w-[9.6875rem] flex-col gap-6 lg:w-[12.5rem]">
      <p className="!font-heading text-regular text-tertiary">{title}</p>

      <div className="flex flex-col gap-3">
        {links.map(({ href, label }) => (
          <Link key={label} href={href} variant="link-base" size="s">
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

type FooterSectionLink = { href: string; label: string };

const FOOTER_SECTIONS: Array<{ title: string; links: Array<FooterSectionLink> }> = [
  {
    title: 'Explore',
    links: [
      { href: '/', label: 'Newsletter' },
      { href: '/', label: 'Docs' },
      { href: '/', label: 'GitHub' },
      { href: '/', label: 'Audits' },
      { href: '/', label: 'FAQ' }
    ]
  },
  {
    title: 'Governance',
    links: [
      { href: '/', label: 'Vote' },
      { href: '/', label: 'Forum' }
    ]
  },
  {
    title: 'Company',
    links: [
      { href: '/', label: 'About' },
      { href: '/', label: 'Media Kit' },
      { href: '/', label: 'Contact Us' }
    ]
  }
];

const SOCIALS: Array<{ href: string; icon: ReactNode }> = [
  {
    href: 'https://x.com/zivoe',
    icon: <XIcon />
  },
  {
    href: 'https://discord.gg/zivoe',
    icon: <DiscordIcon />
  },
  {
    href: 'https://t.me/zivoe',
    icon: <TelegramIcon />
  },
  {
    href: 'https://www.linkedin.com/company/zivoe',
    icon: <LinkedInIcon />
  },
  {
    href: 'https://www.youtube.com/@zivoe',
    icon: <YoutubeIcon />
  }
];
