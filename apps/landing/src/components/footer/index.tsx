import { type ReactNode } from 'react';

import { ZivoeLogo } from '@zivoe/ui/assets/zivoe-logo';
import { Link, NextLink } from '@zivoe/ui/core/link';
import { copyrightLine } from '@zivoe/ui/lib/copyright';

import { EMAILS } from '@/lib/utils';

import Container from '@/components/container';

import { GithubIcon, LinkedInIcon, TelegramIcon, XIcon, YoutubeIcon } from './assets';

export default function Footer() {
  return (
    <div className="bg-surface-brand">
      <Container className="py-10 sm:px-10 xl:pt-20">
        <div className="flex w-full flex-col gap-20 lg:flex-row lg:justify-between lg:gap-14 xl:gap-20">
          <div className="flex flex-col gap-8">
            <NextLink href="/" aria-label="Zivoe home">
              <ZivoeLogo aria-hidden="true" type="light" />
            </NextLink>

            <div className="flex items-center gap-6">
              {SOCIALS.map(({ href, label, icon }) => (
                <NextLink
                  key={href}
                  href={href}
                  target="_blank"
                  aria-label={label}
                  className="text-base opacity-50 hover:opacity-100"
                >
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
          <p className="text-small text-base">{copyrightLine()}</p>

          <div className="order-2 flex gap-8 lg:order-1">
            <Link
              href="https://docs.zivoe.com/terms/terms-of-use-privacy-policy"
              target="_blank"
              hideExternalLinkIcon
              variant="link-base"
              size="s"
            >
              Terms of Use
            </Link>

            <Link
              href="https://docs.zivoe.com/terms/reg-s-compliance"
              target="_blank"
              hideExternalLinkIcon
              variant="link-base"
              size="s"
            >
              Reg S Compliance
            </Link>
          </div>
        </div>

        <p className="mt-12 text-extraSmall text-disabled lg:mt-20">
          Zivoe is a technology services provider. Use of the Zivoe Protocol involves risks, including but not limited
          to the potential loss of digital assets. Before using the Zivoe Protocol, you should review our documentation
          to ensure you understand how the Protocol works. As described in our Terms, the Zivoe Protocol is provided on
          an "as is" and "as available" basis, at your own risk. We explicitly disclaim any representations or
          warranties of any kind relating to the Protocol, and no developer or entity will be liable for claims or
          damages of any kind associated with use or inability to use the Protocol.
        </p>
      </Container>
    </div>
  );
}

function FooterSection({ title, links }: { title: string; links: Array<FooterSectionLink> }) {
  return (
    <div className="flex w-38.75 flex-col gap-6 lg:w-50">
      <p className="font-heading! text-regular text-tertiary">{title}</p>

      <div className="flex flex-col gap-3">
        {links.map(({ href, label, target }) => (
          <Link key={label} href={href} target={target} variant="link-base" size="s">
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

type FooterSectionLink = { href: string; label: string; target?: string };

const FOOTER_SECTIONS: Array<{ title: string; links: Array<FooterSectionLink> }> = [
  {
    title: 'Explore',
    links: [
      { href: '/insights', label: 'Insights' },
      { href: 'https://github.com/Zivoe/zivoe-core-foundry', label: 'GitHub', target: '_blank' },
      { href: '/faq', label: 'FAQ' }
    ]
  },

  {
    title: 'Company',
    links: [
      { href: '/team', label: 'Team' },
      { href: `mailto:${EMAILS.INQUIRE}`, label: 'Contact Us' }
    ]
  }
];

const SOCIALS: Array<{ href: string; label: string; icon: ReactNode }> = [
  {
    href: 'https://x.com/zivoeprotocol',
    label: 'Zivoe on X',
    icon: <XIcon />
  },
  {
    href: 'https://t.me/zivoeprotocol',
    label: 'Zivoe on Telegram',
    icon: <TelegramIcon />
  },
  {
    href: 'https://www.linkedin.com/company/zivoe-finance/',
    label: 'Zivoe on LinkedIn',
    icon: <LinkedInIcon />
  },
  {
    href: 'https://www.youtube.com/@Zivoe',
    label: 'Zivoe on YouTube',
    icon: <YoutubeIcon />
  },
  {
    href: 'https://github.com/Zivoe',
    label: 'Zivoe on GitHub',
    icon: <GithubIcon />
  }
];
