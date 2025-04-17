import type { Meta, StoryObj } from '@storybook/react';

import { ContextualHelp, ContextualHelpDescription, ContextualHelpTitle } from '.';

const meta: Meta = {
  title: 'Core/ContextualHelp',
  component: ContextualHelp,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['info', 'help'],
      defaultValue: 'help'
    }
  }
};

export default meta;
type Story = StoryObj<typeof ContextualHelp>;

export const Default: Story = {
  render: (args) => (
    <ContextualHelp {...args}>
      <ContextualHelpTitle>What is a segment?</ContextualHelpTitle>

      <ContextualHelpDescription>
        Segments identify who your visitors are, what devices and services they use, where they navigated from, and much
        more.
      </ContextualHelpDescription>
    </ContextualHelp>
  )
};

export const Variants: Story = {
  render: () => (
    <div className="flex w-fit flex-col gap-4">
      <div className="flex items-center gap-2">
        <ContextualHelp variant="info">
          <ContextualHelpTitle>Permission required</ContextualHelpTitle>

          <ContextualHelpDescription>
            Your admin must grant you permission before you can create a segment.
          </ContextualHelpDescription>
        </ContextualHelp>

        <p className="text-regular text-secondary">
          The content for an <span className="underline underline-offset-4">info</span> icon's popover should be
          instructive in tone.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <ContextualHelp variant="help">
          <ContextualHelpTitle>Need help?</ContextualHelpTitle>

          <ContextualHelpDescription>
            Segments identify who your visitors are, what devices and services they use, where they navigated from, and
            much more.
          </ContextualHelpDescription>
        </ContextualHelp>

        <p className="text-regular text-secondary">
          The content for an <span className="underline underline-offset-4">help</span> icon's popover should be helpful
          in tone.
        </p>
      </div>
    </div>
  )
};
