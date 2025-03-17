import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta = {
  title: 'Core/Typography',
  parameters: {
    layout: 'centered'
  }
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="space-y-20">
      <section className="space-y-6">
        <p className="text-extraLarge">Extra Large Text</p>
        <p className="text-large">Large Text</p>
        <p className="text-medium">Medium Text</p>
      </section>

      <section className="space-y-6">
        <h1>Heading 1</h1>
        <h2>Heading 2</h2>
        <h3>Heading 3</h3>
        <h4>Heading 4</h4>
        <h5>Heading 5</h5>
        <h6>Heading 6</h6>
        <p className="text-h7">Heading 7</p>
      </section>

      <section className="space-y-6">
        <p className="text-subheading">Subheading</p>
        <p className="text-smallSubheading">Small Subheading</p>
        <p className="text-leading">Leading Text</p>
        <p className="text-regular">Regular Text (Body)</p>
        <p className="text-small">Small Text</p>
        <p className="text-extraSmall">Extra Small Text</p>
        <p className="text-tiny">Tiny Text</p>
      </section>
    </div>
  )
};
