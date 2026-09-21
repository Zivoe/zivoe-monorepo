import { type Metadata } from 'next';

import { JsonLd, SITE_DESCRIPTION, SITE_IMAGE, SITE_ORIGIN, SITE_TITLE, ZIVOE_SOCIAL_LINKS } from '@/lib/seo';

import Home from './home';

export const metadata: Metadata = {
  alternates: {
    canonical: '/'
  }
};

export default async function HomePage() {
  return (
    <>
      <JsonLd data={homePageJsonLd} />
      <Home />
    </>
  );
}

const homePageJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_ORIGIN}/#organization`,
      name: 'Zivoe',
      url: SITE_ORIGIN,
      logo: `${SITE_ORIGIN}/favicon.ico`,
      image: SITE_IMAGE.url,
      sameAs: ZIVOE_SOCIAL_LINKS,
      description: SITE_DESCRIPTION
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_ORIGIN}/#website`,
      name: SITE_TITLE,
      url: SITE_ORIGIN,
      publisher: {
        '@id': `${SITE_ORIGIN}/#organization`
      },
      description: SITE_DESCRIPTION
    }
  ]
};
