import type { Meta, StoryObj } from '@storybook/react';

import { NativeScrollArea } from './native-scroll-area';

const meta: Meta = {
  title: 'Core/NativeScrollArea',
  component: NativeScrollArea,
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['vertical', 'horizontal']
    }
  }
};

export default meta;
type Story = StoryObj<typeof NativeScrollArea>;

export const Default: Story = {
  render: () => (
    <NativeScrollArea className="h-75 w-50">
      <div className="bg-neutral-200 h-250">Content</div>
    </NativeScrollArea>
  )
};

export const Horizontal: Story = {
  render: () => (
    <NativeScrollArea className="w-50">
      <div className="bg-neutral-200 h-75 w-250">Content</div>
    </NativeScrollArea>
  )
};
