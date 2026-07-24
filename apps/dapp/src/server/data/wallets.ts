import 'server-only';

import { eq } from 'drizzle-orm';

import { walletConnection } from '@zivoe/database/schema';

import { db } from '@/server/clients/db';

import { ApiError, handlePromise } from '@/lib/utils';

export async function getWalletAddressesForUser(userId: string): Promise<Array<string>> {
  const { res, err } = await handlePromise(
    db.select({ address: walletConnection.address }).from(walletConnection).where(eq(walletConnection.userId, userId))
  );

  if (err) {
    throw new ApiError({
      message: `Failed to query wallets for user ${userId}`,
      status: 500,
      exception: err
    });
  }

  return (res ?? []).map((wallet) => wallet.address.toLowerCase());
}
