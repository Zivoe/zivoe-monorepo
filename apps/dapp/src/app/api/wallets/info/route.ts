import { NextRequest, NextResponse } from 'next/server';

import { eq } from 'drizzle-orm';

import { authDb } from '@/server/clients/auth-db';
import { profile, user, walletConnection, walletHoldings } from '@/server/db/schema';

import { ApiError, roundTo4, withErrorHandler } from '@/lib/utils';

import { env } from '@/env';

import { type ApiResponse } from '../../utils';

type WalletInfo = {
  address: string;
  walletType: string | null;
  createdAt: Date;
};

type UserData = {
  userId: string;
  userEmail: string;
  userName: string | null;
  totalValueUSD: number;
  tokenBalanceUSD: number;
  defiBalanceUSD: number;
  holdingsUpdatedAt: Date | null;
  walletCount: number;
  wallets: WalletInfo[];
};

type WalletsResponse = {
  totalUsers: number;
  totalWallets: number;
  totalValueUSD: number;
  users: UserData[];
};

const handler = async (req: NextRequest): ApiResponse<WalletsResponse> => {
  const apiKey = req.headers.get('X-API-Key');

  if (!apiKey) {
    throw new ApiError({ message: 'X-API-Key header is required', status: 401, capture: false });
  }

  if (apiKey !== env.ZIVOE_API_KEY) {
    throw new ApiError({ message: 'Invalid API key', status: 403, capture: false });
  }

  const wallets = await authDb
    .select({
      address: walletConnection.address,
      walletType: walletConnection.walletType,
      userId: walletConnection.userId,
      userEmail: user.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      createdAt: walletConnection.createdAt,
      totalValueUsd: walletHoldings.totalValueUsd,
      tokenBalanceUsd: walletHoldings.tokenBalanceUsd,
      defiBalanceUsd: walletHoldings.defiBalanceUsd,
      holdingsUpdatedAt: walletHoldings.holdingsUpdatedAt
    })
    .from(walletConnection)
    .innerJoin(user, eq(walletConnection.userId, user.id))
    .leftJoin(profile, eq(user.id, profile.id))
    .leftJoin(walletHoldings, eq(walletConnection.address, walletHoldings.address));

  // Group wallets by userId and track unique address holdings
  const userMap = new Map<string, UserData>();
  const uniqueAddressHoldings = new Map<string, number>();
  let totalValueUSD = 0;

  for (const w of wallets) {
    if (!userMap.has(w.userId)) {
      userMap.set(w.userId, {
        userId: w.userId,
        userEmail: w.userEmail,
        userName: [w.firstName, w.lastName].filter(Boolean).join(' ') || null,
        totalValueUSD: 0,
        tokenBalanceUSD: 0,
        defiBalanceUSD: 0,
        holdingsUpdatedAt: null,
        walletCount: 0,
        wallets: []
      });
    }

    const userData = userMap.get(w.userId)!;

    // Aggregate holdings
    userData.totalValueUSD = roundTo4(userData.totalValueUSD + (w.totalValueUsd ?? 0));
    userData.tokenBalanceUSD = roundTo4(userData.tokenBalanceUSD + (w.tokenBalanceUsd ?? 0));
    userData.defiBalanceUSD = roundTo4(userData.defiBalanceUSD + (w.defiBalanceUsd ?? 0));
    userData.walletCount++;

    // Track oldest update (stalest data)
    if (w.holdingsUpdatedAt) {
      if (!userData.holdingsUpdatedAt || w.holdingsUpdatedAt < userData.holdingsUpdatedAt) {
        userData.holdingsUpdatedAt = w.holdingsUpdatedAt;
      }
    }

    // Add wallet to list
    userData.wallets.push({
      address: w.address,
      walletType: w.walletType,
      createdAt: w.createdAt
    });

    // Track unique addresses to avoid double-counting when multiple users connect the same wallet
    if (!uniqueAddressHoldings.has(w.address)) {
      uniqueAddressHoldings.set(w.address, w.totalValueUsd ?? 0);
      totalValueUSD = roundTo4(totalValueUSD + (w.totalValueUsd ?? 0));
    }
  }

  const users = [...userMap.values()];

  return NextResponse.json({
    success: true,
    data: {
      totalUsers: users.length,
      totalWallets: uniqueAddressHoldings.size,
      totalValueUSD,
      users
    }
  });
};

export const GET = withErrorHandler('Error fetching wallets', handler);
