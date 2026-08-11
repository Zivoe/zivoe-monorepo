import { type ComponentProps } from 'react';

export const SITE_ORIGIN = 'https://www.zivoe.com';

export const SITE_TITLE = 'Zivoe | The Private Credit Layer for Stablecoins';

export const SITE_DESCRIPTION =
  'Zivoe brings private credit on-chain through one unified platform built for institutional and stablecoin capital.';

export const SITE_IMAGE = {
  url: `${SITE_ORIGIN}/zivoe-hero.jpg`,
  alt: SITE_TITLE
};

export const ZIVOE_SOCIAL_LINKS = [
  'https://x.com/zivoeprotocol',
  'https://t.me/zivoeprotocol',
  'https://www.linkedin.com/company/zivoe-finance/',
  'https://www.youtube.com/@Zivoe',
  'https://github.com/Zivoe'
];

export function absoluteUrl(path: string) {
  return new URL(path, SITE_ORIGIN).toString();
}

export function JsonLd({
  data,
  ...props
}: Omit<ComponentProps<'script'>, 'dangerouslySetInnerHTML' | 'type'> & { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c')
      }}
      {...props}
    />
  );
}
