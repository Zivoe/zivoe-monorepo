import type { Meta, StoryObj } from '@storybook/react';

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
