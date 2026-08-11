import { type ReactNode } from 'react';

import { type Metadata } from 'next';
import { Instrument_Sans, Libre_Baskerville } from 'next/font/google';
import { headers } from 'next/headers';

import { Analytics } from '@vercel/analytics/next';
import { cookieToInitialState } from 'wagmi';

import './globals.css';

import { env } from '@/env';

import Providers, { wagmiConfig } from './_components/providers';

// Mirrors the marketing site's title and description on purpose: this is also
// the fallback link preview for every Offering page, so the two surfaces must not
// describe Zivoe differently.
const title = 'Zivoe | The Private Credit Layer for Stablecoins';
const description =
  'Zivoe brings private credit on-chain through one unified platform built for institutional and stablecoin capital.';

const image = {
  url: 'https://zivoe.com/zivoe-hero.jpg',
  alt: title
};

export const metadata: Metadata = {
  title,
  applicationName: title,
  description,
  icons: [{ rel: 'icon', url: '/favicon.ico' }],
  authors: [{ name: 'Zivoe', url: 'https://app.zivoe.com/' }],
  creator: 'Zivoe',
  openGraph: {
    title,
    description,
    type: 'website',
    url: 'https://app.zivoe.com',
    images: [image],
    siteName: title,
    locale: 'en_US'
  },
  twitter: {
    title,
    description,
    card: 'summary_large_image',
    creator: '@zivoeprotocol',
    images: [image]
  }
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const headersList = await headers();
  const initialState = cookieToInitialState(wagmiConfig, headersList.get('cookie'));

  return (
    <html lang="en" className={`${libreBaskerville.variable} ${instrumentSans.variable} h-full antialiased`}>
      <body className="flex h-full flex-col">
        <Providers initialState={initialState}>{children}</Providers>
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
