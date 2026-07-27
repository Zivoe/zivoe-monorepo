import { type ReactNode } from 'react';

import { cn } from '@zivoe/ui/lib/tw-utils';

import Container from '@/components/container';

import { BankruptcyIcon, CustodyIcon } from './assets';

export default function Infrastructure() {
  return (
    <Container className="w-fit flex-col justify-between gap-10 py-20 sm:gap-16 sm:px-10 md:w-140 md:px-0 xl:w-auto xl:px-26 xl:py-40 2xl:px-64">
      <div className="flex max-w-160 flex-col gap-8">
        <p className="font-heading! text-small text-primary sm:text-leading">Wall Street-Grade Security</p>

        <h2 className="text-h6 text-primary sm:text-h4 xl:text-h2">Rest Easy, Knowing Your Assets Are Protected</h2>
      </div>

      <div className="flex flex-col gap-6 xl:flex-row">
        <Card
          title="SPV Structure"
          description="User assets are held in special purpose vehicles, ensuring user assets remain protected."
          className="bg-element-secondary-gentle"
        >
          <BankruptcyIcon className="absolute -top-11 right-0 w-45 sm:top-0 sm:right-0 sm:w-fit" />
        </Card>

        <Card
          title="Custody Solutions"
          description="Zivoe will be integrating with industry-leading crypto custodians, offering an easy and secure way to deposit funds and manage positions."
          className="bg-element-primary-gentle"
        >
          <CustodyIcon className="absolute -top-11 right-0 w-45 sm:top-0 sm:right-0 sm:w-fit" />
        </Card>
      </div>
    </Container>
  );
}

function Card({
  title,
  description,
  children,
  className
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative flex h-86 items-end justify-start overflow-clip rounded-xl p-6 sm:h-90 sm:p-10 lg:h-100',
        className
      )}
    >
      <div className="flex flex-col gap-3 text-primary">
        <p className="font-heading! text-smallSubheading sm:text-subheading">{title}</p>
        <p className="text-regular sm:text-leading">{description}</p>
      </div>

      {children}
    </div>
  );
}
