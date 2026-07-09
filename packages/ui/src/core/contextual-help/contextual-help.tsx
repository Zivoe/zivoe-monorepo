import { InfoIcon, QuestionIcon } from '../../icons';
import { cn } from '../../lib/tw-utils';
import { Button } from '../button';
import { Popover, PopoverTrigger } from '../popover';

type ContextualHelpProps = {
  variant: 'info' | 'help';
  'aria-label'?: string;
  className?: string;
  triggerClassName?: string;
  children: React.ReactNode;
};

function ContextualHelp({
  variant = 'help',
  'aria-label': ariaLabel,
  className,
  triggerClassName,
  children
}: ContextualHelpProps) {
  const Icon = variant === 'info' ? InfoIcon : QuestionIcon;

  return (
    <PopoverTrigger>
      <Button
        aria-label={ariaLabel ?? (variant === 'info' ? 'More information' : 'Help')}
        variant="ghost"
        size="xs"
        className={cn('ml-1 aspect-square w-fit px-0 [&_svg]:size-4', triggerClassName)}
      >
        <Icon aria-hidden="true" />
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
