import { NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { count, eq, isNull, lt, or, sql } from 'drizzle-orm';

import { authDb } from '@/server/clients/auth-db';
import { MAX_ACCOUNTS_PER_QUERY, fetchPortfolios } from '@/server/clients/zapper';
import { walletConnection, walletHoldings } from '@/server/db/schema';

import { roundTo4, withErrorHandler } from '@/lib/utils';

import { type ApiResponse } from '../../utils';

type RefreshResult = {
  staleOrMissing: number;
  staleHoldings: number;
  holdingsUpdated: number;
};

const DURATION_WARNING_MS = 45_000; // 45 seconds of Vercel's 60s limit
const FANOUT_THRESHOLD = 300;
const MONITOR_SLUG = 'wallet-holdings-cron';
const STALE_DAYS = 7;

const handler = async (_req: NextRequest): ApiResponse<RefreshResult> => {
  const startTime = Date.now();

  const sentryCheckInId = Sentry.captureCheckIn({
    monitorSlug: MONITOR_SLUG,
    status: 'in_progress'
  });

  try {
    // Only fetch holdings that haven't been updated in STALE_DAYS
    const staleThreshold = sql`now() - ${STALE_DAYS} * interval '1 day'`;
    const [staleHoldingsList, missingHoldingsList, [countResult]] = await Promise.all([
      authDb
        .select({ address: walletHoldings.address })
        .from(walletHoldings)
        .where(or(isNull(walletHoldings.holdingsUpdatedAt), lt(walletHoldings.holdingsUpdatedAt, staleThreshold))),
      authDb
        .select({ address: walletConnection.address })
        .from(walletConnection)
        .leftJoin(walletHoldings, eq(walletConnection.address, walletHoldings.address))
        .where(isNull(walletHoldings.address)),
      authDb.select({ totalCount: count() }).from(walletHoldings)
    ]);
    const totalCount = countResult?.totalCount ?? 0;

    const addressesSet = new Set<string>();
    for (const h of staleHoldingsList) addressesSet.add(h.address);

    const missingAddressesSet = new Set<string>();
    for (const h of missingHoldingsList) missingAddressesSet.add(h.address);
    for (const address of missingAddressesSet) addressesSet.add(address);

    const staleHoldingsCount = staleHoldingsList.length;
    const missingHoldingsCount = missingAddressesSet.size;
    const staleOrMissingCount = addressesSet.size;

    Sentry.addBreadcrumb({
      category: 'start',
      message: `Found ${staleHoldingsCount} stale + ${missingHoldingsCount} missing holdings (of ${totalCount} total)`,
      level: 'info'
    });

    // If no stale or missing holdings, we're done
    if (staleOrMissingCount === 0) {
      Sentry.captureCheckIn({
        checkInId: sentryCheckInId,
        monitorSlug: MONITOR_SLUG,
        status: 'ok'
      });

      Sentry.logger.info(`${MONITOR_SLUG} - no stale holdings`, {
        totalHoldings: totalCount,
        staleHoldings: 0,
        missingHoldings: 0,
        holdingsUpdated: 0,
        durationMs: Date.now() - startTime
      });

      return NextResponse.json({
        success: true,
        data: {
          staleOrMissing: 0,
          staleHoldings: 0,
          holdingsUpdated: 0
        }
      });
    }

    const addresses = [...addressesSet];

    // TODO: When wallet count exceeds FANOUT_THRESHOLD, convert this cron into an orchestrator.
    // Use qstash.batchJSON() to publish all batches in a single HTTP request to /api/monitor/refresh-holdings-batch.
    // Each worker gets its own 60s budget. Stagger with delay param to avoid Zapper rate limits.
    // Cap at ~500 addresses per run (ORDER BY stalest first) to avoid thundering herd.
    if (addresses.length >= FANOUT_THRESHOLD) {
      Sentry.captureException(
        new Error(
          `Holdings count (${addresses.length}) exceeds fan-out threshold (${FANOUT_THRESHOLD}). Implement Upstash fan-out architecture.`
        ),
        {
          tags: { source: 'API', flow: 'wallet-holdings-cron' },
          extra: {
            addresses: addresses.length,
            threshold: FANOUT_THRESHOLD
          }
        }
      );
    }

    let holdingsUpdated = 0;
    let batchErrors = 0;
    const totalBatches = Math.ceil(addresses.length / MAX_ACCOUNTS_PER_QUERY);

    // Process in batches
    for (let i = 0; i < addresses.length; i += MAX_ACCOUNTS_PER_QUERY) {
      const batchIndex = Math.floor(i / MAX_ACCOUNTS_PER_QUERY) + 1;
      const batch = addresses.slice(i, i + MAX_ACCOUNTS_PER_QUERY);

      try {
        Sentry.addBreadcrumb({
          category: 'batch',
          message: `Processing batch ${batchIndex}/${totalBatches}`,
          data: { count: batch.length },
          level: 'info'
        });

        const portfolios = await fetchPortfolios(batch);

        Sentry.addBreadcrumb({
          category: 'zapper',
          message: `Zapper response received for batch ${batchIndex}`,
          data: { portfoliosReturned: portfolios.size },
          level: 'info'
        });

        // Build values for bulk upsert
        const values = [...portfolios.entries()].map(([address, portfolio]) => ({
          address,
          totalValueUsd: roundTo4(portfolio.tokenBalanceUSD + portfolio.appBalanceUSD),
          tokenBalanceUsd: roundTo4(portfolio.tokenBalanceUSD),
          defiBalanceUsd: roundTo4(portfolio.appBalanceUSD),
          holdingsUpdatedAt: sql`now()`
        }));

        if (values.length > 0) {
          await authDb
            .insert(walletHoldings)
            .values(values)
            .onConflictDoUpdate({
              target: walletHoldings.address,
              set: {
                totalValueUsd: sql`excluded.total_value_usd`,
                tokenBalanceUsd: sql`excluded.token_balance_usd`,
                defiBalanceUsd: sql`excluded.defi_balance_usd`,
                holdingsUpdatedAt: sql`now()`
              }
            });
        }

        holdingsUpdated += values.length;
      } catch (batchError) {
        batchErrors++;

        Sentry.captureException(batchError, {
          tags: { source: 'API', flow: 'wallet-holdings-cron' },
          extra: { batchIndex, totalBatches, batchSize: batch.length }
        });
      }

      // Delay between batches to avoid potential Zapper rate limits
      if (i + MAX_ACCOUNTS_PER_QUERY < addresses.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    const durationMs = Date.now() - startTime;

    if (durationMs > DURATION_WARNING_MS) {
      Sentry.captureException(
        new Error(`Holdings refresh duration (${durationMs}ms) exceeded warning threshold (${DURATION_WARNING_MS}ms)`),
        {
          tags: { source: 'API', flow: 'wallet-holdings-cron' },
          extra: {
            durationMs,
            threshold: DURATION_WARNING_MS,
            totalHoldings: totalCount,
            staleHoldings: staleHoldingsCount,
            holdingsUpdated,
            batchErrors,
            totalBatches
          }
        }
      );
    }

    Sentry.logger.info(`${MONITOR_SLUG} completed`, {
      totalHoldings: totalCount,
      staleHoldings: staleHoldingsCount,
      missingHoldings: missingHoldingsCount,
      holdingsUpdated,
      batchErrors,
      durationMs
    });

    Sentry.captureCheckIn({
      checkInId: sentryCheckInId,
      monitorSlug: MONITOR_SLUG,
      status: batchErrors > 0 ? 'error' : 'ok'
    });

    return NextResponse.json({
      success: true,
      data: {
        staleOrMissing: staleOrMissingCount,
        staleHoldings: staleHoldingsCount,
        holdingsUpdated
      }
    });
  } catch (error) {
    Sentry.captureCheckIn({
      checkInId: sentryCheckInId,
      monitorSlug: MONITOR_SLUG,
      status: 'error'
    });

    throw error;
  } finally {
    await Sentry.flush(2000);
  }
};

export const POST = verifySignatureAppRouter(async (req: NextRequest) => {
  return withErrorHandler('Error refreshing wallet holdings', handler)(req);
});
