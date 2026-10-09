import type { Meta, StoryObj } from '@storybook/react';

import { Card, CardContent, CardHeader, CardTitle } from './card';

const meta: Meta<typeof Card> = {
  title: 'Core/Card',
  component: Card,
  tags: ['autodocs']
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Tokens</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-regular text-primary">Card body</p>
      </CardContent>
    </Card>
  )
};

export const WithTrailingControl: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>
          <span className="size-5 rounded-full bg-surface-brand" />
          zSMB balance
        </CardTitle>
        <span className="text-small text-secondary">30D</span>
      </CardHeader>
      <CardContent>
        <p className="text-regular text-primary">Card body</p>
      </CardContent>
    </Card>
  )
};
