'use client';

import { ReactNode, forwardRef, useContext } from 'react';

import * as Aria from 'react-aria-components';
import { composeRenderProps } from 'react-aria-components';
import { VariantProps, tv } from 'tailwind-variants';

import { CloseIcon } from '../../icons/close';
import { cn } from '../../lib/tw-utils';
import { FieldError } from '../field/field-error';
import { Label } from '../field/label';

interface InputProps extends Aria.SearchFieldProps, VariantProps<typeof inputGroupStyles> {
  label?: ReactNode;
  placeholder?: string;
  errorMessage?: string;
  startContent?: ReactNode;
  endContent?: ReactNode;
  isClearable?: boolean;
  groupClassName?: string;
  labelClassName?: string;
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
      variant,
      autoComplete,
      onChange,
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

    return (
      <InputField
        {...props}
        value={parsedValue}
        autoComplete={parsedAutoComplete}
        validationBehavior="aria"
        data-readonly={isReadOnly}
        onChange={(value) => {
          if (variant === 'amount' && !amountRegex.test(value)) return;
          else return onChange?.(value);
        }}
      >
        {({ state }) => (
          <>
            {label && <Label>{label}</Label>}

            <InputGroup
              variant={variant}
              hasNormalStyleIfDisabled={hasNormalStyleIfDisabled}
              className={groupClassName}
            >
              <div className="flex w-full items-center gap-3">
                {startContent}

                <InputElement
                  variant={variant}
                  hasNormalStyleIfDisabled={hasNormalStyleIfDisabled}
                  placeholder={parsedPlaceholder}
                  type={parsedType}
                  ref={ref}
                />

                {endContent}

                {isClearable && !isReadOnly && (
                  <InputButton onPress={() => state.setValue('')} aria-label="Clear input">
                    <CloseIcon />
                  </InputButton>
                )}
              </div>

              {variant === 'amount' && subContent}
            </InputGroup>

            {errorMessage && <FieldError>{errorMessage}</FieldError>}
          </>
        )}
      </InputField>
    );
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
  variant: 'amount' | 'default' | undefined;
  placeholder: string | undefined;
  value: string | undefined;
  autoComplete: string | undefined;
  type: any;
}) => {
  let parsedPlaceholder = placeholder;
  let parsedValue = value;
  let parsedAutoComplete = autoComplete;
  let parsedType = type;

  if (variant === 'amount') {
    if (!parsedPlaceholder) parsedPlaceholder = '0.0';
    if (!parsedValue) parsedValue = '';
    if (!parsedAutoComplete) parsedAutoComplete = 'off';
    if (!parsedType) parsedType = 'text';
  }

  return { parsedPlaceholder, parsedValue, parsedAutoComplete, parsedType };
};

const inputFieldStyles = tv({
  base: 'group flex flex-col gap-3 group-data-[readonly]:cursor-not-allowed disabled:cursor-not-allowed'
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
    'flex w-full cursor-text flex-col items-start justify-center gap-2 overflow-hidden rounded border border-default',
    /* Hover */
    'hover:border-contrast',
    /* Focus Within */
    'focus-within:border-active focus-within:shadow-[0px_0px_4px_0px_theme(colors.primary.400)] focus-within:outline-none',
    /* Disabled */
    'group-data-[readonly]:cursor-not-allowed disabled:cursor-not-allowed disabled:opacity-60',
    /* Invalid */
    'invalid:!border-alert invalid:!shadow-[0px_0px_4px_0px_theme(colors.alert.600)]',
    /* SVG */
    '[&_svg]:size-4 [&_svg]:text-icon-default'
  ],

  variants: {
    variant: {
      default: 'h-12 bg-surface-base-soft px-4 text-small',
      amount: 'h-24 bg-surface-base pl-6 pr-4 text-h6'
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
      <Aria.ButtonContext.Provider value={{ ...buttonContext, onPress: () => {} }}>
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
    'min-w-0 flex-1 text-primary outline outline-0 placeholder:text-tertiary group-data-[readonly]:cursor-not-allowed disabled:cursor-not-allowed disabled:opacity-60 [&::-webkit-search-cancel-button]:hidden'
  ],

  variants: {
    variant: {
      default: 'bg-surface-base-soft placeholder:text-small',
      amount: 'bg-surface-base placeholder:text-h6'
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
          /* Hover */
          'hover:opacity-100',
          /* Disabled */
          'group-data-[readonly]:pointer-events-none disabled:pointer-events-none',
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
