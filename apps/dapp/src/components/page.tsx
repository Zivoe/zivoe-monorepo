import { ReactNode } from 'react';

import Container from './container';

export default function Page({ children }: { children: ReactNode }) {
  return <Container className="mb-10 mt-10 lg:mb-20 lg:mt-16">{children}</Container>;
}
