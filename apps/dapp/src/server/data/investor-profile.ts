import 'server-only';

import { eq } from 'drizzle-orm';

import { type AccountType } from '@zivoe/database/onboarding';
import { profile, user } from '@zivoe/database/schema';

import { db } from '@/server/clients/db';

/**
 * What the Investor Profile step shows: the account type chosen at
 * onboarding (locked), the answers an individual may correct, and the
 * sign-in email (locked). Read once per page render; the step's save writes
 * back through `updateInvestorProfile`.
 */
export type InvestorProfile = {
  accountType: AccountType;
  firstName: string;
  lastName: string;
  /** The country's display name, as onboarding stores it — null for an organization. */
  countryOfResidence: string | null;
  email: string;
};

export async function getInvestorProfile({ userId }: { userId: string }): Promise<InvestorProfile | null> {
  const rows = await db
    .select({
      accountType: profile.accountType,
      firstName: profile.firstName,
      lastName: profile.lastName,
      countryOfResidence: profile.countryOfResidence,
      email: user.email
    })
    .from(profile)
    .innerJoin(user, eq(user.id, profile.id))
    .where(eq(profile.id, userId))
    .limit(1);

  return rows[0] ?? null;
}
