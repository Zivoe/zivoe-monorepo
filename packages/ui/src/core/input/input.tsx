'use client';

import { type ReactNode, forwardRef, useContext, useRef } from 'react';

import * as Aria from 'react-aria-components';
import { composeRenderProps } from 'react-aria-components';
import { type VariantProps, tv } from 'tailwind-variants';

import { CloseIcon } from '../../icons/close';
import { cn } from '../../lib/tw-utils';
import { FieldError } from '../field/field-error';
import { Label } from '../field/label';

type InputFieldProps = Omit<Aria.TextFieldProps, 'children'> & Pick<Aria.SearchFieldProps, 'onClear' | 'onSubmit'>;

interface InputProps extends InputFieldProps, VariantProps<typeof inputGroupStyles> {
  label?: ReactNode;
  placeholder?: string;
  /** Accepts nodes so callers can pair the message with an action (e.g. a retry link). */
  errorMessage?: ReactNode;
  startContent?: ReactNode;
  endContent?: ReactNode;
  isClearable?: boolean;
  groupClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  clearButtonClassName?: string;
  clearButtonAriaLabel?: string;
  decimalPlaces?: number;
  hasNormalStyleIfDisabled?: boolean;
  subContent?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      labelClassName,
      placeholder,
      value,
      errorMessage,
      startContent,
      endContent,
      isClearable,
      isReadOnly,
      type,
      groupClassName,
      inputClassName,
      clearButtonClassName,
      clearButtonAriaLabel = 'Clear input',
      variant,
      autoComplete,
      onChange,
      onClear,
      onSubmit,
      decimalPlaces = 18,
      hasNormalStyleIfDisabled = false,
      subContent,
      ...props
    },
    ref
  ) => {
    const { parsedPlaceholder, parsedValue, parsedAutoComplete, parsedType } = parseFields({
      variant,
      placeholder,
      value,
      autoComplete,
      type
    });

    const amountRegex = getAmountRegex(decimalPlaces);
    const usesSearchField = variant === 'search' || isClearable;
    const inputRef = useRef<HTMLInputElement>(null);

    const handleChange = (value: string) => {
      if (variant === 'amount' && !amountRegex.test(value)) return;

      return onChange?.(value);
    };

    const fieldProps = {
      ...props,
      value: parsedValue,
      autoComplete: parsedAutoComplete,
      validationBehavior: 'aria' as const,
      'data-readonly': isReadOnly ? true : undefined,
      isReadOnly,
      onChange: handleChange
    };

    const renderContent = (clearValue?: () => void) => (
      <>
        {label && <Label className={labelClassName}>{label}</Label>}

        <InputGroup variant={variant} hasNormalStyleIfDisabled={hasNormalStyleIfDisabled} className={groupClassName}>
          <div className="flex w-full items-center gap-3">
            {startContent}

            <InputElement
              variant={variant}
              hasNormalStyleIfDisabled={hasNormalStyleIfDisabled}
              className={inputClassName}
              placeholder={parsedPlaceholder}
              type={parsedType}
              ref={(node) => {
                inputRef.current = node;

                if (typeof ref === 'function') {
                  ref(node);
                } else if (ref) {
                  ref.current = node;
                }
              }}
            />

            {endContent}

            {isClearable && !isReadOnly && (
              <InputButton
                className={clearButtonClassName}
                onPress={() => {
                  clearValue?.();
                  inputRef.current?.focus();
                }}
                aria-label={clearButtonAriaLabel}
              >
                <CloseIcon aria-hidden="true" />
              </InputButton>
            )}
          </div>

          {variant === 'amount' && subContent}
        </InputGroup>

        {errorMessage && <FieldError>{errorMessage}</FieldError>}
      </>
    );

    if (usesSearchField) {
      return (
        <SearchInputField {...fieldProps} onClear={onClear} onSubmit={onSubmit}>
          {({ state }) => renderContent(() => state.setValue(''))}
        </SearchInputField>
      );
    }

    return <TextInputField {...fieldProps}>{renderContent()}</TextInputField>;
  }
);

const getAmountRegex = (decimalPlaces: number) => new RegExp(`^\\d{0,9}(\\.\\d{0,${decimalPlaces}})?$`);

const parseFields = ({
  variant = 'default',
  placeholder,
  value,
  autoComplete,
  type
}: {
  variant: 'amount' | 'default' | 'search' | undefined;
  placeholder: string | undefined;
  value: string | undefined;
  autoComplete: string | undefined;
  type: string | undefined;
}) => {
  let parsedPlaceholder = placeholder;
  let parsedValue = value;
  let parsedAutoComplete = autoComplete;
  let parsedType = type;

  if (variant === 'amount') {
    parsedPlaceholder ??= '0.0';
    parsedValue ??= '';
    parsedAutoComplete ??= 'off';
    parsedType ??= 'text';
  }

  if (variant === 'search') {
    parsedAutoComplete ??= 'off';
    parsedType ??= 'search';
  }

  if (variant === 'default') {
    parsedType ??= 'text';
  }

  return { parsedPlaceholder, parsedValue, parsedAutoComplete, parsedType };
};

