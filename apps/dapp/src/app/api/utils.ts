import { NextResponse } from 'next/server';

import EthDater from 'ethereum-block-by-date';
import { PublicClient } from 'viem';

export type ApiResponseSuccess<T = void> = { success: true; data?: T };
export type ApiResponseError = { error: string };
export type ApiResponse<T = void> = Promise<NextResponse<ApiResponseSuccess<T> | ApiResponseError>>;

type Block = {
  date: string;
  block: number;
  timestamp: number;
};

export const getLastBlockByDate = async ({ date, client }: { date: Date; client: PublicClient }) => {
  const dater = new EthDater(client);
  const block: Block = await dater.getDate(date, false, false);
  return block;
};

export const getUTCStartOfDay = (date: Date) => {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
};
