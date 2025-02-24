import { type ReactNode } from 'react';

import '@zivoe/ui/globals.css';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="antialiased">
      <body>{children}</body>
    </html>
  );
}
