import { type ReactNode } from 'react';

import { type Metadata } from 'next';
import { Instrument_Sans, Libre_Baskerville } from 'next/font/google';

import { Analytics } from '@vercel/analytics/next';

import '@zivoe/ui/globals.css';

import { SITE_DESCRIPTION, SITE_IMAGE, SITE_ORIGIN, SITE_TITLE } from '@/lib/seo';

import { env } from '@/env';

import Providers from './_components/providers';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: SITE_TITLE,
  applicationName: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: [{ rel: 'icon', url: '/favicon.ico' }],
  authors: [{ name: 'Zivoe', url: SITE_ORIGIN }],
  creator: 'Zivoe',
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: 'website',
    url: SITE_ORIGIN,
    images: [SITE_IMAGE],
    siteName: SITE_TITLE,
    locale: 'en_US'
  },
  twitter: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    card: 'summary_large_image',
    creator: '@zivoeprotocol',
    images: [SITE_IMAGE]
  }
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${libreBaskerville.variable} ${instrumentSans.variable} antialiased`}>
      <body>
        <Providers>{children}</Providers>
        <Analytics mode={env.NEXT_PUBLIC_ENV} />
      </body>
    </html>
  );
}

const libreBaskerville = Libre_Baskerville({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-libre-baskerville'
});

const instrumentSans = Instrument_Sans({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-instrument-sans'
});
