import { type NextRequest, NextResponse } from 'next/server';

import { readQstashRunMeta, redemptionsMonitor, runTransactionMonitor } from '@/server/monitor';

import { withQstashSignature } from '@/lib/qstash';
import { withErrorHandler } from '@/lib/utils';

export const maxDuration = 60; // seconds

export const POST = withQstashSignature(
  withErrorHandler('Error processing redemption notifications', async (req: NextRequest) => {
    const summary = await runTransactionMonitor(redemptionsMonitor, readQstashRunMeta(req.headers));
    return NextResponse.json({ success: true, data: summary });
  })
);
