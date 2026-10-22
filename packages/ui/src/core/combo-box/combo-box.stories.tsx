import React, { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { FieldError } from '../field/field-error';
import { Label } from '../field/label';
import {
  ComboBox,
  ComboBoxInput,
  ComboBoxItem,
  ComboBoxListBox,
  ComboBoxPopover,
  ComboBoxSelected,
  useComboBoxSearch
} from './combo-box';

const meta: Meta = {
  title: 'Core/ComboBox',
  component: ComboBox,
  tags: ['autodocs']
};

export default meta;
type Story = StoryObj<typeof ComboBox>;

// A sample of the dapp's country list: ISO code (the value), English name, flag emoji.
const countries = [
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'CI', name: 'Côte d’Ivoire', flag: '🇨🇮' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'TR', name: 'Türkiye', flag: '🇹🇷' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'US', name: 'United States', flag: '🇺🇸' }
];

type Country = (typeof countries)[number];

// Letters and digits only, lowercase: "Côte d’Ivoire" matches "cote d ivoire".
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase();

/** The countries a search matches, best first: the ISO code ("us"), then names starting with the text, then names containing it. */
function searchCountries(query: string): Array<Country> {
  const q = normalize(query);
  if (!q) return countries;

  const rank = ({ code, name }: Country) =>
    code.toLowerCase() === q ? 0 : normalize(name).startsWith(q) ? 1 : normalize(name).includes(q) ? 2 : null;

  return countries
    .flatMap((country) => {
      const r = rank(country);
      return r === null ? [] : [{ country, r }];
    })
    .sort((a, b) => a.r - b.r)
    .map(({ country }) => country);
}

const countryName = (country: Country) => country.name;

/** The dapp's country field, in short: ranked search, the picked country's flag, the code as value. */
function CountryField({ defaultValue = '', isInvalid }: { defaultValue?: string; isInvalid?: boolean }) {
  const [value, setValue] = useState(defaultValue);
  const search = useComboBoxSearch({
    items: countries,
    search: searchCountries,
    textValue: countryName,
    selectedText: countries.find((country) => country.code === value)?.name
  });

  return (
    <div className="flex w-80 flex-col gap-4">
      <ComboBox
        {...search}
        value={value || null}
        onChange={(key) => setValue(key === null ? '' : String(key))}
        // The whole list opens on focus (a click on the field or its label, Tab, a tap).
        menuTrigger="focus"
        isInvalid={isInvalid}
        validationBehavior="aria"
      >
        <Label>Country Of Residence</Label>
        <ComboBoxInput
          placeholder="Search"
          startContent={<ComboBoxSelected<Country>>{(country) => country.flag}</ComboBoxSelected>}
        />
        <FieldError>Please select a country</FieldError>

        <ComboBoxPopover>
          <ComboBoxListBox<Country>>
            {(country) => (
              <ComboBoxItem id={country.code} textValue={country.name}>
                <span aria-hidden="true" className="text-regular">
                  {country.flag}
                </span>
                <span>{country.name}</span>
              </ComboBoxItem>
            )}
          </ComboBoxListBox>
        </ComboBoxPopover>
      </ComboBox>

      <p className="text-small text-tertiary">Value: {value || '—'}</p>
    </div>
  );
}

export const Default: Story = {
  render: () => <CountryField />
};

export const WithValue: Story = {
  render: () => <CountryField defaultValue="RO" />
};

export const Invalid: Story = {
  render: () => <CountryField isInvalid />
};

export const Disabled: Story = {
  render: () => (
    <ComboBox className="w-80" isDisabled defaultItems={countries} defaultValue="RO">
      <Label>Country Of Residence</Label>
      <ComboBoxInput startContent="🇷🇴" />
      <ComboBoxPopover>
        <ComboBoxListBox<Country>>
          {(country) => (
            <ComboBoxItem id={country.code} textValue={country.name}>
              {country.name}
            </ComboBoxItem>
          )}
        </ComboBoxListBox>
      </ComboBoxPopover>
    </ComboBox>
  )
};
