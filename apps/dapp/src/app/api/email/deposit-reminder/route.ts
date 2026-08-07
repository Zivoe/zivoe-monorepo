import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';

import { listShareClassKeys } from '@zivoe/centrifuge-indexer';

import { qstash } from '@/server/clients/qstash';
import { getUserEmailProfile } from '@/server/data/auth';
import { hasAnyInvestorTransaction } from '@/server/data/centrifuge-investor';
import { isEmailPreferenceEnabled } from '@/server/data/email-preferences';
import { getWalletAddressesForUser } from '@/server/data/wallets';
import { BASE_URL } from '@/server/utils/base-url';
import { sendFirstDepositReminderEmail, sendSecondDepositReminderEmail } from '@/server/utils/send-email';

import { QSTASH_JOB_LABELS, getQstashFailureCallback, withQstashSignature } from '@/lib/qstash';
import { ApiError, handlePromise, withErrorHandler } from '@/lib/utils';

import { env } from '@/env';

const bodySchema = z.object({
  userId: z.string().uuid(),
  reminderNumber: z.union([z.literal(1), z.literal(2)])
});

type Body = z.infer<typeof bodySchema>;

const handler = async (req: NextRequest) => {
  const body = await handlePromise(req.json() as Promise<Body>);
  if (body.err || !body.res) throw new ApiError({ message: 'Request body not found', status: 400, capture: false });

  const parsedBody = bodySchema.safeParse(body.res);
  if (!parsedBody.success) throw new ApiError({ message: 'Invalid request payload', status: 400, capture: false });

  const { userId, reminderNumber } = parsedBody.data;

  // No live share class means nothing to deposit into: skip the reminder
  // outright — nagging during an empty-book cutover window is wrong, and the
  // old behavior (an investor-activity read that threw) just made QStash
  // retry a send that must not happen.
  if (listShareClassKeys(env.NEXT_PUBLIC_NETWORK).length === 0) {
    // Mirrors the profile-not-found branch below: this skip silently ends the
    // user's funnel (reminder 2 is only scheduled from a delivered reminder
    // 1), so it must at least be visible in Sentry.
    Sentry.captureException(new Error('Deposit reminder email skipped: no live share class'), {
      tags: { source: 'API', flow: 'deposit-reminder-email' },
      extra: { userId, reminderNumber }
    });

    return NextResponse.json({ success: true, data: 'No live share class, skipping reminder' });
  }

  const profile = await getUserEmailProfile(userId);

  if (!profile?.createdAt || !profile.accountType) {
    Sentry.captureException(new Error('Deposit reminder email skipped: user/profile not found'), {
      tags: { source: 'API', flow: 'deposit-reminder-email' },
      extra: { userId, reminderNumber }
    });

    return NextResponse.json({ success: true, data: 'User or profile not found, skipping reminder' });
  }

  const wallets = await getWalletAddressesForUser(userId);
  const hasInvestorActivity = await hasAnyInvestorTransaction({ addresses: wallets });
  if (hasInvestorActivity)
    return NextResponse.json({ success: true, data: 'User already has investor activity, skipping reminder' });

  const isProductTipsEnabled = await isEmailPreferenceEnabled({
    userId,
    bucket: 'product_tips'
  });

  if (!isProductTipsEnabled) {
    return NextResponse.json({ success: true, data: 'Product tips disabled, skipping reminder' });
  }

  const sendEmail = reminderNumber === 1 ? sendFirstDepositReminderEmail : sendSecondDepositReminderEmail;

  const { err } = await handlePromise(
    sendEmail({
      to: profile.email,
      name: profile.firstName ?? profile.lastName ?? undefined,
      accountType: profile.accountType,
      userId
    })
  );

  if (err)
    throw new ApiError({ message: 'Failed to send reminder email', status: 500, exception: err, capture: false });

  // Reminder 2 lands 10 days after onboarding: 3 days to reminder 1, then 7 more.
  if (reminderNumber === 1) {
    const { err: scheduleErr } = await handlePromise(
      qstash.publishJSON({
        url: `${BASE_URL}/api/email/deposit-reminder`,
        body: { userId, reminderNumber: 2 },
        delay: '7d',
        retries: 3,
        deduplicationId: `deposit-reminder-10day-${userId}`,
        failureCallback: getQstashFailureCallback(BASE_URL),
        label: QSTASH_JOB_LABELS.emailDepositReminderSecond
      })
    );

    if (scheduleErr) {
      Sentry.captureException(scheduleErr, {
        tags: { source: 'API', flow: 'deposit-reminder-email' },
        extra: { userId, reminderNumber: 2 }
      });
    }
  }

  return NextResponse.json({ success: true, data: `Reminder ${reminderNumber} email sent` });
};

export const POST = withQstashSignature(async (req: NextRequest) => {
  return withErrorHandler('Error sending deposit reminder email', handler)(req);
});
