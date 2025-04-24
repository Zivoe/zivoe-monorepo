import type { Meta, StoryObj } from '@storybook/react';

import { Disclosure, DisclosureGroup, DisclosureHeader, DisclosurePanel, type DisclosureProps } from '.';

const meta: Meta<DisclosureProps> = {
  title: 'Core/Disclosure',
  component: Disclosure,
  tags: ['autodocs']
};

export default meta;
type Story = StoryObj<typeof Disclosure>;

export const Default: Story = {
  render: () => (
    <Disclosure>
      <DisclosureHeader>System Requirements</DisclosureHeader>
      <DisclosurePanel>Details about system requirements here.</DisclosurePanel>
    </Disclosure>
  )
};

export const WithLongContent: Story = {
  render: () => (
    <Disclosure>
      <DisclosureHeader>Terms and Conditions</DisclosureHeader>
      <DisclosurePanel>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget ultricies aliquam, nunc nisl
        aliquet nunc, eget aliquam nisl nunc eget nisl. Nullam euismod, nisl eget ultricies aliquam, nunc nisl aliquet
        nunc, eget aliquam nisl nunc eget nisl.
      </DisclosurePanel>
    </Disclosure>
  )
};

export const Group: Story = {
  render: () => (
    <div className="w-[500px]">
      <DisclosureGroup>
        <Disclosure>
          <DisclosureHeader>Section 1</DisclosureHeader>
          <DisclosurePanel>Content for section 1.</DisclosurePanel>
        </Disclosure>

        <Disclosure>
          <DisclosureHeader>Section 2</DisclosureHeader>
          <DisclosurePanel>Content for section 2.</DisclosurePanel>
        </Disclosure>

        <Disclosure>
          <DisclosureHeader>Section 3</DisclosureHeader>
          <DisclosurePanel>
            <p>Content for section 3.</p>
          </DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
    </div>
  )
};
