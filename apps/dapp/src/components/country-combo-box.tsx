'use client';

import {
  ComboBox,
  ComboBoxInput,
  ComboBoxItem,
  ComboBoxListBox,
  ComboBoxPopover,
  ComboBoxSelected,
  useComboBoxSearch
} from '@zivoe/ui/core/combo-box';
import { FieldError } from '@zivoe/ui/core/field/field-error';
import { Label } from '@zivoe/ui/core/field/label';

import { COUNTRIES, type Country, getCountryLabel, searchCountries } from '@/types/countries';

const countryLabel = (country: Country) => country.label;

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
  const search = useComboBoxSearch({
    items: COUNTRIES,
    search: searchCountries,
    textValue: countryLabel,
    selectedText: value ? getCountryLabel(value) : undefined
  });

  return (
    <ComboBox
      {...search}
      value={value || null}
      onChange={(key) => onChange(key === null ? '' : String(key))}
      // The whole list opens on focus (a click, a tap, Tab), as the Select it replaced did.
      menuTrigger="focus"
      isInvalid={isInvalid}
      validationBehavior="aria"
    >
      <Label>{label}</Label>
      <ComboBoxInput
        placeholder="Search"
        startContent={<ComboBoxSelected<Country>>{(country) => country.flag}</ComboBoxSelected>}
      />
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

function NoCountry() {
  return <p className="px-3 py-2.5 text-small text-tertiary">No country matches</p>;
}
