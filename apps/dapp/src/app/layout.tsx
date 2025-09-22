import { type ReactNode } from 'react';

import { Metadata } from 'next';
import { Instrument_Sans, Libre_Baskerville } from 'next/font/google';
import { headers } from 'next/headers';

import { Analytics } from '@vercel/analytics/next';
import { cookieToInitialState } from 'wagmi';

import '@zivoe/ui/globals.css';

import { env } from '@/env';

import ChainalysisAssessmentDialog from './_components/chainalysis-assessment-dialog';
import Footer from './_components/footer';
import Header from './_components/header';
import Providers, { wagmiConfig } from './_components/providers';

const title = 'Zivoe | RWA Credit Protocol';
const description =
  'Zivoe is a real-world asset (RWA) credit protocol offering qualified users tokenized exposure to the private credit market.';

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

export default async function Layout({ children }: { children: ReactNode }) {
  const headersList = await headers();
  const initialState = cookieToInitialState(wagmiConfig, headersList.get('cookie'));

  return (
    <html lang="en" className={`${libreBaskerville.variable} ${instrumentSans.variable} h-full antialiased`}>
      <body className="flex h-full flex-col">
        <Providers initialState={initialState}>
          <Header />

          <div className="flex h-full flex-col justify-between bg-surface-base">
            {children}
            <Footer />
          </div>

          <ChainalysisAssessmentDialog />
        </Providers>

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
