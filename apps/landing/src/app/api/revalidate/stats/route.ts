import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

import { env } from '@/env';

// Legacy cron-driven invalidation target; landing stats now use time-based
// revalidation (30s for current metrics — see server/centrifuge.ts). Kept
// inert until the daily-snapshot producer teardown.
const PROTOCOL_DAILY_SNAPSHOT_TAG = 'protocol-daily-snapshot';

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key');

  if (!apiKey) return NextResponse.json({ error: 'X-API-Key header is required' }, { status: 401 });
  if (apiKey !== env.REVALIDATE_API_KEY) return NextResponse.json({ error: 'Invalid API key' }, { status: 403 });

  revalidateTag(PROTOCOL_DAILY_SNAPSHOT_TAG, { expire: 0 });

  return NextResponse.json({ success: true });
}
