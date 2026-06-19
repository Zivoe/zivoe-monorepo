import 'server-only';

import { eq } from 'drizzle-orm';
import { type Address, getAddress } from 'viem';

import { safelist } from '@zivoe/database/schema';

import { db } from '@/server/clients/db';

export async function isSafelistedAddress(address: Address) {
  const [entry] = await db
    .select({ walletAddress: safelist.walletAddress })
    .from(safelist)
    .where(eq(safelist.walletAddress, getAddress(address).toLowerCase()))
    .limit(1);

  return Boolean(entry);
}
