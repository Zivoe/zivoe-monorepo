import { Meta, StoryObj } from '@storybook/react';

import { Button } from '../button';
import { ToastProps, Toaster, iconVariants, toast } from './sonner';

const meta: Meta = {
  title: 'Core/Toaster',
  component: Toaster,
  tags: ['autodocs'],
  argTypes: {
    type: { control: 'select', options: Object.keys(iconVariants.variants.variant) },
    title: { control: 'text' },
    description: { control: 'text' }
  }
};

export default meta;
type Story = StoryObj<typeof toast>;

export const Default: Story = {
  render: (props) => (
    <div className="h-[500px]">
      <ToastButton {...props} />
      <Toaster />
    </div>
  ),
  args: {
    title: 'Title',
    description: 'Description'
  }
};

export const Variants: Story = {
  render: () => (
    <>
      <div className="flex h-[500px] flex-wrap items-center gap-2">
        <ToastButton type="success" title="Success" description="This is a success toast">
          Success
        </ToastButton>
        <ToastButton type="error" title="Error" description="This is an error toast">
          Error
        </ToastButton>
        <ToastButton type="pending" title="Pending" description="This is a pending toast">
          Pending
        </ToastButton>
      </div>

      <Toaster />
    </>
  )
};

export const VariantsWithoutDescription: Story = {
  render: () => (
    <>
      <div className="flex h-[500px] flex-wrap items-center gap-2">
        <ToastButton type="success" title="Success">
          Success
        </ToastButton>
        <ToastButton type="error" title="Error">
          Error
        </ToastButton>
        <ToastButton type="pending" title="Pending">
          Pending
        </ToastButton>
      </div>

      <Toaster />
    </>
  )
};

export const LongText: Story = {
  render: () => (
    <div className="h-[500px]">
      <ToastButton
        type="success"
        title="Lorem ipsum dolor sit amet, consectetur adipiscing elit."
        description="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
      >
        Success
      </ToastButton>

      <Toaster />
    </div>
  )
};

function ToastButton({ children = 'Click Me', ...props }: Omit<ToastProps, 'id'> & { children?: string }) {
  return <Button onPress={() => toast({ ...props })}>{children}</Button>;
}
