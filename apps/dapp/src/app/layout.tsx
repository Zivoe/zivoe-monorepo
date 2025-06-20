import { type ReactNode } from 'react';

import { Metadata } from 'next';
import { Instrument_Sans, Libre_Baskerville } from 'next/font/google';

import '@zivoe/ui/globals.css';

import ChainalysisAssessmentDialog from './_components/chainalysis-assessment-dialog';
import Footer from './_components/footer';
import Header from './_components/header';
import Providers from './_components/providers';
import { WelcomeDialog } from './_components/welcome-dialog';

const title = 'Zivoe | RWA Credit Protocol';
const description =
  'Zivoe is a real-world asset (RWA) credit protocol offering qualified users tokenized exposure to the consumer credit market.';

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

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${libreBaskerville.variable} ${instrumentSans.variable} h-full antialiased`}>
      <body className="flex h-full flex-col">
        <Providers>
          <Header />

          <div className="flex h-full flex-col justify-between">
            <div>{children}</div>
            <Footer />
          </div>

          <ChainalysisAssessmentDialog />
        </Providers>

        <WelcomeDialog />
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
