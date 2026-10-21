'use client';

import { useContext, useMemo, useState } from 'react';

import { ComboBoxStateContext } from 'react-aria-components';

import { ComboBox, ComboBoxInput, ComboBoxItem, ComboBoxListBox, ComboBoxPopover } from '@zivoe/ui/core/combo-box';
import { FieldError } from '@zivoe/ui/core/field/field-error';
import { Label } from '@zivoe/ui/core/field/label';
import { SearchIcon } from '@zivoe/ui/icons';

import { COUNTRIES, type Country, getCountryLabel, searchCountries } from '@/types/countries';

/**
 * The country field of the onboarding and investor-profile forms: type to filter
 * the list (by name, everyday alias or ISO code), then pick. The value is the
 * country's ISO code (`'RO'`), `''` when none is picked; the field shows its name.
 */
export function CountryComboBox({
  label,
  value,
  onChange,
  isInvalid,
  errorMessage
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isInvalid?: boolean;
  errorMessage?: string;
}) {
  // The field's text; react-aria sets it back to the picked country's name on pick, Escape or blur.
  const [text, setText] = useState('');
  // react-aria filters but never reorders, so it gets every country with the matches first and
  // a filter that keeps the matches. Every country stays in the list because react-aria reads
  // the picked country's name from it. While the field shows the picked country the order is
  // alphabetical, so opening the whole list from the chevron reads naturally.
  const { items, matches } = useMemo(() => {
    const ranked = searchCountries(text);
    const matches = new Set(ranked.map((country) => country.label));
    const browsing = text === getCountryLabel(value);
    const items = browsing ? COUNTRIES : [...ranked, ...COUNTRIES.filter((c) => !matches.has(c.label))];
    return { items, matches };
  }, [text, value]);

  return (
    <ComboBox
      defaultItems={items}
      defaultFilter={(label) => matches.has(label)}
      value={value || null}
      onChange={(key) => onChange(key === null ? '' : String(key))}
      onInputChange={setText}
      // The whole list opens on focus (a click, a tap, Tab), as the Select it replaced did.
      menuTrigger="focus"
      isInvalid={isInvalid}
      validationBehavior="aria"
    >
      <Label>{label}</Label>
      <ComboBoxInput placeholder="Search country" startContent={<SelectedFlag />} />
      <FieldError>{errorMessage}</FieldError>

      <ComboBoxPopover>
        <ComboBoxListBox<Country> renderEmptyState={() => <NoCountry />}>
          {(country) => (
            <ComboBoxItem id={country.value} textValue={country.label}>
              <span aria-hidden="true" className="text-regular">
                {country.flag}
              </span>
              <span>{country.label}</span>
            </ComboBoxItem>
          )}
        </ComboBoxListBox>
      </ComboBoxPopover>
    </ComboBox>
  );
}

/** The picked country's flag while the field shows its name; a search icon while typing. */
function SelectedFlag() {
  const state = useContext(ComboBoxStateContext);
  const selected = state?.selectedItems[0]?.value as Country | null | undefined;

  if (selected && state?.inputValue === selected.label) return selected.flag;
  return <SearchIcon className="size-4 text-icon-default" />;
}

function NoCountry() {
  return <p className="px-3 py-2.5 text-small text-tertiary">No country matches</p>;
}
