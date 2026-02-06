'use server';

import * as Sentry from '@sentry/nextjs';
import { Ratelimit } from '@upstash/ratelimit';
import { sql } from 'drizzle-orm';
import { isAddress } from 'viem';

import { authDb } from '@/server/clients/auth-db';
import { posthog } from '@/server/clients/posthog';
import { qstash } from '@/server/clients/qstash';
import { redis } from '@/server/clients/redis';
import { walletConnection } from '@/server/db/schema';
import { BASE_URL } from '@/server/utils/base-url';

import { handlePromise } from '@/lib/utils';

import { getUser } from '../data/auth';

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(50, '1 d') // 50 requests per day per user, generous with localStorage caching
});

export async function trackWalletConnection(wallet: { address: string; walletType: string | null }) {
  if (!isAddress(wallet.address)) return { tracked: false };

  const { res: userData, err: sessionErr } = await handlePromise(getUser());
  if (sessionErr || !userData?.user) return { tracked: false };

  const user = userData.user;

  const { res: rateLimitRes, err: rateLimitErr } = await handlePromise(ratelimit.limit(`wallet-track:${user.id}`));
  if (rateLimitErr || !rateLimitRes) {
    Sentry.captureException(rateLimitErr ?? new Error('Failed to check rate limit'), {
      tags: { source: 'SERVER', flow: 'track-wallet-connection' },
      extra: { userId: user.id }
    });

    return { tracked: false };
  }

  if (!rateLimitRes.success) {
    Sentry.captureException(new Error('Wallet tracking rate limit exceeded'), {
      tags: { source: 'SERVER', flow: 'track-wallet-connection' },
      extra: { userId: user.id }
    });

    return { tracked: false };
  }

  const normalizedAddress = wallet.address.toLowerCase();

  const { res, err: dbErr } = await handlePromise(
    authDb
      .insert(walletConnection)
      .values({
        userId: user.id,
        address: normalizedAddress,
        walletType: wallet.walletType
      })
      .onConflictDoUpdate({
        target: [walletConnection.userId, walletConnection.address],
        set: { walletType: wallet.walletType }
      })
      .returning({ isNew: sql<boolean>`xmax = 0` })
  );

  if (dbErr || !res?.[0]) {
    Sentry.captureException(dbErr ?? new Error('Failed to track wallet connection'), {
      tags: { source: 'SERVER', flow: 'track-wallet-connection' },
      extra: { userId: user.id, address: wallet.address }
    });

    return { tracked: false };
  }

  // Wallet already tracked (upsert updated existing row)
  if (!res[0].isNew) return { tracked: true };

  // Fetch initial holdings via background job
  const { err: qstashErr } = await handlePromise(
    qstash.publishJSON({
      url: `${BASE_URL}/api/wallets/fetch-holdings`,
      body: { address: normalizedAddress },
      retries: 2
    })
  );

  if (qstashErr) {
    Sentry.captureException(qstashErr, {
      tags: { source: 'SERVER', flow: 'track-wallet-connection' },
      extra: { userId: user.id, address: normalizedAddress }
    });
  }

  const { err: posthogErr } = await handlePromise(
    posthog.captureImmediate({
      distinctId: user.id,
      event: 'wallet_connected',
      properties: {
        wallet_address: normalizedAddress,
        wallet_type: wallet.walletType
      }
    })
  );

  if (posthogErr) {
    Sentry.captureException(posthogErr, {
      tags: { source: 'SERVER', flow: 'track-wallet-connection' },
      extra: { userId: user.id, address: normalizedAddress }
    });
  }

  return { tracked: true };
}
