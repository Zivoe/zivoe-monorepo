'use client';

import { forwardRef } from 'react';

import * as Aria from 'react-aria-components';
import { composeRenderProps } from 'react-aria-components';
import { VariantProps } from 'tailwind-variants';

import { cn, tv } from '../../lib/tw-utils';
import { FieldError } from '../field/field-error';
import { Label, labelVariants } from '../field/label';

const radioVariants = tv({
  slots: {
    container: 'group flex items-center gap-x-2 hover:cursor-pointer',

    element: [
      'flex aspect-square size-5 items-center justify-center rounded-full border border-default transition-colors',
      /* Focused */
      'group-data-[focus-visible]:border-active group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-default group-data-[focus-visible]:ring-offset-[1px] group-data-[focus-visible]:ring-offset-neutral-0',
      /* Disabled */
      'group-data-[disabled]:cursor-not-allowed group-data-[disabled]:border-default group-data-[disabled]:bg-element-neutral',
      /* Selected */
      'group-data-[selected]:border-primary-subtle group-data-[selected]:group-data-[disabled]:border-default group-data-[selected]:bg-element-primary-subtle group-data-[selected]:group-data-[disabled]:bg-element-neutral',
      /* Invalid */
      'group-data-[invalid]:border-alert group-data-[invalid]:group-data-[indeterminate]:border-alert group-data-[invalid]:group-data-[selected]:border-alert group-data-[invalid]:group-data-[indeterminate]:bg-element-alert group-data-[invalid]:group-data-[selected]:bg-element-alert',
      /* Resets */
      'focus:outline-none focus-visible:outline-none'
    ],

    circle: 'group-data-[selected]:group-data-[disabled]:bg-neutral-500 size-2.5 rounded-full bg-element-base'
  }
});

const Radio = forwardRef<HTMLLabelElement, Aria.RadioProps>(({ className, children, ...props }, ref) => {
  const { container, element, circle } = radioVariants();

  return (
    <Aria.Radio
      className={composeRenderProps(className, (className) => cn(container(), labelVariants(), className))}
      {...props}
      ref={ref}
    >
      {composeRenderProps(children, (children, renderProps) => (
        <>
          <span className={element()}>{renderProps.isSelected && <div className={circle()} />}</span>
          <div className="flex items-center gap-4 text-regular font-normal text-primary">{children}</div>
        </>
      ))}
    </Aria.Radio>
  );
});

interface RadioGroupProps extends Aria.RadioGroupProps, VariantProps<typeof radioVariants> {
  label?: string;
  errorMessage?: string;
}

const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ label, className, errorMessage, children, ...props }, ref) => {
    return (
      <Aria.RadioGroup
        validationBehavior="aria"
        className={composeRenderProps(className, (className) => cn('flex flex-col gap-3', className))}
        {...props}
        ref={ref}
      >
        {composeRenderProps(children, (children) => (
          <>
            {label && <Label>{label}</Label>}

            <div className={'grid grid-cols-1 gap-2'}>{children}</div>

            {errorMessage && <FieldError>{errorMessage}</FieldError>}
          </>
        ))}
      </Aria.RadioGroup>
    );
  }
);

Radio.displayName = 'ZivoeUI.Radio';
RadioGroup.displayName = 'ZivoeUI.RadioGroup';

export { Radio, RadioGroup, radioVariants };
export type { RadioGroupProps };
