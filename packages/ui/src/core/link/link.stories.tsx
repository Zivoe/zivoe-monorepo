import type { Meta, StoryObj } from '@storybook/react';

import { Link, type LinkProps } from '.';
import { buttonVariants } from '../button';

const meta: Meta<LinkProps> = {
  title: 'Core/Link',
  component: Link,
  tags: ['autodocs'],
  argTypes: {
    target: {
      control: 'select',
      options: ['_self', '_blank', '_parent', '_top'],
      defaultValue: '_self'
    },
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
type Story = StoryObj<typeof Link>;

export const Default: Story = {
  args: {
    children: 'Link',
    href: '/'
  }
};

export const Sizes: Story = {
  render: (props) => (
    <div className="flex flex-wrap items-center gap-2">
      <Link size="l" {...props} />
      <Link size="m" {...props} />
      <Link size="s" {...props} />
      <Link size="xs" {...props} />
    </div>
  ),
  args: {
    variant: 'link-primary',
    children: 'Link',
    href: '/'
  }
};

export const Variants: Story = {
  render: (props) => (
    <div className="flex flex-wrap gap-2">
      <Link variant="primary" {...props} />
      <Link variant="secondary" {...props} />
      <Link variant="primary-light" {...props} />
      <Link variant="secondary-light" {...props} />
      <Link variant="border" {...props} />
      <Link variant="border-light" {...props} />
      <Link variant="alert" {...props} />
      <Link variant="ghost" {...props} />
      <Link variant="ghost-light" {...props} />
      <Link variant="link-primary" {...props} />
      <Link variant="link-secondary" {...props} />
      <Link variant="link-neutral-dark" {...props} />
      <Link variant="link-neutral-light" {...props} />
      <Link variant="link-alert" {...props} />
    </div>
  ),
  args: {
    children: 'Link',
    href: '/'
  }
};

export const External: Story = {
  render: (props) => (
    <div className="flex flex-wrap gap-2">
      <Link variant="primary" {...props} />
      <Link variant="secondary" {...props} />
      <Link variant="primary-light" {...props} />
      <Link variant="secondary-light" {...props} />
      <Link variant="border" {...props} />
      <Link variant="border-light" {...props} />
      <Link variant="alert" {...props} />
      <Link variant="ghost" {...props} />
      <Link variant="ghost-light" {...props} />
      <Link variant="link-primary" {...props} />
      <Link variant="link-secondary" {...props} />
      <Link variant="link-neutral-dark" {...props} />
      <Link variant="link-neutral-light" {...props} />
      <Link variant="link-alert" {...props} />
    </div>
  ),
  args: {
    children: 'Link',
    href: '/',
    target: '_blank'
  }
};
export const Disabled: Story = {
  render: (props) => (
    <div className="flex flex-wrap gap-2">
      <Link variant="primary" {...props} />
      <Link variant="secondary" {...props} />
      <Link variant="primary-light" {...props} />
      <Link variant="secondary-light" {...props} />
      <Link variant="border" {...props} />
      <Link variant="border-light" {...props} />
      <Link variant="alert" {...props} />
      <Link variant="ghost" {...props} />
      <Link variant="ghost-light" {...props} />
      <Link variant="link-primary" {...props} />
      <Link variant="link-secondary" {...props} />
      <Link variant="link-neutral-dark" {...props} />
      <Link variant="link-neutral-light" {...props} />
      <Link variant="link-alert" {...props} />
    </div>
  ),

  args: {
    children: 'Link',
    href: '/',
    isDisabled: true
  }
};
