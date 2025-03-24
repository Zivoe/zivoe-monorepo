'use client';

import { ReactNode } from 'react';

import { useRouter } from 'next/navigation';

import { RouterProvider } from 'react-aria-components';

export default function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();

  return <RouterProvider navigate={router.push}>{children}</RouterProvider>;
}
