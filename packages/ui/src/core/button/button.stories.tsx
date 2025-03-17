import type { Meta, StoryObj } from '@storybook/react';

import { Button, type ButtonProps, buttonVariants } from '.';

const meta: Meta<ButtonProps> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: Object.keys(buttonVariants.variants.variant),
      defaultValue: buttonVariants.defaultVariants.variant
    },
    size: {
      control: 'select',
      options: Object.keys(buttonVariants.variants.size),
      defaultValue: buttonVariants.defaultVariants.size
    },
    fullWidth: {
      control: 'boolean',
      defaultValue: buttonVariants.defaultVariants.fullWidth
    },
    isPending: {
      control: 'boolean',
      defaultValue: false
    },
    pendingContent: {
      control: 'text'
    },
    isDisabled: {
      control: 'boolean',
      defaultValue: false
    },
    children: {
      control: 'text'
    }
  }
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: 'Button'
  }
};

export const Sizes: Story = {
  render: (props) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="l" {...props} />
      <Button size="m" {...props} />
      <Button size="s" {...props} />
      <Button size="xs" {...props} />
    </div>
  ),
  args: {
    children: 'Button'
  }
};

export const Variants: Story = {
  render: (props) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary" {...props} />
      <Button variant="secondary" {...props} />
      <Button variant="primary-light" {...props} />
      <Button variant="secondary-light" {...props} />
      <Button variant="border" {...props} />
      <Button variant="border-light" {...props} />
      <Button variant="alert" {...props} />
      <Button variant="ghost" {...props} />
      <Button variant="ghost-light" {...props} />
    </div>
  ),
  args: {
    children: 'Button'
  }
};

export const Pending: Story = {
  render: (props) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary" {...props} />
      <Button variant="secondary" {...props} />
      <Button variant="primary-light" {...props} />
      <Button variant="secondary-light" {...props} />
      <Button variant="border" {...props} />
      <Button variant="border-light" {...props} />
      <Button variant="alert" {...props} />
      <Button variant="ghost" {...props} />
      <Button variant="ghost-light" {...props} />
    </div>
  ),
  args: {
    isPending: true,
    pendingContent: 'Saving...',
    children: 'Button'
  }
};

export const Disabled: Story = {
  render: (props) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary" {...props} />
      <Button variant="secondary" {...props} />
      <Button variant="primary-light" {...props} />
      <Button variant="secondary-light" {...props} />
      <Button variant="border" {...props} />
      <Button variant="border-light" {...props} />
      <Button variant="alert" {...props} />
      <Button variant="ghost" {...props} />
      <Button variant="ghost-light" {...props} />
    </div>
  ),
  args: {
    isDisabled: true,
    children: 'Button'
  }
};

export const FullWidth: Story = {
  args: {
    fullWidth: true,
    children: 'Button'
  }
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Button>
        <Icon />
      </Button>

      <Button>
        <Icon />
        Button
      </Button>

      <Button>
        Button
        <Icon />
      </Button>

      <Button>
        <Icon />
        Button
        <Icon />
      </Button>
    </div>
  )
};

const Icon = () => {
  return <div className="size-4 rounded-full bg-element-neutral" />;
};
