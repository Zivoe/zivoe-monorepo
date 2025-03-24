import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { ChartIcon } from '../../icons';
import { Select, SelectItem, SelectListBox, SelectPopover, SelectTrigger, SelectValue } from './select';

const meta: Meta = {
  title: 'Core/Select',
  component: Select,
  tags: ['autodocs'],
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof Select>;

const items = [
  { id: 0, label: 'Index price' },
  { id: 1, label: 'Market price' },
  { id: 2, label: 'TVL' },
  { id: 3, label: 'APY' }
];

export const Default: Story = {
  render: () => {
    return (
      <>
        <Select className="w-[200px]" placeholder="Select an animal" defaultSelectedKey={0}>
          <SelectTrigger>
            <ChartIcon className="size-4 text-icon-default" />
            <SelectValue />
          </SelectTrigger>

          <SelectPopover>
            <SelectListBox items={items}>{(item) => <SelectItem key={item.id}>{item.label}</SelectItem>}</SelectListBox>
          </SelectPopover>
        </Select>
      </>
    );
  }
};
