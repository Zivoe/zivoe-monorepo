import type { Meta, StoryObj } from '@storybook/react';

import Badge, { type BadgeProps, badgeVariants } from './badge';

const meta: Meta<BadgeProps> = {
  title: 'Core/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: Object.keys(badgeVariants.variants.variant),
      defaultValue: badgeVariants.defaultVariants.variant
    },
    children: {
      control: 'text'
    },
    className: {
      control: 'text'
    }
  }
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    children: 'Badge'
  }
};

export const Variants: Story = {
  render: (props) => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="primary" {...props} />
      <Badge variant="secondary" {...props} />
      <Badge variant="neutral" {...props} />
      <Badge variant="warning" {...props} />
      <Badge variant="alert" {...props} />
    </div>
  ),
  args: {
    children: 'Badge'
  }
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>
        <Icon />
        New
      </Badge>

      <Badge>
        42
        <Icon />
      </Badge>

      <Badge>
        <Icon />
        Premium
        <Icon />
      </Badge>
    </div>
  )
};

const Icon = () => {
  return <div className="size-4 rounded-full bg-surface-brand" />;
};
