import { type ReactNode } from 'react';

import { Instrument_Sans, Libre_Baskerville } from 'next/font/google';

import '@zivoe/ui/globals.css';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${libreBaskerville.variable} ${instrumentSans.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}

const libreBaskerville = Libre_Baskerville({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-libre-baskerville'
});

const instrumentSans = Instrument_Sans({
  weight: ['400'],
  subsets: ['latin'],
  variable: '--font-instrument-sans'
});
