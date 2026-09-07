import type { Meta, StoryObj } from '@storybook/react';

import { Tooltip, TooltipFocusable, TooltipTrigger } from '.';
import { ArbitrumIcon, BaseIcon, EthereumIcon } from '../../icons';
import { Button } from '../button';

const meta: Meta = {
  title: 'Core/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  argTypes: {
    offset: {
      control: 'number',
      defaultValue: 6
    },
    placement: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right'],
      defaultValue: 'top'
    },
    showOverlayArrow: {
      control: 'boolean',
      defaultValue: false
    }
  }
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  render: (args) => (
    <TooltipTrigger>
      <Button>Hover me</Button>
      <Tooltip {...args}>Tooltip content</Tooltip>
    </TooltipTrigger>
  )
};

export const Placements: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      {(['top', 'bottom', 'left', 'right'] as const).map((placement) => (
        <TooltipTrigger key={placement}>
          <Button>{placement}</Button>
          <Tooltip placement={placement} showOverlayArrow>
            Tooltip on {placement}
          </Tooltip>
        </TooltipTrigger>
      ))}
    </div>
  )
};

/** A non-interactive trigger: plain icons wrapped in TooltipFocusable, stacked with a surface-colored ring. */
export const IconStack: Story = {
  render: () => (
    <div className="flex items-center -space-x-1">
      {[
        { label: 'Ethereum', Icon: EthereumIcon },
        { label: 'Base', Icon: BaseIcon },
        { label: 'Arbitrum', Icon: ArbitrumIcon }
      ].map(({ label, Icon }) => (
        <TooltipTrigger key={label}>
          <TooltipFocusable>
            <span
              role="img"
              aria-label={label}
              className="relative rounded-full ring-2 ring-neutral-0 hover:z-10 [&_svg]:size-5"
            >
              <Icon />
            </span>
          </TooltipFocusable>
          <Tooltip>{label}</Tooltip>
        </TooltipTrigger>
      ))}
    </div>
  )
};
