import 'server-only';

import { and, eq, isNull } from 'drizzle-orm';

import { organization, organizationMember, walletConnection, walletLink } from '@zivoe/database/schema';

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

/**
 * The addresses linked to the live organizations someone belongs to, lowercase: what they invest
 * through as a member, whoever connected the wallet.
 */
export async function getOrganizationWalletAddressesForUser(userId: string): Promise<Array<string>> {
  const rows = await db
    .select({ address: walletLink.address })
    .from(organizationMember)
    .innerJoin(organization, eq(organization.id, organizationMember.organizationId))
    .innerJoin(walletLink, eq(walletLink.subjectId, organizationMember.organizationId))
    .where(and(eq(organizationMember.userId, userId), eq(walletLink.status, 'linked'), isNull(organization.deletedAt)));
  return rows.map((row) => row.address.toLowerCase());
}
