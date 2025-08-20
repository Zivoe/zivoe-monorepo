import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { Tab, TabList, TabPanel, Tabs } from './tabs';

const meta = {
  title: 'Core/Tabs',
  component: Tabs,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: { type: 'select' },
      options: ['horizontal', 'vertical']
    }
  }
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[600px]">
      <Tabs {...args}>
        <TabList aria-label="Example tabs">
          <Tab id="deposit">Deposit</Tab>
          <Tab id="redeem">Redeem</Tab>
        </TabList>

        <TabPanel id="deposit">
          <div className="p-4">
            <h3 className="text-lg font-semibold">Deposit Content</h3>
            <p className="mt-2 text-secondary">
              This is the content for the deposit tab. You can add forms, information, or any other content here.
            </p>
          </div>
        </TabPanel>

        <TabPanel id="redeem">
          <div className="p-4">
            <h3 className="text-lg font-semibold">Redeem Content</h3>
            <p className="mt-2 text-secondary">
              This is the content for the redeem tab. You can add forms, information, or any other content here.
            </p>
          </div>
        </TabPanel>
      </Tabs>
    </div>
  )
};

export const Vertical: Story = {
  args: {
    orientation: 'vertical'
  },
  render: (args) => (
    <div className="w-[600px]">
      <Tabs {...args}>
        <TabList aria-label="Vertical tabs">
          <Tab id="overview">Overview</Tab>
          <Tab id="analytics">Analytics</Tab>
          <Tab id="reports">Reports</Tab>
          <Tab id="settings">Settings</Tab>
        </TabList>

        <TabPanel id="overview" className="ml-4">
          <div className="p-4">
            <h3 className="text-lg font-semibold">Overview</h3>
            <p className="mt-2 text-secondary">Dashboard overview and key metrics.</p>
          </div>
        </TabPanel>

        <TabPanel id="analytics" className="ml-4">
          <div className="p-4">
            <h3 className="text-lg font-semibold">Analytics</h3>
            <p className="mt-2 text-secondary">Detailed analytics and insights.</p>
          </div>
        </TabPanel>

        <TabPanel id="reports" className="ml-4">
          <div className="p-4">
            <h3 className="text-lg font-semibold">Reports</h3>
            <p className="mt-2 text-secondary">Generate and view reports.</p>
          </div>
        </TabPanel>

        <TabPanel id="settings" className="ml-4">
          <div className="p-4">
            <h3 className="text-lg font-semibold">Settings</h3>
            <p className="mt-2 text-secondary">Configure your preferences.</p>
          </div>
        </TabPanel>
      </Tabs>
    </div>
  )
};

export const WithDisabledTab: Story = {
  render: (args) => (
    <div className="w-[600px]">
      <Tabs {...args}>
        <TabList aria-label="Tabs with disabled">
          <Tab id="active">Active</Tab>

          <Tab id="disabled" isDisabled>
            Disabled
          </Tab>
          <Tab id="another">Another</Tab>
        </TabList>

        <TabPanel id="active">
          <div className="p-4">
            <h3 className="text-lg font-semibold">Active Tab</h3>
            <p className="mt-2 text-secondary">This tab is active and clickable.</p>
          </div>
        </TabPanel>

        <TabPanel id="another">
          <div className="p-4">
            <h3 className="text-lg font-semibold">Another Tab</h3>
            <p className="mt-2 text-secondary">This is another active tab.</p>
          </div>
        </TabPanel>
      </Tabs>
    </div>
  )
};

export const Controlled: Story = {
  render: function ControlledTabs() {
    const [selectedKey, setSelectedKey] = useState('tab1');

    return (
      <div className="w-[600px]">
        <div className="mb-4">
          <p className="text-sm text-secondary">Current tab: {selectedKey}</p>
        </div>

        <Tabs selectedKey={selectedKey} onSelectionChange={(key) => setSelectedKey(key as string)}>
          <TabList aria-label="Controlled tabs">
            <Tab id="tab1">Tab 1</Tab>
            <Tab id="tab2">Tab 2</Tab>
            <Tab id="tab3">Tab 3</Tab>
          </TabList>

          <TabPanel id="tab1">
            <div className="p-4">
              <h3 className="text-lg font-semibold">Tab 1 Content</h3>
              <p className="mt-2 text-secondary">This is controlled tab 1.</p>
            </div>
          </TabPanel>

          <TabPanel id="tab2">
            <div className="p-4">
              <h3 className="text-lg font-semibold">Tab 2 Content</h3>
              <p className="mt-2 text-secondary">This is controlled tab 2.</p>
            </div>
          </TabPanel>

          <TabPanel id="tab3">
            <div className="p-4">
              <h3 className="text-lg font-semibold">Tab 3 Content</h3>
              <p className="mt-2 text-secondary">This is controlled tab 3.</p>
            </div>
          </TabPanel>
        </Tabs>

        <div className="mt-4 flex gap-2">
          <button onClick={() => setSelectedKey('tab1')} className="rounded bg-element-primary px-3 py-1 text-base">
            Go to Tab 1
          </button>
          <button onClick={() => setSelectedKey('tab2')} className="rounded bg-element-primary px-3 py-1 text-base">
            Go to Tab 2
          </button>
          <button onClick={() => setSelectedKey('tab3')} className="rounded bg-element-primary px-3 py-1 text-base">
            Go to Tab 3
          </button>
        </div>
      </div>
    );
  }
};

export const DynamicTabs: Story = {
  render: function DynamicTabsExample() {
    const tabsData = [
      { id: 'account', label: 'Account', content: 'Manage your account settings and preferences.' },
      { id: 'security', label: 'Security', content: 'Configure security options and two-factor authentication.' },
      { id: 'notifications', label: 'Notifications', content: 'Control your notification preferences.' },
      { id: 'privacy', label: 'Privacy', content: 'Review and update your privacy settings.' }
    ];

    return (
      <div className="w-[600px]">
        <Tabs>
          <TabList aria-label="Dynamic tabs">
            {tabsData.map((tab) => (
              <Tab key={tab.id} id={tab.id}>
                {tab.label}
              </Tab>
            ))}
          </TabList>

          {tabsData.map((tab) => (
            <TabPanel key={tab.id} id={tab.id}>
              <div className="p-4">
                <h3 className="text-lg font-semibold">{tab.label}</h3>
                <p className="mt-2 text-secondary">{tab.content}</p>
              </div>
            </TabPanel>
          ))}
        </Tabs>
      </div>
    );
  }
};
