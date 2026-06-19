import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

import { PROTOCOL_DAILY_SNAPSHOT_TAG } from '@/server/web3';

import { env } from '@/env';

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key');

  if (!apiKey) return NextResponse.json({ error: 'X-API-Key header is required' }, { status: 401 });
  if (apiKey !== env.REVALIDATE_API_KEY) return NextResponse.json({ error: 'Invalid API key' }, { status: 403 });

  revalidateTag(PROTOCOL_DAILY_SNAPSHOT_TAG, { expire: 0 });

  return NextResponse.json({ success: true });
}
