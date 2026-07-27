import { type ReactNode } from 'react';

import { cn } from '@zivoe/ui/lib/tw-utils';

import Container from './container';

export default function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <Container className={cn('mt-10 mb-10 lg:mt-16 lg:mb-20', className)}>{children}</Container>;
}
