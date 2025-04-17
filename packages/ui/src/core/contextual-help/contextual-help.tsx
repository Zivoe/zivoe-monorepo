import { composeRenderProps } from 'react-aria-components';

import { InfoIcon, QuestionIcon } from '../../icons';
import { cn } from '../../lib/tw-utils';
import { Button } from '../button';
import { Popover, PopoverTrigger } from '../popover';

type ContextualHelpProps = {
  variant: 'info' | 'help';
  className?: string;
  triggerClassName?: string;
  children: React.ReactNode;
};

function ContextualHelp({ variant = 'help', className, triggerClassName, children }: ContextualHelpProps) {
  const Icon = variant === 'info' ? InfoIcon : QuestionIcon;

  return (
    <PopoverTrigger>
      <Button variant="ghost" size="s" className={cn('ml-0.5 aspect-square w-fit px-0', triggerClassName)}>
        <Icon />
      </Button>

      <Popover className={className}>
        <div className="flex flex-col gap-2">{children}</div>
      </Popover>
    </PopoverTrigger>
  );
}

function ContextualHelpTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-regular text-primary">{children}</p>;
}

function ContextualHelpDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-small text-primary">{children}</p>;
}

ContextualHelp.displayName = 'ZivoeUI.ContextualHelp';
ContextualHelpTitle.displayName = 'ZivoeUI.ContextualHelpTitle';
ContextualHelpDescription.displayName = 'ZivoeUI.ContextualHelpDescription';

export { ContextualHelp, ContextualHelpTitle, ContextualHelpDescription };
export type { ContextualHelpProps };
