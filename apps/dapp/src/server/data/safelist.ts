import 'server-only';

import { eq } from 'drizzle-orm';
import { type Address, getAddress } from 'viem';

import { authDb } from '@/server/clients/auth-db';
import { safelist } from '@/server/db/schema';

export async function isSafelistedAddress(address: Address) {
  const [entry] = await authDb
    .select({ walletAddress: safelist.walletAddress })
    .from(safelist)
    .where(eq(safelist.walletAddress, getAddress(address).toLowerCase()))
    .limit(1);

  return Boolean(entry);
}
