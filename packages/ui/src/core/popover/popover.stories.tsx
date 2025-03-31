import type { Meta, StoryObj } from '@storybook/react';

import { Popover, PopoverTrigger } from '.';
import { Button } from '../button';

const meta: Meta = {
  title: 'Core/Popover',
  component: Popover,
  tags: ['autodocs'],
  argTypes: {
    offset: {
      control: 'number',
      defaultValue: 8
    },
    placement: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right'],
      defaultValue: 'top'
    },
    showOverlayArrow: {
      control: 'boolean',
      defaultValue: true
    }
  }
};

export default meta;
type Story = StoryObj<typeof Popover>;

export const Default: Story = {
  render: (args) => (
    <PopoverTrigger>
      <Button>Click me</Button>
      <Popover {...args}>Popover Content</Popover>
    </PopoverTrigger>
  )
};

export const Placements: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <PopoverTrigger>
        <Button>Top</Button>
        <Popover placement="top">Popover on top</Popover>
      </PopoverTrigger>

      <PopoverTrigger>
        <Button>Bottom</Button>
        <Popover placement="bottom">Popover on bottom</Popover>
      </PopoverTrigger>

      <PopoverTrigger>
        <Button>Left</Button>
        <Popover placement="left">Popover on left</Popover>
      </PopoverTrigger>

      <PopoverTrigger>
        <Button>Right</Button>
        <Popover placement="right">Popover on right</Popover>
      </PopoverTrigger>
    </div>
  )
};

export const LongContent: Story = {
  render: () => (
    <PopoverTrigger>
      <Button>Click me</Button>
      <Popover>
        This is a popover with a longer description to demonstrate how it handles multiple lines of text.
      </Popover>
    </PopoverTrigger>
  )
};
