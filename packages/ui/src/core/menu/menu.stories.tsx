import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';
import { Selection } from 'react-aria-components';

import { Menu, MenuButton, MenuItem, MenuPopover, MenuSeparator, MenuSubTrigger, MenuTrigger } from '.';
import { Button } from '../button';

const meta: Meta = {
  title: 'Core/Menu',
  component: Menu,
  tags: ['autodocs'],
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof Menu>;

export const Default: Story = {
  render: () => (
    <MenuTrigger>
      <Button aria-label="Menu">Click me</Button>

      <MenuPopover>
        <Menu>
          <MenuItem onAction={() => console.log('open')}>Open</MenuItem>
          <MenuItem onAction={() => console.log('rename')}>Rename</MenuItem>
          <MenuItem onAction={() => console.log('duplicate')}>Duplicate</MenuItem>
          <MenuItem onAction={() => console.log('share')}>Share</MenuItem>
          <MenuItem onAction={() => console.log('delete')}>Delete</MenuItem>
        </Menu>
      </MenuPopover>
    </MenuTrigger>
  )
};

export const Dynamic: Story = {
  render: () => {
    const items = [
      {
        id: 'open',
        label: 'Open'
      },
      {
        id: 'rename',
        label: 'Rename'
      },
      {
        id: 'duplicate',
        label: 'Duplicate'
      },
      {
        id: 'delete',
        label: 'Delete'
      }
    ];

    return (
      <MenuTrigger>
        <Button aria-label="Menu">Click me</Button>

        <MenuPopover>
          <Menu items={items}>{(item) => <MenuItem onAction={() => alert(item.id)}>{item.label}</MenuItem>}</Menu>
        </MenuPopover>
      </MenuTrigger>
    );
  }
};

export const Links: Story = {
  render: () => (
    <MenuTrigger>
      <Button aria-label="Menu">Click me</Button>

      <MenuPopover>
        <Menu>
          <MenuItem href="https://google.com" target="_blank">
            Google
          </MenuItem>
          <MenuItem href="https://youtube.com" target="_blank">
            Youtube
          </MenuItem>
          <MenuItem href="https://github.com" target="_blank">
            Github
          </MenuItem>
          <MenuItem href="https://twitter.com" target="_blank">
            Twitter
          </MenuItem>
          <MenuItem href="https://linkedin.com" target="_blank">
            Linkedin
          </MenuItem>
        </Menu>
      </MenuPopover>
    </MenuTrigger>
  )
};

export const Sections: Story = {
  render: () => (
    <MenuTrigger>
      <Button aria-label="Menu">Click me</Button>

      <MenuPopover>
        <Menu>
          <MenuItem onAction={() => alert('new')}>New</MenuItem>
          <MenuItem onAction={() => alert('open')}>Open</MenuItem>

          <MenuSeparator />

          <MenuItem onAction={() => alert('save')}>Save</MenuItem>
          <MenuItem onAction={() => alert('rename')} isDisabled>
            Rename
          </MenuItem>

          <MenuSeparator />

          <MenuItem onAction={() => alert('delete')}>Delete</MenuItem>
        </Menu>
      </MenuPopover>
    </MenuTrigger>
  )
};

export const Submenus: Story = {
  render: () => (
    <MenuTrigger>
      <Button aria-label="Menu">Click me</Button>

      <MenuPopover>
        <Menu>
          <MenuItem>Copy</MenuItem>
          <MenuItem>Cut</MenuItem>

          <MenuSubTrigger>
            <MenuItem>Share</MenuItem>

            <MenuPopover placement="right">
              <Menu>
                <MenuItem>SMS</MenuItem>
                <MenuItem>Twitter</MenuItem>
                <MenuItem>Email</MenuItem>
                <MenuItem>Whatsapp</MenuItem>
              </Menu>
            </MenuPopover>
          </MenuSubTrigger>
        </Menu>
      </MenuPopover>
    </MenuTrigger>
  )
};

export const SingleSelection: Story = {
  render: () => <SingleSelectionComponent />
};

const items = [
  { id: '0', label: 'Date (latest)' },
  { id: '1', label: 'Date (oldest)' },
  { id: '2', label: 'Name (A-Z)' },
  { id: '3', label: 'Name (Z-A)' }
];

const SingleSelectionComponent = () => {
  let [selected, setSelected] = React.useState<any>(new Set(['0']));

  const hasSelection = selected === 'all' || selected.size > 0;

  return (
    <div className="space-y-4">
      <MenuTrigger>
        <MenuButton isCurrent={hasSelection} aria-label="Sort">
          Sort
        </MenuButton>

        <MenuPopover className="w-[20rem]">
          <Menu selectionMode="single" items={items} selectedKeys={selected} onSelectionChange={setSelected}>
            {(item) => (
              <MenuItem id={item.id} isDisabled={item.id === '1'}>
                {item.label}
              </MenuItem>
            )}
          </Menu>
        </MenuPopover>
      </MenuTrigger>

      <p className="text-sm text-secondary">Selected: {Array.from(selected).join(', ')}</p>
    </div>
  );
};

export const MultipleSelections: Story = {
  render: () => <MultipleSelectionsComponent />
};

const countries = [
  { id: 'ro', label: 'Romania' },
  { id: 'fr', label: 'France' },
  { id: 'it', label: 'Italy' },
  { id: 'es', label: 'Spain' },
  { id: 'de', label: 'Germany' },
  { id: 'us', label: 'United States' },
  { id: 'gb', label: 'United Kingdom' },
  { id: 'ca', label: 'Canada' },
  { id: 'au', label: 'Australia' },
  { id: 'nz', label: 'New Zealand' },
  { id: 'mx', label: 'Mexico' }
];

const MultipleSelectionsComponent = () => {
  let [selected, setSelected] = React.useState<Selection>(new Set([]));

  const hasSelection = selected === 'all' || selected.size > 0;

  return (
    <div className="space-y-4">
      <MenuTrigger>
        <MenuButton isCurrent={hasSelection} aria-label="Filter Countries">
          Country
        </MenuButton>

        <MenuPopover>
          <Menu
            selectionMode="multiple"
            items={countries}
            selectedKeys={selected}
            onSelectionChange={setSelected}
            className="w-72"
            scrollAreaClassName="h-[10rem]"
          >
            {(country) => <MenuItem id={country.id}>{country.label}</MenuItem>}
          </Menu>
        </MenuPopover>
      </MenuTrigger>

      <p className="text-sm text-secondary">Selected: {Array.from(selected).join(', ')}</p>
    </div>
  );
};
