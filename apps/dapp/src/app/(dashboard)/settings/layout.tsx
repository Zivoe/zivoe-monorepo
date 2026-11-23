import { type ReactNode, Suspense } from 'react';

import * as Sentry from '@sentry/nextjs';

import { verifyOnboarded } from '@/server/data/auth';
import { organizations } from '@/server/organizations';

import Page from '@/components/page';

import { SettingsNavigation, SettingsNavigationSkeleton } from './_components/settings-navigation';

/**
 * Settings, inside the dashboard: a navigation column (Personal, then the
 * organizations the person belongs to and the invitations waiting for them)
 * beside the page. Signed in only: an emailed unsubscribe link opens
 * `/unsubscribe`, which needs no session. The frame renders at once; the
 * column's reads and the page stream into it, each behind its own skeleton.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    // The grey page the white cards sit on, as in the design. `flow-root` keeps the page margins inside it.
    <div className="flow-root h-full bg-surface-elevated">
      <Page className="items-stretch gap-10">
        <h1 className="text-h5 text-primary lg:text-h4">Settings</h1>

        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
          <Suspense fallback={<SettingsNavigationSkeleton />}>
            <Navigation />
          </Suspense>

          <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
        </div>
      </Page>
    </div>
  );
}

async function Navigation() {
  const { user } = await verifyOnboarded();
  const [memberships, invitations] = await Promise.all([
    organizations.listForUser({ userId: user.id }),
    // Secondary to the page: a failed read leaves the invitations out rather than failing Settings.
    organizations.listForInvitee({ userId: user.id }).catch((error: unknown) => {
      Sentry.captureException(error, { tags: { source: 'SERVER', flow: 'settings-invitations' } });
      return [];
    })
  ]);

  return (
    <SettingsNavigation
      organizations={memberships.map(({ id, name }) => ({ id, name }))}
      invitations={invitations.map(({ id, organizationName }) => ({ id, organizationName }))}
    />
  );
}
