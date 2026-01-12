import { NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';

import { handlePromise } from '@/lib/utils';

function decodeBase64(str: string | undefined): string | undefined {
  if (!str) return undefined;
  try {
    return Buffer.from(str, 'base64').toString('utf-8');
  } catch {
    return undefined;
  }
}

const handler = async (req: NextRequest) => {
  const { res: body, err } = await handlePromise(req.json());

  // Even if JSON parsing fails, log it and return 200
  if (err || !body) {
    Sentry.captureException(new Error('QStash failure callback: failed to parse JSON'), {
      tags: { source: 'SERVER', flow: 'qstash-failure' }
    });

    return NextResponse.json({ success: true, data: 'Failure logged (invalid JSON)' });
  }

  // Extract known fields with optional chaining (no strict schema)
  Sentry.captureException(new Error(`QStash delivery failed: ${body?.url ?? 'unknown'}`), {
    tags: {
      source: 'SERVER',
      flow: 'qstash-failure',
      destinationUrl: body?.url,
      httpStatus: String(body?.status ?? 'unknown')
    },
    extra: {
      status: body?.status,
      retried: body?.retried,
      maxRetries: body?.maxRetries,
      dlqId: body?.dlqId,
      sourceMessageId: body?.sourceMessageId,
      url: body?.url,
      method: body?.method,
      responseBody: decodeBase64(body?.body),
      sourceBody: decodeBase64(body?.sourceBody),
      createdAt: body?.createdAt,
      scheduleId: body?.scheduleId,
      rawPayload: body
    }
  });

  return NextResponse.json({ success: true, data: 'Failure logged' });
};

export const POST = verifySignatureAppRouter(handler);
