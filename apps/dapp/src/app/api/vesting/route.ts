import { type NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { getPonder } from '@/server/clients/ponder';

import { addressSchema } from '@/lib/schemas';
import { ApiError, withErrorHandler } from '@/lib/utils';

import { type ApiResponse } from '../utils';

const querySchema = z.object({
  address: addressSchema
});

export type VestingScheduleData = {
  start: string;
  cliff: string;
  end: string;
  totalVesting: string;
  totalWithdrawn: string;
  vestingPerSecond: string;
  revokable: boolean;
} | null;

const handler = async (req: NextRequest): ApiResponse<VestingScheduleData> => {
  const searchParams = req.nextUrl.searchParams;
  const queryParams = {
    address: searchParams.get('address')
  };

  const parsedQuery = querySchema.safeParse(queryParams);
  if (!parsedQuery.success)
    throw new ApiError({ message: 'Address parameter is required and must be valid', status: 400, capture: false });

  const { address } = parsedQuery.data;
  const ponder = getPonder();

  const schedule = await ponder.query.vestingSchedule.findFirst({
    where: (vestingSchedule, { eq }) => eq(vestingSchedule.id, address)
  });

  if (!schedule) {
    return NextResponse.json({
      success: true,
      data: null
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      start: schedule.start.toString(),
      cliff: schedule.cliff.toString(),
      end: schedule.end.toString(),
      totalVesting: schedule.totalVesting.toString(),
      totalWithdrawn: schedule.totalWithdrawn.toString(),
      vestingPerSecond: schedule.vestingPerSecond.toString(),
      revokable: schedule.revokable
    }
  });
};

export const GET = withErrorHandler('Error fetching vesting schedule', handler);
