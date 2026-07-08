'use client';

import { forwardRef } from 'react';

import * as Aria from 'react-aria-components';
import { composeRenderProps } from 'react-aria-components';
import { type VariantProps } from 'tailwind-variants';

import { CheckIcon, MinusIcon } from '../../icons';
import { cn, tv } from '../../lib/tw-utils';
import { FieldError } from '../field/field-error';
import { Label, labelVariants } from '../field/label';

const checkboxVariants = tv({
  slots: {
    container: 'group flex items-center gap-x-2 hover:cursor-pointer',

    element: [
      'border-default flex size-5 shrink-0 items-center justify-center rounded-xs border transition-colors',
      /*  Focus Visible */
      'group-data-focus-visible:border-active group-data-focus-visible:ring-default group-data-focus-visible:ring-offset-neutral-0 group-data-focus-visible:ring-2 group-data-focus-visible:ring-offset-1',
      /* Disabled */
      'group-data-disabled:border-default group-data-disabled:bg-element-neutral group-data-disabled:cursor-not-allowed',
      /* Selected */
      'group-data-selected:border-primary-subtle group-data-disabled:group-data-selected:border-default group-data-selected:bg-element-primary-subtle group-data-disabled:group-data-selected:bg-element-neutral',
      /* Indeterminate */
      'group-data-indeterminate:border-primary-subtle group-data-disabled:group-data-indeterminate:border-default group-data-indeterminate:bg-element-primary-subtle group-data-disabled:group-data-indeterminate:bg-element-neutral',
      /* Invalid */
      'group-data-invalid:border-alert group-data-indeterminate:group-data-invalid:border-alert group-data-selected:group-data-invalid:border-alert group-data-indeterminate:group-data-invalid:bg-element-alert group-data-selected:group-data-invalid:bg-element-alert',
      /* Resets */
      'focus:outline-hidden focus-visible:outline-hidden'
    ],

    icon: 'group-data-disabled:text-icon-default size-4 text-base'
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

          <div className="text-regular text-primary flex gap-4 font-normal">{children}</div>
        </>
      ))}
    </Aria.Checkbox>
  );
});

type CheckboxGroupProps = Aria.CheckboxGroupProps & {
  label?: string;
  errorMessage?: string;
  elementsClassName?: string;
} & ({ showSelectAll: true; values: Array<string> } | { showSelectAll?: false; values?: never });

const CheckboxGroup = forwardRef<HTMLDivElement, CheckboxGroupProps>(
  (
    {
      label,
      errorMessage,
      values: _values,
      className,
      elementsClassName,
      children,
      showSelectAll: _showSelectAll,
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
            {label && <Label>{label}</Label>}
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
