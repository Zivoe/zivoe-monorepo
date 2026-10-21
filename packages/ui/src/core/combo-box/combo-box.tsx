'use client';

import type { ComponentProps, ReactNode } from 'react';

import {
  Button as AriaButton,
  ComboBox as AriaComboBox,
  type ComboBoxProps as AriaComboBoxProps,
  Input as AriaInput,
  type InputProps as AriaInputProps,
  type ListBoxProps as AriaListBoxProps,
  composeRenderProps
} from 'react-aria-components';

import { ChevronDownIcon } from '../../icons';
import { cn } from '../../lib/tw-utils';
import { ListBoxItem } from '../list-box';
import { nativeScrollAreaStyles } from '../native-scroll-area';
import { SelectListBox, SelectPopover } from '../select';

/**
 * A text field that filters a list as you type. Compose it like the Select:
 * `<ComboBox><Label /><ComboBoxInput /><FieldError /><ComboBoxPopover><ComboBoxListBox>…`.
 */
const ComboBox = <T extends object>({ className, ...props }: AriaComboBoxProps<T>) => (
  <AriaComboBox
    // Keeps the list open on a search with no match, so the list box's empty state can show.
    allowsEmptyCollection
    className={composeRenderProps(className, (className) => cn('group/combo-box flex flex-col gap-3', className))}
    {...props}
  />
);

interface ComboBoxInputProps extends AriaInputProps {
  /** Shown inside the field, before the text (a flag, an icon). Decorative: hidden from screen readers. */
  startContent?: ReactNode;
}

/**
 * The field: react-aria's input styled like `Input`, with its trigger button as a chevron.
 * The list opens as the user types, or when the chevron is pressed; everything else
 * (keyboard, blur, restoring the picked item's text) is react-aria's default behaviour.
 */
const ComboBoxInput = ({ className, startContent, ...props }: ComboBoxInputProps) => (
  // The input spans the whole field, so the popover (anchored to it) matches its width.
  <div className="group/field relative flex items-center group-data-disabled/combo-box:opacity-60">
    {startContent && (
      <span aria-hidden="true" className="pointer-events-none absolute left-5 flex items-center text-regular">
        {startContent}
      </span>
    )}

    <AriaInput
      className={composeRenderProps(className, (className) =>
        cn(
          'h-12 w-full min-w-0 rounded-sm border border-default bg-surface-base-soft pr-10 pl-4 text-small text-primary outline-hidden',
          'placeholder:text-tertiary',
          // Hover on the chevron (a sibling over the input's edge) tints the field too, like the Select trigger.
          'group-hover/field:border-contrast',
          'focus:border-active focus:shadow-[0px_0px_4px_0px_var(--color-primary-400)] group-hover/field:focus:border-active',
          'data-invalid:border-alert! data-invalid:shadow-[0px_0px_4px_0px_var(--color-alert-600)]!',
          'disabled:cursor-not-allowed',
          // Lines the text up with the option names in the list.
          startContent && 'pl-12',
          className
        )
      )}
      {...props}
    />

    {/* react-aria's trigger: focuses the input and toggles the list. Out of the tab order, as before. */}
    <AriaButton className="absolute right-0 flex h-full items-center px-3 outline-hidden">
      <ChevronDownIcon
        aria-hidden="true"
        className="size-4 text-icon-default transition-transform group-data-open/combo-box:rotate-180"
      />
    </AriaButton>
  </div>
);

/** The list's popover, as wide as the field. */
const ComboBoxPopover = (props: ComponentProps<typeof SelectPopover>) => <SelectPopover matchTriggerWidth {...props} />;

const ComboBoxListBox = <T extends object>({
  renderEmptyState = () => <p className="px-3 py-2.5 text-small text-tertiary">No results</p>,
  className,
  ...props
}: AriaListBoxProps<T>) => (
  <SelectListBox
    renderEmptyState={renderEmptyState}
    // Our thin scrollbar, on the list itself: react-aria scrolls it to keep the focused option in view.
    className={composeRenderProps(className, (className) =>
      nativeScrollAreaStyles({ className: cn('min-h-0 p-2', className) })
    )}
    {...props}
  />
);

const ComboBoxItem = ListBoxItem;

export { ComboBox, ComboBoxInput, ComboBoxPopover, ComboBoxListBox, ComboBoxItem, type ComboBoxInputProps };
