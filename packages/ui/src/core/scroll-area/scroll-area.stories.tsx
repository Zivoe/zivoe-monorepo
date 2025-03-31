import type { Meta, StoryObj } from '@storybook/react';

import { ScrollArea, ScrollBar } from './scroll-area';

const meta: Meta = {
  title: 'Core/ScrollArea',
  component: ScrollBar,
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['vertical', 'horizontal']
    }
  }
};

export default meta;
type Story = StoryObj<typeof ScrollBar>;

export const Default: Story = {
  render: () => (
    <ScrollArea className="h-[200px] w-[200px] border border-contrast">
      <div className="h-[1000px]">Content</div>
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  )
};

export const Horizontal: Story = {
  render: () => (
    <ScrollArea className="w-[200px] border border-contrast">
      <div className="h-[200px] w-[1000px]">Content</div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
};
