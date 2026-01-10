'use client';

import * as React from 'react';

import { OTPInput, OTPInputContext, REGEXP_ONLY_DIGITS } from 'input-otp';

import { cn } from '../../lib/tw-utils';

const InputOTP = React.forwardRef<React.ComponentRef<typeof OTPInput>, React.ComponentPropsWithoutRef<typeof OTPInput>>(
  ({ className, containerClassName, ...props }, ref) => (
    <OTPInput
      data-slot="input-otp"
      ref={ref}
      containerClassName={cn('flex w-full items-center gap-2 has-[:disabled]:opacity-50', containerClassName)}
      className={cn('disabled:cursor-not-allowed', className)}
      {...props}
    />
  )
);
InputOTP.displayName = 'InputOTP';

const InputOTPGroup = React.forwardRef<React.ComponentRef<'div'>, React.ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      data-slot="input-otp-group"
      ref={ref}
      className={cn('flex w-full items-center gap-2 sm:gap-6', className)}
      {...props}
    />
  )
);
InputOTPGroup.displayName = 'InputOTPGroup';

const InputOTPSlot = React.forwardRef<
  React.ComponentRef<'div'>,
  React.ComponentPropsWithoutRef<'div'> & { index: number }
>(({ index, className, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      ref={ref}
      className={cn(
        'relative flex size-12 flex-1 items-center justify-center rounded border bg-surface-base-soft text-subheading text-primary transition-all sm:size-14 xl:size-16',
        isActive && 'z-10 border-active shadow-[0px_0px_4px_0px_theme(colors.primary.400)]',
        char && !isActive && 'border-active',
        !char && !isActive && 'border-default',
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-px animate-caret-blink bg-surface-contrast duration-1000" />
        </div>
      )}
    </div>
  );
});
InputOTPSlot.displayName = 'InputOTPSlot';

export { InputOTP, InputOTPGroup, InputOTPSlot, REGEXP_ONLY_DIGITS };
