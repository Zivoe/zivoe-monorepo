import { type ReactNode, Suspense } from 'react';

import { Instrument_Sans, Libre_Baskerville } from 'next/font/google';
import { connection } from 'next/server';

import '@zivoe/ui/globals.css';

import Footer from './_components/footer';
import Header from './_components/header';
import Providers from './_components/providers';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${libreBaskerville.variable} ${instrumentSans.variable} h-full antialiased`}>
      <body className="flex h-full flex-col">
        <Suspense>
          <ProvidersWrapper>
            <Header />

            <div className="flex h-full flex-col justify-between">
              <div>{children}</div>
              <Footer />
            </div>
          </ProvidersWrapper>
        </Suspense>
      </body>
    </html>
  );
}

async function ProvidersWrapper({ children }: { children: ReactNode }) {
  await connection();
  return <Providers>{children}</Providers>;
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
