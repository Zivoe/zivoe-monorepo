import React, { useContext, useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';
import { ComboBoxStateContext, type Key } from 'react-aria-components';

import { SearchIcon } from '../../icons';
import { FieldError } from '../field/field-error';
import { Label } from '../field/label';
import { ComboBox, ComboBoxInput, ComboBoxItem, ComboBoxListBox, ComboBoxPopover } from './combo-box';

const meta: Meta = {
  title: 'Core/ComboBox',
  component: ComboBox,
  tags: ['autodocs']
};

export default meta;
type Story = StoryObj<typeof ComboBox>;

// A sample of the dapp's country list (English display names, flag emoji).
const countries = [
  { id: 'Australia', flag: '🇦🇺' },
  { id: 'Brazil', flag: '🇧🇷' },
  { id: 'Canada', flag: '🇨🇦' },
  { id: 'Côte d’Ivoire', flag: '🇨🇮' },
  { id: 'France', flag: '🇫🇷' },
  { id: 'Germany', flag: '🇩🇪' },
  { id: 'India', flag: '🇮🇳' },
  { id: 'Japan', flag: '🇯🇵' },
  { id: 'Mexico', flag: '🇲🇽' },
  { id: 'Netherlands', flag: '🇳🇱' },
  { id: 'Romania', flag: '🇷🇴' },
  { id: 'Singapore', flag: '🇸🇬' },
  { id: 'South Korea', flag: '🇰🇷' },
  { id: 'Spain', flag: '🇪🇸' },
  { id: 'Switzerland', flag: '🇨🇭' },
  { id: 'Türkiye', flag: '🇹🇷' },
  { id: 'United Kingdom', flag: '🇬🇧' },
  { id: 'United States', flag: '🇺🇸' }
];

type Country = (typeof countries)[number];

/** The picked country's flag while the field shows its name; a search icon while typing. */
function SelectedFlag() {
  const state = useContext(ComboBoxStateContext);
  const selected = state?.selectedItems[0]?.value as Country | null | undefined;

  if (selected && state?.inputValue === selected.id) return selected.flag;
  return <SearchIcon className="size-4 text-icon-default" />;
}

function CountryField({ defaultValue = null, isInvalid }: { defaultValue?: Key | null; isInvalid?: boolean }) {
  const [value, setValue] = useState<Key | null>(defaultValue);

  return (
    <div className="flex w-80 flex-col gap-4">
      <ComboBox
        defaultItems={countries}
        value={value}
        onChange={setValue}
        isInvalid={isInvalid}
        validationBehavior="aria"
      >
        <Label>Country Of Residence</Label>
        <ComboBoxInput placeholder="Search country" startContent={<SelectedFlag />} />
        <FieldError>Please select a country</FieldError>

        <ComboBoxPopover>
          <ComboBoxListBox<Country>>
            {(country) => (
              <ComboBoxItem id={country.id} textValue={country.id}>
                <span aria-hidden="true" className="text-regular">
                  {country.flag}
                </span>
                <span>{country.id}</span>
              </ComboBoxItem>
            )}
          </ComboBoxListBox>
        </ComboBoxPopover>
      </ComboBox>

      <p className="text-small text-tertiary">Value: {value === null ? '—' : String(value)}</p>
    </div>
  );
}

export const Default: Story = {
  render: () => <CountryField />
};

export const WithValue: Story = {
  render: () => <CountryField defaultValue="Romania" />
};

export const Invalid: Story = {
  render: () => <CountryField isInvalid />
};

export const Disabled: Story = {
  render: () => (
    <ComboBox className="w-80" isDisabled defaultItems={countries} defaultValue="Romania">
      <Label>Country Of Residence</Label>
      <ComboBoxInput startContent="🇷🇴" />
      <ComboBoxPopover>
        <ComboBoxListBox<Country>>
          {(country) => <ComboBoxItem id={country.id}>{country.id}</ComboBoxItem>}
        </ComboBoxListBox>
      </ComboBoxPopover>
    </ComboBox>
  )
};
