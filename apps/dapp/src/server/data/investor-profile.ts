import 'server-only';

import { eq } from 'drizzle-orm';

import { profile, user } from '@zivoe/database/schema';

import { db } from '@/server/clients/db';

/**
 * What the Account details step shows for a person: the answers they may
 * correct and the sign-in email (locked). Read once per page render; the step's
 * save writes back through `updateInvestorProfile`.
 */
export type InvestorProfile = {
  firstName: string;
  lastName: string;
  /** The country's ISO 3166-1 alpha-2 code, as onboarding stores it. Null for an account carried over from an organization profile. */
  countryOfResidence: string | null;
  email: string;
};

export async function getInvestorProfile({ userId }: { userId: string }): Promise<InvestorProfile | null> {
  const rows = await db
    .select({
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
