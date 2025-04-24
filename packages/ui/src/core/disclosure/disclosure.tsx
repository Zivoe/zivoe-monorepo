'use client';

import React, { useContext } from 'react';

import {
  Disclosure as AriaDisclosure,
  DisclosureGroup as AriaDisclosureGroup,
  DisclosureGroupProps as AriaDisclosureGroupProps,
  DisclosurePanel as AriaDisclosurePanel,
  DisclosurePanelProps as AriaDisclosurePanelProps,
  DisclosureProps as AriaDisclosureProps,
  Button,
  ButtonProps,
  DisclosureGroupStateContext,
  DisclosureStateContext,
  Heading,
  composeRenderProps
} from 'react-aria-components';

import { ChevronDownIcon } from '../../icons/chevron-down';
import { cn } from '../../lib/tw-utils';

export interface DisclosureProps extends AriaDisclosureProps {
  children: React.ReactNode;
}

function Disclosure({ children, className, ...props }: DisclosureProps) {
  let isInGroup = useContext(DisclosureGroupStateContext) !== null;

  return (
    <AriaDisclosure
      {...props}
      className={composeRenderProps(className, (className) =>
        cn('group w-full', isInGroup && 'border-0 border-b border-neutral-100 last:border-b-0', 'py-10', className)
      )}
    >
      {children}
    </AriaDisclosure>
  );
}

export interface DisclosureHeaderProps {
  children: React.ReactNode;
  className?: ButtonProps['className'];
}

function DisclosureHeader({ children, className }: DisclosureHeaderProps) {
  const state = useContext(DisclosureStateContext);
  const isExpanded = state?.isExpanded;

  return (
    <Heading className="flex">
      <Button
        slot="trigger"
        className={composeRenderProps(className, (className) => {
          return cn(
            'group flex flex-1 items-center justify-between rounded-md text-left !font-heading text-smallSubheading ring-offset-neutral-0 transition-all hover:underline',
            'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
            'data-[focus-visible]:outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-default data-[focus-visible]:ring-offset-2',
            'outline-none',
            isExpanded && 'pb-3',
            className
          );
        })}
      >
        {children}
        <ChevronDownIcon
          aria-hidden
          className={cn(
            'size-4 shrink-0 transition-transform duration-200',
            'group-data-[expanded]:rotate-180',
            'group-data-[disabled]:opacity-50'
          )}
        />
      </Button>
    </Heading>
  );
}

export interface DisclosurePanelProps extends AriaDisclosurePanelProps {
  children: React.ReactNode;
}

function DisclosurePanel({ children, className, ...props }: DisclosurePanelProps) {
  return (
    <AriaDisclosurePanel
      {...props}
      className={composeRenderProps(className, (className) =>
        cn('overflow-hidden text-regular transition-all', className)
      )}
    >
      {children}
    </AriaDisclosurePanel>
  );
}

export interface DisclosureGroupProps extends AriaDisclosureGroupProps {
  children: React.ReactNode;
}

function DisclosureGroup({ children, className, ...props }: DisclosureGroupProps) {
  return (
    <AriaDisclosureGroup {...props} className={composeRenderProps(className, (className) => cn('', className))}>
      {children}
    </AriaDisclosureGroup>
  );
}

export { Disclosure, DisclosureHeader, DisclosurePanel, DisclosureGroup };
