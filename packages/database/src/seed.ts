import { eq } from 'drizzle-orm';
import postgres from 'postgres';

import { AGENT_ACCOUNT } from './agent';
import { createDatabase } from './client';
import { profile, user } from './schema/index';

// Seed the base state the agent sign-in expects: the agent account, already onboarded.
//
//   pnpm --filter @zivoe/database db:seed            create or refresh the agent, onboarded
//   pnpm --filter @zivoe/database db:seed -- --fresh  delete the agent (cascades: profile,
//                                                     sessions, wallets) so the next sign-in
//                                                     runs onboarding from the start
//
// Reads DATABASE_URL from the environment, falling back to packages/database/.env like the
// other db commands; an explicit `DATABASE_URL=… pnpm … db:seed` wins. Only the agent's own
// rows are touched, and the target host is printed before anything is written. Writes go
// through drizzle directly, so the dapp's sign-up side effects (newsletter, reminder,
// analytics) do not fire; those belong to a real sign-in.

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set. Export it or add it to packages/database/.env.');

  const fresh = process.argv.includes('--fresh');
  const connection = postgres(databaseUrl, { prepare: false, max: 1 });
  const db = createDatabase(connection);

  console.log(`Database: ${new URL(databaseUrl).hostname} — ${fresh ? 'deleting' : 'seeding'} ${AGENT_ACCOUNT.email}`);

  try {
    if (fresh) {
      const deleted = await db.delete(user).where(eq(user.email, AGENT_ACCOUNT.email)).returning({ id: user.id });
      console.log(
        deleted.length
          ? 'Agent deleted; the next sign-in creates it again and lands on onboarding.'
          : 'No agent to delete.'
      );
      return;
    }

    const now = new Date();
    const [agent] = await db
      .insert(user)
      .values({ ...AGENT_ACCOUNT, emailVerified: true, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: user.email,
        set: { name: AGENT_ACCOUNT.name, emailVerified: true, updatedAt: now }
      })
      .returning({ id: user.id });
    if (!agent) throw new Error('Upserting the agent user returned no row.');

    // The dapp treats a profile row as "onboarded" (server/data/auth.ts getOnboardedStatus).
    const onboarded = await db
      .insert(profile)
      .values({
        id: agent.id,
        accountType: 'individual',
        firstName: 'Zivoe',
        lastName: 'Agent',
        countryOfResidence: 'US',
        amountOfInterest: '10k_100k',
        howFoundZivoe: 'other'
      })
      .onConflictDoNothing({ target: profile.id })
      .returning({ id: profile.id });
    console.log(onboarded.length ? 'Agent created and onboarded.' : 'Agent already onboarded; user row refreshed.');
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
