import { type ReactNode } from 'react';

import * as Sentry from '@sentry/nextjs';

import { verifyOnboarded } from '@/server/data/auth';
import { organizations } from '@/server/organizations';
import { isKycEnabled } from '@/server/verification/kyc-flag';

import Page from '@/components/page';

import { SettingsNavigation } from './_components/settings-navigation';

/**
 * Settings, inside the dashboard: a navigation column (Personal, then the
 * organizations the person belongs to and the invitations waiting for them)
 * beside the page. Organizations come with verification, so that section shows
 * only with the `kyc` flag on. Signed in only: an emailed unsubscribe link opens
 * `/unsubscribe`, which needs no session.
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const { user } = await verifyOnboarded();
  const showOrganizations = await isKycEnabled({ user });
  const [memberships, invitations] = showOrganizations
    ? await Promise.all([
        organizations.listForUser({ userId: user.id }),
        // Secondary to the page: a failed read leaves the invitations out rather than failing Settings.
        organizations.listForInvitee({ userId: user.id }).catch((error: unknown) => {
          Sentry.captureException(error, { tags: { source: 'SERVER', flow: 'settings-invitations' } });
          return [];
        })
      ])
    : [[], []];

  return (
    // The grey page the white cards sit on, as in the design. `flow-root` keeps the page margins inside it.
    <div className="flow-root h-full bg-surface-elevated">
      <Page className="items-stretch gap-10">
        <h1 className="text-h5 text-primary lg:text-h4">Settings</h1>

        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
          <SettingsNavigation
            showOrganizations={showOrganizations}
            organizations={memberships.map(({ id, name }) => ({ id, name }))}
            invitations={invitations.map(({ id, organizationName }) => ({ id, organizationName }))}
          />

          <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
        </div>
      </Page>
    </div>
  );
}