const inputFieldStyles = tv({
  base: 'group flex flex-col gap-3 group-data-readonly:cursor-not-allowed disabled:cursor-not-allowed'
});

const TextInputField = forwardRef<HTMLDivElement, Aria.TextFieldProps>(({ className, ...props }, ref) => {
  return (
    <Aria.TextField
      className={composeRenderProps(className, (className) => inputFieldStyles({ className }))}
      {...props}
      ref={ref}
    />
  );
});

const SearchInputField = forwardRef<HTMLDivElement, Aria.SearchFieldProps>(({ className, ...props }, ref) => {
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
    'border-default flex w-full cursor-text flex-col items-start justify-center gap-2 overflow-hidden rounded-sm border',
    'hover:border-contrast',
    'focus-within:border-active focus-within:shadow-[0px_0px_4px_0px_var(--color-primary-400)] focus-within:outline-hidden',
    'group-data-readonly:cursor-not-allowed disabled:cursor-not-allowed disabled:opacity-60',
    'invalid:border-alert! invalid:shadow-[0px_0px_4px_0px_var(--color-alert-600)]!',
    '[&_svg]:text-icon-default [&_svg]:size-4'
  ],

  variants: {
    variant: {
      default: 'bg-surface-base-soft text-small h-12 px-4',
      amount: 'bg-surface-base text-h6 h-24 pr-4 pl-6',
      search: 'bg-surface-base text-regular hover:border-default h-14 rounded-md px-5 focus-within:shadow-none'
    },

    hasNormalStyleIfDisabled: {
      true: 'disabled:opacity-100'
    }
  },

  defaultVariants: {
    variant: 'default',
    hasNormalStyleIfDisabled: false
  }
});

const InputGroup = forwardRef<HTMLDivElement, Aria.GroupProps & VariantProps<typeof inputGroupStyles>>(
  ({ className, variant, hasNormalStyleIfDisabled, ...props }, ref) => {
    const buttonContext = useContext(Aria.ButtonContext);

    return (
      <Aria.ButtonContext.Provider
        value={{
          ...buttonContext,
          onPress: () => {
            /* noop */
          }
        }}
      >
        <Aria.Group
          onClick={(e) => e.currentTarget.querySelector('input')?.focus()}
          className={composeRenderProps(className, (className) =>
            inputGroupStyles({ className, variant, hasNormalStyleIfDisabled })
          )}
          {...props}
          ref={ref}
        />
      </Aria.ButtonContext.Provider>
    );
  }
);

const inputElementStyles = tv({
  base: [
    'text-primary placeholder:text-tertiary min-w-0 flex-1 outline-0 outline-solid group-data-readonly:cursor-not-allowed disabled:cursor-not-allowed disabled:opacity-60 [&::-webkit-search-cancel-button]:hidden'
  ],

  variants: {
    variant: {
      default: 'bg-surface-base-soft placeholder:text-small',
      amount: 'bg-surface-base placeholder:text-h6',
      search: 'bg-surface-base text-regular'
    },

    hasNormalStyleIfDisabled: {
      true: 'disabled:opacity-100'
    }
  },

  defaultVariants: {
    variant: 'default',
    hasNormalStyleIfDisabled: false
  }
});

const InputElement = forwardRef<HTMLInputElement, Aria.InputProps & VariantProps<typeof inputElementStyles>>(
  ({ className, variant, hasNormalStyleIfDisabled, ...props }, ref) => {
    return (
      <Aria.Input
        className={composeRenderProps(className, (className) =>
          inputElementStyles({ className, variant, hasNormalStyleIfDisabled })
        )}
        {...props}
        ref={ref}
      />
    );
  }
);

const InputButton = forwardRef<HTMLButtonElement, Aria.ButtonProps>(({ className, ...props }, ref) => {
  return (
    <Aria.Button
      excludeFromTabOrder
      className={composeRenderProps(className, (className) =>
        cn(
          'opacity-70 transition-opacity',
          'hover:opacity-100',
          'group-data-readonly:pointer-events-none disabled:pointer-events-none',
          'group-data-empty:invisible',
          className
        )
      )}
      {...props}
      ref={ref}
    />
  );
});

Input.displayName = 'ZivoeUI.Input';
TextInputField.displayName = 'ZivoeUI.TextInputField';
SearchInputField.displayName = 'ZivoeUI.SearchInputField';
InputGroup.displayName = 'ZivoeUI.InputGroup';
InputElement.displayName = 'ZivoeUI.InputElement';
InputButton.displayName = 'ZivoeUI.InputButton';

export { Input, inputFieldStyles, inputGroupStyles, inputElementStyles };
export type { InputProps };
