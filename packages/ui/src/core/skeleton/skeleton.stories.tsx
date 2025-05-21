import type { Meta, StoryObj } from '@storybook/react';

import { Skeleton, type SkeletonProps } from '.';

const meta: Meta<SkeletonProps> = {
  title: 'Core/Skeleton',
  component: Skeleton,
  tags: ['autodocs']
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  render: () => <Skeleton className="size-80" />
};

export const Custom: Story = {
  render: () => (
    <div className="flex gap-4">
      <Skeleton className="rounded-4 size-80" />
      <Skeleton className="rounded-4 flex-1" />
    </div>
  )
};
