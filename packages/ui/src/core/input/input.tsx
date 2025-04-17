'use client';

import { ReactNode, forwardRef, useContext } from 'react';

import * as Aria from 'react-aria-components';
import { composeRenderProps } from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { CloseIcon } from '../../icons/close';
import { cn } from '../../lib/tw-utils';
import { FieldError } from '../field/field-error';
import { Label } from '../field/label';

interface InputProps extends Aria.SearchFieldProps {
  label?: ReactNode;
  placeholder?: string;
  errorMessage?: string;
  startContent?: ReactNode;
  endContent?: ReactNode;
  isClearable?: boolean;
  groupClassName?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      placeholder,
      errorMessage,
      startContent,
      endContent,
      isClearable,
      isReadOnly,
      type,
      groupClassName,
      ...props
    },
    ref
  ) => {
    return (
      <InputField {...props} validationBehavior="aria" data-readonly={isReadOnly}>
        {({ state }) => (
          <>
            {label && <Label>{label}</Label>}

            <InputGroup className={groupClassName}>
              {startContent}

              <InputElement placeholder={placeholder} type={type} ref={ref} />

              {endContent}

              {isClearable && !isReadOnly && (
                <InputButton onPress={() => state.setValue('')} aria-label="Clear input">
                  <CloseIcon />
                </InputButton>
              )}
            </InputGroup>

            {errorMessage && <FieldError>{errorMessage}</FieldError>}
          </>
        )}
      </InputField>
    );
  }
);

const inputFieldStyles = tv({
  base: 'group flex flex-col gap-2 disabled:cursor-not-allowed'
});

const InputField = forwardRef<HTMLDivElement, Aria.SearchFieldProps>(({ className, ...props }, ref) => {
  return (
    <Aria.SearchField
      className={composeRenderProps(className, (className) => inputFieldStyles({ className }))}
      {...props}
      ref={ref}
    />
  );
});

const inputGroupStyles = tv({
  base: [
    'flex h-12 w-full cursor-text items-center gap-3 overflow-hidden rounded border border-default bg-surface-base-soft px-4 text-small',
    /* Hover */
    'hover:border-contrast',
    /* Focus Within */
    'focus-within:border-active focus-within:shadow-[0px_0px_4px_0px_theme(colors.primary.400)] focus-within:outline-none',
    /* Disabled */
    'disabled:cursor-not-allowed disabled:opacity-60',
    /* Invalid */
    'invalid:border-alert invalid:shadow-[0px_0px_4px_0px_theme(colors.alert.600)]',
    /* SVG */
    '[&_svg]:size-4 [&_svg]:text-icon-default'
  ]
});

const InputGroup = forwardRef<HTMLDivElement, Aria.GroupProps>(({ className, ...props }, ref) => {
  const buttonContext = useContext(Aria.ButtonContext);

  return (
    <Aria.ButtonContext.Provider value={{ ...buttonContext, onPress: () => {}, excludeFromTabOrder: false }}>
      <Aria.Group
        onClick={(e) => e.currentTarget.querySelector('input')?.focus()}
        className={composeRenderProps(className, (className) => inputGroupStyles({ className }))}
        {...props}
        ref={ref}
      />
    </Aria.ButtonContext.Provider>
  );
});

const inputElementStyles = tv({
  base: [
    'min-w-0 flex-1 bg-surface-base-soft text-primary outline outline-0 placeholder:text-small placeholder:text-tertiary group-data-[readonly]:text-tertiary disabled:cursor-not-allowed [&::-webkit-search-cancel-button]:hidden'
  ]
});

const InputElement = forwardRef<HTMLInputElement, Aria.InputProps>(({ className, ...props }, ref) => {
  return (
    <Aria.Input
      className={composeRenderProps(className, (className) => inputElementStyles({ className }))}
      {...props}
      ref={ref}
    />
  );
});

const InputButton = forwardRef<HTMLButtonElement, Aria.ButtonProps>(({ className, ...props }, ref) => {
  return (
    <Aria.Button
      excludeFromTabOrder
      className={composeRenderProps(className, (className) =>
        cn(
          'opacity-70 transition-opacity',
          /* Hover */
          'hover:opacity-100',
          /* Disabled */
          'disabled:pointer-events-none',
          /* Empty */
          'group-data-[empty]:invisible',
          className
        )
      )}
      {...props}
      ref={ref}
    />
  );
});

Input.displayName = 'ZivoeUI.Input';
InputField.displayName = 'ZivoeUI.InputField';
InputGroup.displayName = 'ZivoeUI.InputGroup';
InputElement.displayName = 'ZivoeUI.InputElement';
InputButton.displayName = 'ZivoeUI.InputButton';

export { Input, inputFieldStyles, inputGroupStyles, inputElementStyles };
export type { InputProps };
