import type { Meta, StoryObj } from '@storybook/react';

import { Checkbox, CheckboxGroup, checkboxVariants } from '.';

const meta: Meta = {
  title: 'Core/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  argTypes: {
    isSelected: { control: 'boolean' },
    isDisabled: { control: 'boolean' },
    isInvalid: { control: 'boolean' },
    isIndeterminate: { control: 'boolean' },
    children: { control: 'text' }
  }
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  args: {
    children: 'Accept terms and conditions'
  }
};

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Checkbox>Default</Checkbox>
      <Checkbox isSelected>Checked</Checkbox>

      <Checkbox isInvalid>Default (Invalid)</Checkbox>
      <Checkbox isSelected isInvalid>
        Checked (Invalid)
      </Checkbox>

      <Checkbox isDisabled>Disabled</Checkbox>
      <Checkbox isDisabled isSelected>
        Disabled checked
      </Checkbox>

      <Checkbox isIndeterminate>Indeterminate</Checkbox>
      <Checkbox isDisabled isIndeterminate>
        Disabled indeterminate
      </Checkbox>
    </div>
  )
};

export const Groups: Story = {
  render: () => (
    <div className="flex flex-wrap gap-x-32 gap-y-8">
      <CheckboxGroup label="Select your favorite fruits">
        <Checkbox value="apple">Apple</Checkbox>
        <Checkbox value="banana">Banana</Checkbox>
        <Checkbox value="orange">Orange</Checkbox>
        <Checkbox value="mango">Mango</Checkbox>
      </CheckboxGroup>

      <CheckboxGroup
        isReadOnly
        isInvalid
        label="Select your favorite fruits"
        errorMessage="Please select at least one fruit"
      >
        <Checkbox value="apple">Apple</Checkbox>
        <Checkbox value="banana">Banana</Checkbox>
        <Checkbox value="orange">Orange</Checkbox>
        <Checkbox value="mango">Mango</Checkbox>
      </CheckboxGroup>
    </div>
  )
};
