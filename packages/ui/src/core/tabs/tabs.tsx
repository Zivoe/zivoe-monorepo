'use client';

import { forwardRef } from 'react';

import * as Aria from 'react-aria-components';
import { composeRenderProps } from 'react-aria-components';

import { cn } from '../../lib/tw-utils';

const Tabs = forwardRef<HTMLDivElement, Aria.TabsProps>(({ className, ...props }, ref) => {
  return (
    <Aria.Tabs
      className={composeRenderProps(className, (className) =>
        cn('flex gap-4', 'data-[orientation=vertical]:flex-row data-[orientation=horizontal]:flex-col', className)
      )}
      {...props}
      ref={ref}
    />
  );
});

const TabList = <T extends object>({ className, ...props }: Aria.TabListProps<T>) => {
  return (
    <Aria.TabList
      className={composeRenderProps(className, (className) =>
        cn(
          'rounded-2 flex bg-surface-elevated p-1',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default focus-visible:ring-offset-2',
          'data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col',
          className
        )
      )}
      {...props}
    />
  );
};

interface TabProps extends Aria.TabProps {
  className?: string;
}

const Tab = forwardRef<HTMLDivElement, TabProps>(({ className, ...props }, ref) => {
  return (
    <Aria.Tab
      className={composeRenderProps(className, (className) =>
        cn(
          'flex flex-1 cursor-pointer items-center justify-center rounded-[6px] px-4 py-2',
          'text-small font-medium text-secondary transition-all',
          'hover:text-primary',
          'selected:bg-surface-base selected:text-primary selected:shadow-sm',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default focus-visible:ring-offset-2',
          'pressed:scale-[0.98]',
          className
        )
      )}
      {...props}
      ref={ref}
    />
  );
});

interface TabPanelProps extends Aria.TabPanelProps {
  className?: string;
}

const TabPanel = forwardRef<HTMLDivElement, TabPanelProps>(({ className, ...props }, ref) => {
  return (
    <Aria.TabPanel
      className={composeRenderProps(className, (className) =>
        cn(
          'mt-2 rounded-[4px]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default focus-visible:ring-offset-2',
          className
        )
      )}
      {...props}
      ref={ref}
    />
  );
});

Tabs.displayName = 'ZivoeUI.Tabs';
TabList.displayName = 'ZivoeUI.TabList';
Tab.displayName = 'ZivoeUI.Tab';
TabPanel.displayName = 'ZivoeUI.TabPanel';

export { Tabs, TabList, Tab, TabPanel };
