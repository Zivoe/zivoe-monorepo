import type { Meta, StoryObj } from '@storybook/react';

import { Separator } from './separator';

const meta: Meta = {
  title: 'Core/Separator',
  component: Separator,
  tags: ['autodocs'],
  argTypes: {
    children: {
      control: 'text'
    }
  }
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Default: Story = {
  render: (props) => <Separator {...props} />,
  args: {
    children: undefined
  }
};

export const WithText: Story = {
  render: () => <Separator>Text</Separator>
};
