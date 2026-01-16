'use client';

import { forwardRef } from 'react';

import * as Aria from 'react-aria-components';
import { composeRenderProps } from 'react-aria-components';
import { VariantProps } from 'tailwind-variants';

import { CheckIcon, MinusIcon } from '../../icons';
import { cn, tv } from '../../lib/tw-utils';
import { FieldError } from '../field/field-error';
import { Label, labelVariants } from '../field/label';

const checkboxVariants = tv({
  slots: {
    container: 'group flex items-center gap-x-2 hover:cursor-pointer',

    element: [
      'flex size-5 shrink-0 items-center justify-center rounded-sm border border-default transition-colors',
      /*  Focus Visible */
      'group-data-[focus-visible]:border-active group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-default group-data-[focus-visible]:ring-offset-[1px] group-data-[focus-visible]:ring-offset-neutral-0',
      /* Disabled */
      'group-data-[disabled]:cursor-not-allowed group-data-[disabled]:border-default group-data-[disabled]:bg-element-neutral',
      /* Selected */
      'group-data-[selected]:border-primary-subtle group-data-[selected]:group-data-[disabled]:border-default group-data-[selected]:bg-element-primary-subtle group-data-[selected]:group-data-[disabled]:bg-element-neutral',
      /* Indeterminate */
      'group-data-[indeterminate]:border-primary-subtle group-data-[indeterminate]:group-data-[disabled]:border-default group-data-[indeterminate]:bg-element-primary-subtle group-data-[indeterminate]:group-data-[disabled]:bg-element-neutral',
      /* Invalid */
      'group-data-[invalid]:border-alert group-data-[invalid]:group-data-[indeterminate]:border-alert group-data-[invalid]:group-data-[selected]:border-alert group-data-[invalid]:group-data-[indeterminate]:bg-element-alert group-data-[invalid]:group-data-[selected]:bg-element-alert',
      /* Resets */
      'focus:outline-none focus-visible:outline-none'
    ],

    icon: 'size-4 text-base group-data-[disabled]:text-icon-default'
  }
});

interface CheckboxProps extends Aria.CheckboxProps, VariantProps<typeof checkboxVariants> {}

const Checkbox = forwardRef<HTMLLabelElement, CheckboxProps>(({ className, children, ...props }, ref) => {
  const { container, element, icon } = checkboxVariants();

  return (
    <Aria.Checkbox
      validationBehavior="aria"
      className={composeRenderProps(className, (className) => cn(container(), labelVariants(), className))}
      {...props}
      ref={ref}
    >
      {composeRenderProps(children, (children, renderProps) => (
        <>
          <div className={element()}>
            {renderProps.isIndeterminate ? (
              <MinusIcon className={icon()} />
            ) : renderProps.isSelected ? (
              <CheckIcon className={icon()} />
            ) : null}
          </div>

          <div className="flex gap-4 text-regular font-normal text-primary">{children}</div>
        </>
      ))}
    </Aria.Checkbox>
  );
});

type CheckboxGroupProps = Aria.CheckboxGroupProps & {
  label?: string;
  errorMessage?: string;
  elementsClassName?: string;
} & ({ showSelectAll: true; values: string[] } | { showSelectAll?: false; values?: never });

const CheckboxGroup = forwardRef<HTMLDivElement, CheckboxGroupProps>(
  (
    {
      label,
      errorMessage,
      values,
      className,
      elementsClassName,
      children,
      showSelectAll,
      ...props
    }: CheckboxGroupProps,
    ref
  ) => {
    return (
      <Aria.CheckboxGroup
        validationBehavior="aria"
        className={composeRenderProps(className, (className) => cn('flex w-full flex-col gap-2', className))}
        {...props}
        ref={ref}
      >
        {composeRenderProps(children, (children) => (
          <>
            <Label>{label}</Label>
            <div className={cn('grid grid-cols-1 gap-1', elementsClassName)}>{children}</div>
            <FieldError>{errorMessage}</FieldError>
          </>
        ))}
      </Aria.CheckboxGroup>
    );
  }
);

Checkbox.displayName = 'ZivoeUI.Checkbox';
CheckboxGroup.displayName = 'ZivoeUI.CheckboxGroup';

export { Checkbox, CheckboxGroup, checkboxVariants };
export type { CheckboxGroupProps };
