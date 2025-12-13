import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

import { DEPOSIT_DAILY_DATA_TAG } from '@/server/web3';

import { env } from '@/env';

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key');

  if (!apiKey) return NextResponse.json({ error: 'X-API-Key header is required' }, { status: 401 });
  if (apiKey !== env.REVALIDATE_API_KEY) return NextResponse.json({ error: 'Invalid API key' }, { status: 403 });

  revalidateTag(DEPOSIT_DAILY_DATA_TAG, { expire: 0 });

  return NextResponse.json({ success: true });
}
