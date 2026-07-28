import type { Meta, StoryObj } from '@storybook/react';

import { Callout, type CalloutProps, calloutVariants } from './callout';

const meta: Meta<CalloutProps> = {
  title: 'Core/Callout',
  component: Callout,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: Object.keys(calloutVariants.variants.variant),
      defaultValue: calloutVariants.defaultVariants.variant
    },
    children: {
      control: 'text'
    },
    hideIcon: {
      control: 'boolean'
    },
    className: {
      control: 'text'
    }
  }
};

export default meta;
type Story = StoryObj<typeof Callout>;

export const Default: Story = {
  args: {
    children: 'Deposits settle once the manager publishes the next price.'
  }
};

export const Variants: Story = {
  render: (props) => (
    <div className="flex max-w-100 flex-col gap-3">
      <Callout variant="info" {...props} />
      <Callout variant="warning" {...props} />
    </div>
  ),
  args: {
    children: 'Redemptions are processed periodically, so the final amount is not known when you request it.'
  }
};

export const WithoutIcon: Story = {
  args: {
    variant: 'warning',
    hideIcon: true,
    children: 'A callout that sits under a heading already carrying its own icon.'
  }
};
