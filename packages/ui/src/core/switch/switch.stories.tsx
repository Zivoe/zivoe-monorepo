import type { Meta, StoryObj } from '@storybook/react';

import { Switch, switchVariants } from '.';

const meta: Meta<typeof Switch> = {
  title: 'Core/Switch',
  component: Switch,
  tags: ['autodocs'],
  argTypes: {
    isDisabled: {
      control: 'boolean',
      defaultValue: false
    },
    isReadOnly: {
      control: 'boolean',
      defaultValue: false
    },
    isSelected: {
      control: 'boolean',
      defaultValue: false
    },
    children: {
      control: 'text'
    }
  }
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {
  args: {
    children: 'Toggle me'
  }
};

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Switch isSelected={false}>Default</Switch>
      <Switch isSelected>Default (Selected)</Switch>
      <Switch isDisabled>Disabled</Switch>
      <Switch isDisabled isSelected>
        Disabled (Selected)
      </Switch>
      <Switch isReadOnly>Read-only</Switch>
      <Switch isReadOnly isSelected>
        Read-only (Selected)
      </Switch>
    </div>
  )
};
