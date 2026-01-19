import { NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { CONTRACTS } from '@zivoe/contracts';

import { getDb } from '@/server/clients/db';
import { getWeb3Client } from '@/server/clients/web3';

import { ApiError, getEndOfDayUTC, handlePromise, withErrorHandler } from '@/lib/utils';

import { env } from '@/env';

import { DailyData } from '@/types';

import { ApiResponse } from '../../../utils';
import { collectDailyData } from '../shared';

const BackfillSchema = z.object({
  startDate: z.string().date(),
  endDate: z.string().date()
});

type BackfillResult = {
  daysProcessed: number;
  startDate: string;
  endDate: string;
};

const handler = async (req: NextRequest): ApiResponse<BackfillResult> => {
  // Validate API key
  const apiKey = req.headers.get('X-API-Key');

  if (!apiKey) {
    throw new ApiError({ message: 'X-API-Key header is required', status: 401, capture: false });
  }

  if (apiKey !== env.ZIVOE_API_KEY) {
    throw new ApiError({ message: 'Invalid API key', status: 403, capture: false });
  }

  // Parse and validate body
  const bodyRes = await handlePromise(req.json());
  if (bodyRes.err || !bodyRes.res) {
    throw new ApiError({ message: 'Invalid or empty JSON body', status: 400, capture: false });
  }

  const parseResult = BackfillSchema.safeParse(bodyRes.res);
  if (!parseResult.success) {
    throw new ApiError({
      message: `Validation error: ${parseResult.error.errors.map((e) => e.message).join(', ')}`,
      status: 400,
      capture: false
    });
  }

  const { startDate, endDate } = parseResult.data;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    throw new ApiError({ message: 'endDate must be >= startDate', status: 400, capture: false });
  }

  // Prevent backfilling current or future dates
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (end >= today) {
    throw new ApiError({
      message: 'Cannot backfill current or future dates',
      status: 400,
      capture: false
    });
  }

  const client = getWeb3Client();
  const db = getDb();

  // Build array of dates to process
  const datesToProcess: Date[] = [];
  const currentDate = new Date(start);
  while (currentDate <= end) {
    datesToProcess.push(new Date(currentDate));
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  // Process in batches of 30 for parallel execution
  const BATCH_SIZE = 30;
  const dailyDataArray: DailyData[] = [];

  for (let i = 0; i < datesToProcess.length; i += BATCH_SIZE) {
    const batch = datesToProcess.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((date) => {
        const nextDayMidnight = new Date(date);
        nextDayMidnight.setUTCDate(nextDayMidnight.getUTCDate() + 1);
        nextDayMidnight.setUTCHours(0, 0, 0, 0);

        return collectDailyData({
          client,
          contracts: CONTRACTS,
          blockTimestamp: nextDayMidnight,
          recordTimestamp: getEndOfDayUTC(date)
        });
      })
    );
    dailyDataArray.push(...batchResults);
  }

  // Idempotent storage with bulkWrite
  if (dailyDataArray.length > 0) {
    const operations = dailyDataArray.map((data) => ({
      updateOne: {
        filter: { timestamp: data.timestamp },
        update: { $set: data },
        upsert: true
      }
    }));

    const bulkWriteRes = await handlePromise(db.daily.bulkWrite(operations));
    if (bulkWriteRes.err) {
      throw new ApiError({
        message: 'Failed to write daily data',
        status: 500,
        exception: bulkWriteRes.err
      });
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      daysProcessed: dailyDataArray.length,
      startDate,
      endDate
    }
  });
};

export const POST = withErrorHandler('Error during daily data backfill', handler);
