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
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="md">Button</Button>
      <Button size="lg">Button</Button>
    </div>
  )
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary">Button</Button>
      <Button variant="secondary">Button</Button>
    </div>
  )
};

export const FullWidth: Story = {
  args: {
    fullWidth: true,
    children: 'Button'
  }
};
