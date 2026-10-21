'use client';

import { type ComponentProps, type ReactNode, useContext, useMemo, useState } from 'react';

import {
  Button as AriaButton,
  ComboBox as AriaComboBox,
  type ComboBoxProps as AriaComboBoxProps,
  Input as AriaInput,
  type InputProps as AriaInputProps,
  type ListBoxProps as AriaListBoxProps,
  ComboBoxStateContext,
  composeRenderProps
} from 'react-aria-components';

import { ChevronDownIcon, SearchIcon } from '../../icons';
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

/**
 * Ranked search for a ComboBox; spread the result onto `ComboBox`. react-aria filters the
 * list but never reorders it, so this hands it every item as `defaultItems` with the matches
 * first, a `defaultFilter` that keeps the matches, and `onInputChange` to follow the text.
 * Every item stays in the list because react-aria reads the picked item's text from it; while
 * the field shows that text (`selectedText`) the order is `items`' own, so the whole list
 * opened from the chevron reads naturally.
 */
function useComboBoxSearch<T>({
  items,
  search,
  textValue,
  selectedText
}: {
  /** Every item, in the order the whole list shows. */
  items: Array<T>;
  /** The items a search matches, best first; every item for an empty search. */
  search: (query: string) => Array<T>;
  /** The text an item shows in the field: its `ComboBoxItem`'s `textValue`. */
  textValue: (item: T) => string;
  /** The picked item's text, if any. */
  selectedText?: string;
}) {
  const [text, setText] = useState('');

  return useMemo(() => {
    const ranked = search(text);
    const matches = new Set(ranked.map(textValue));
    const browsing = text === selectedText;
    const defaultItems = browsing ? items : [...ranked, ...items.filter((item) => !matches.has(textValue(item)))];
    return { defaultItems, defaultFilter: (itemText: string) => matches.has(itemText), onInputChange: setText };
  }, [text, items, search, textValue, selectedText]);
}

/**
 * For `ComboBoxInput`'s `startContent`: `children(item)` for the picked item while the field
 * shows its text, a search icon while the user types.
 */
function ComboBoxSelected<T>({ children }: { children: (item: T) => ReactNode }) {
  const state = useContext(ComboBoxStateContext);
  const selected = state?.selectedItems[0];
  const icon = <SearchIcon className="size-4 text-icon-default" />;

  if (!selected) return icon;
  // The context is untyped; the node's value is the item the consumer passed in.
  return state?.inputValue === selected.textValue ? children(selected.value as T) : icon;
}

export {
  ComboBox,
  ComboBoxInput,
  ComboBoxPopover,
  ComboBoxListBox,
  ComboBoxItem,
  ComboBoxSelected,
  useComboBoxSearch,
  type ComboBoxInputProps
};
