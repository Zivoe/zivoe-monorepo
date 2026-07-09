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
    <ScrollArea className="h-50 w-50 border border-contrast">
      <div className="h-250">Content</div>
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  )
};

export const Horizontal: Story = {
  render: () => (
    <ScrollArea className="w-50 border border-contrast">
      <div className="h-50 w-250">Content</div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
};
