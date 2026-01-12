import type { Meta, StoryObj } from '@storybook/react';

import { BankIcon, WalletIcon } from '../../icons';
import { Radio, RadioGroup } from '.';

const meta: Meta = {
  title: 'Core/Radio',
  component: RadioGroup,
  tags: ['autodocs'],
  argTypes: {
    isDisabled: { control: 'boolean' },
    isInvalid: { control: 'boolean' },
    errorMessage: { control: 'text' }
  }
};

export default meta;
type Story = StoryObj<typeof RadioGroup>;

export const Default: Story = {
  render: (props) => (
    <RadioGroup {...props}>
      <Radio value="option-1">Option 1</Radio>
      <Radio value="option-2">Option 2</Radio>
      <Radio value="option-3">Option 3</Radio>
    </RadioGroup>
  ),
  args: {
    label: 'Select your favorite option'
  }
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup isDisabled defaultValue="option-1">
      <Radio value="option-1">Option 1</Radio>
      <Radio value="option-2">Option 2</Radio>
    </RadioGroup>
  )
};

export const Invalid: Story = {
  render: () => (
    <RadioGroup isInvalid label="Select your favorite option" errorMessage="Please select an option">
      <Radio value="option-1">Option 1</Radio>
      <Radio value="option-2">Option 2</Radio>
    </RadioGroup>
  )
};

export const CardVariant: Story = {
  render: (props) => (
    <RadioGroup {...props}>
      <Radio variant="card" value="individual">
        <WalletIcon className="size-6" />
        <span>Individual</span>
      </Radio>
      <Radio variant="card" value="organization">
        <BankIcon className="size-6" />
        <span>Organization</span>
      </Radio>
    </RadioGroup>
  ),
  args: {
    label: 'Select account type'
  }
};

export const CardVariantDisabled: Story = {
  render: () => (
    <RadioGroup isDisabled defaultValue="individual" label="Select account type">
      <Radio variant="card" value="individual">
        <WalletIcon className="size-6" />
        <span>Individual</span>
      </Radio>
      <Radio variant="card" value="organization">
        <BankIcon className="size-6" />
        <span>Organization</span>
      </Radio>
    </RadioGroup>
  )
};

export const CardVariantInvalid: Story = {
  render: () => (
    <RadioGroup isInvalid label="Select account type" errorMessage="Please select an account type">
      <Radio variant="card" value="individual">
        <WalletIcon className="size-6" />
        <span>Individual</span>
      </Radio>
      <Radio variant="card" value="organization">
        <BankIcon className="size-6" />
        <span>Organization</span>
      </Radio>
    </RadioGroup>
  )
};
