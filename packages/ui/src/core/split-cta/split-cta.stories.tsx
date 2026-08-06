import type { Meta, StoryObj } from '@storybook/react';

import { SplitCta, type SplitCtaProps } from '.';
import { CheckIcon } from '../../icons';

const meta: Meta<SplitCtaProps> = {
  title: 'Core/SplitCta',
  component: SplitCta,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['xs', 's', 'm', 'l'],
      defaultValue: 'l'
    },
    fullWidth: {
      control: 'boolean',
      defaultValue: false
    },
    isDisabled: {
      control: 'boolean',
      defaultValue: false
    },
    children: {
      control: 'text'
    },
    icon: {
      control: false
    }
  }
};

export default meta;
type Story = StoryObj<typeof SplitCta>;

export const Default: Story = {
  args: {
    children: 'Launch App',
    href: '/'
  }
};

export const Sizes: Story = {
  render: (props) => (
    <div className="flex flex-wrap items-center gap-2">
      <SplitCta size="xs" {...props} />
      <SplitCta size="s" {...props} />
      <SplitCta size="m" {...props} />
      <SplitCta size="l" {...props} />
    </div>
  ),
  args: {
    children: 'Launch App',
    href: '/'
  }
};

export const FullWidth: Story = {
  args: {
    children: 'Launch App',
    fullWidth: true,
    href: '/'
  }
};

export const Disabled: Story = {
  args: {
    children: 'Launch App',
    href: '/',
    isDisabled: true
  }
};

export const CustomIcon: Story = {
  args: {
    children: 'Complete',
    href: '/',
    icon: <CheckIcon />
  }
};
