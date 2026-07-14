import { type NextRequest, NextResponse } from 'next/server';

import { depositsMonitor, readQstashRunMeta, runTransactionMonitor } from '@/server/monitor';

import { withQstashSignature } from '@/lib/qstash';
import { withErrorHandler } from '@/lib/utils';

export const maxDuration = 60; // seconds

export const POST = withQstashSignature(
  withErrorHandler('Error processing deposit notifications', async (req: NextRequest) => {
    const summary = await runTransactionMonitor(depositsMonitor, readQstashRunMeta(req.headers));
    return NextResponse.json({ success: true, data: summary });
  })
);
