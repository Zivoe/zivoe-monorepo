'use client';

import { ReactNode } from 'react';

import Link from 'next/link';

import { Badge } from '@zivoe/ui/core/badge';
import { nativeScrollAreaStyles } from '@zivoe/ui/core/native-scroll-area';
import {
  ArrowRightIcon,
  ClockIcon,
  FrxUsdIcon,
  HourglassIcon,
  UniswapIcon,
  UsdcIcon,
  UsdtIcon,
  ZivoeLogoIcon
} from '@zivoe/ui/icons';
import { ZapIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { type Liquidity } from '@/server/data';

import { formatBigIntToReadable } from '@/lib/utils';

import { ZIVOE_ZAPPER_URL } from '../_utils/constants';

export default function Liquidity({ data }: { data: Liquidity }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-leading text-primary">Venues</p>
        <p className="text-regular text-secondary">A list of venues you can sell zVLT on</p>
      </div>

      <div className={cn('-mx-6 overflow-x-auto', nativeScrollAreaStyles())}>
        <div className="w-[580px] px-6 md:w-full lg:w-[580px] xl:w-full">
          <Row className="h-auto bg-surface-elevated">
            <Header>Venue</Header>
            <Header>Liquidity</Header>
            <Header>Token</Header>
            <Header>Type</Header>
          </Row>

          <Link href="/?view=redeem">
            <Row className="border border-transparent border-b-subtle">
              <Venue type="Zivoe" title="Redeem" />
              <Item>{formatBigIntToReadable(data.aUSDC, 18)}</Item>
              <Item>
                <UsdcIcon className="size-6" />
                <p className="text-regular text-primary">aUSDC</p>
              </Item>
              <Item>
                <Badge variant="primary">
                  <ZapIcon />
                  Instant
                </Badge>
              </Item>
            </Row>
          </Link>

          <Link
            href="https://app.uniswap.org/explore/pools/ethereum/0xB0eE9f4e678De09C4c660C44e9430e3688f931f3"
            target="_blank"
          >
            <Row className="border border-transparent border-b-subtle">
              <Venue type="Uniswap" title="View" />
              <Item>{formatBigIntToReadable(data.uniswap, 6)}</Item>
              <Item>
                <UsdcIcon className="size-6" />
                <p className="text-regular text-primary">USDC</p>
              </Item>
              <Item>
                <Badge variant="primary">
                  <ZapIcon />
                  Instant
                </Badge>
              </Item>
            </Row>
          </Link>

          <Link href={ZIVOE_ZAPPER_URL} target="_blank">
            <Row className="border border-transparent border-b-subtle">
              <Venue type="Zivoe" title="View" />
              <Item>{formatBigIntToReadable(data.days3, 18)}</Item>
              <Item>
                <div className="flex">
                  <FrxUsdIcon className="size-6 shrink-0" />
                  <UsdtIcon className="-ml-1 size-6 shrink-0" />
                  <div className="-ml-1.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-elevated-low-emphasis text-extraSmall font-medium text-secondary">
                    +5
                  </div>
                </div>
                <p className="text-regular text-primary">Various</p>
              </Item>
              <Item>
                <Badge variant="warning">
                  <HourglassIcon />t + 3 days
                </Badge>
              </Item>
            </Row>
          </Link>

          <Link href={ZIVOE_ZAPPER_URL} target="_blank">
            <Row>
              <Venue type="Zivoe" title="View" />
              <Item>{formatBigIntToReadable(data.days30, 18)}</Item>
              <Item>
                <UsdcIcon className="size-6" />
                <p className="text-regular text-primary">USDC</p>
              </Item>
              <Item>
                <Badge variant="alert">
                  <ClockIcon />t + 30 days
                </Badge>
              </Item>
            </Row>
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'group grid h-[4.375rem] grid-cols-[140px_110px_150px_180px] hover:bg-surface-elevated md:grid-cols-4 lg:grid-cols-[140px_110px_150px_180px] xl:grid-cols-4',
        className
      )}
    >
      {children}
    </div>
  );
}

function Header({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mx-4 py-2 text-regular font-medium text-secondary', className)}>{children}</p>;
}

function Item({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-4 flex items-center gap-1.5', className)}>{children}</div>;
}

function Venue({ type, title }: { type: 'Zivoe' | 'Uniswap'; title: string }) {
  return (
    <div className="mx-4 flex items-center gap-3">
      {type === 'Zivoe' ? <ZivoeLogoIcon className="size-8" /> : <UniswapIcon className="size-8" />}

      <div className="flex flex-col">
        <p className="text-regular text-primary">{type}</p>

        <p className="flex items-center gap-0.5 text-extraSmall font-medium text-secondary group-hover:underline group-hover:underline-offset-4">
          {title}
          <ArrowRightIcon className="size-3" />
        </p>
      </div>
    </div>
  );
}
