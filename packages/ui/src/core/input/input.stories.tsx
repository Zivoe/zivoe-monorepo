import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { Input, type InputProps } from '.';
import { Button } from '../button';

const meta: Meta<InputProps> = {
  title: 'Core/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'password', 'number', 'email', 'tel', 'url']
    },
    label: {
      control: 'text'
    },
    placeholder: {
      control: 'text'
    },
    errorMessage: {
      control: 'text'
    },
    isClearable: {
      control: 'boolean',
      defaultValue: false
    },
    isDisabled: {
      control: 'boolean',
      defaultValue: false
    },
    isInvalid: {
      control: 'boolean',
      defaultValue: false
    },
    startContent: {
      control: 'boolean',
      defaultValue: false
    },
    endContent: {
      control: 'boolean',
      defaultValue: false
    }
  }
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: 'Type something...',
    startContent: false,
    endContent: false
  },
  render: (args) => (
    <Input
      {...args}
      startContent={args.startContent ? <Icon /> : null}
      endContent={args.endContent ? <Icon /> : null}
    />
  )
};

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <Input placeholder="Default" />
      <Input placeholder="Password" type="password" />
      <Input placeholder="Clearable" isClearable />
      <Input placeholder="With Label" label="Label" />
      <Input isDisabled placeholder="Disabled" />
      <Input isInvalid placeholder="Invalid" errorMessage="This field is required" />
      <Input placeholder="Left Content" startContent={<Icon />} id="aaaa1" />
      <Input placeholder="Right Content" endContent={<Icon />} />
      <Input placeholder="Right Content Clearable" endContent={<Button size="s">Button</Button>} isClearable />
    </div>
  )
};

function Icon() {
  return <div className="size-4 rounded-full bg-surface-brand" />;
}
