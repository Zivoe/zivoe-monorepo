// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SettingsNavigation, membersPath } from './settings-navigation';

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings/notifications',
  useRouter: () => ({ push: vi.fn() })
}));
vi.mock('@/components/create-organization-dialog', () => ({ CreateOrganizationDialog: () => null }));

afterEach(cleanup);

describe('SettingsNavigation', () => {
  it('shows the first organization and its Members link on a personal page, with Notifications still current', () => {
    render(
      <SettingsNavigation
        organizations={[
          { id: 'org_first', name: 'Northwind Capital' },
          { id: 'org_second', name: 'Acme Holdings' }
        ]}
        invitations={[]}
      />
    );

    // Each place is rendered twice: the row below `lg` and the column.
    for (const members of screen.getAllByRole('link', { name: 'Members' })) {
      expect(members.getAttribute('href')).toBe(membersPath('org_first'));
      expect(members.getAttribute('aria-current')).toBeNull();
    }
    for (const notifications of screen.getAllByRole('link', { name: 'Notifications' })) {
      expect(notifications.getAttribute('aria-current')).toBe('page');
    }
    expect(screen.getAllByRole('button', { name: /^Organization: Northwind Capital/ })).toHaveLength(2);
  });
});
