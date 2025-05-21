import { ReactNode } from 'react';

import { cn } from '@zivoe/ui/lib/tw-utils';

import Container from './container';

export default function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <Container className={cn('mb-10 mt-10 lg:mb-20 lg:mt-16', className)}>{children}</Container>;
}
