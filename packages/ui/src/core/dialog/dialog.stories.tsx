import type { Meta, StoryObj } from '@storybook/react';

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '.';
import { cn } from '../../lib/tw-utils';
import { Button } from '../button';

const meta: Meta = {
  title: 'Core/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <Button>Click me</Button>

      <DialogContent>
        {({ close }) => (
          <>
            <DialogHeader>
              <DialogTitle>Lorem ipsum</DialogTitle>
            </DialogHeader>

            <Content />

            <DialogFooter>
              <Button variant="border" onPress={close}>
                Cancel
              </Button>

              <Button onPress={close}>Confirm</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
};

export const AlertDialog: Story = {
  render: () => (
    <Dialog>
      <Button>Click me</Button>

      <DialogContent isDismissable={false}>
        {({ close }) => (
          <>
            <DialogHeader>
              <DialogTitle>Lorem ipsum</DialogTitle>
            </DialogHeader>

            <DialogFooter>
              <Button onPress={close}>Confirm</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
};

export const CustomWidth: Story = {
  render: () => (
    <Dialog>
      <Button>Click me</Button>

      <DialogContent className="sm:max-w-5xl">
        {({ close }) => (
          <>
            <DialogHeader>
              <DialogTitle>Lorem ipsum</DialogTitle>
            </DialogHeader>

            <DialogFooter>
              <Button onPress={close}>Got it</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
};

export const LongContent: Story = {
  render: () => (
    <Dialog>
      <Button>Click me</Button>

      <DialogContent>
        {({ close }) => (
          <>
            <DialogHeader>
              <DialogTitle>Lorem ipsum</DialogTitle>
            </DialogHeader>

            <Content className="h-[1000px]" />

            <DialogFooter>
              <Button onPress={close}>Got it</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
};

export const FullScreen: Story = {
  render: () => (
    <Dialog>
      <Button>Click me</Button>

      <DialogContent isFullScreen>
        {({ close }) => (
          <>
            <DialogHeader>
              <DialogTitle>Describe your project</DialogTitle>
            </DialogHeader>

            <Content />

            <DialogFooter>
              <Button onPress={close}>Back</Button>

              <Button onPress={close}>Next</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
};

function Content({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-[200px] items-center justify-center rounded-lg bg-element-primary-gentle p-4 text-primary',
        className
      )}
    >
      Content
    </div>
  );
}
