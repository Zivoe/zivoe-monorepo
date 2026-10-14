import 'server-only';

import { eq } from 'drizzle-orm';
import { getAddress, isAddress } from 'viem';
import { z } from 'zod';

import { type AccountType, type AmountOfInterest } from '@zivoe/database/onboarding';
import { profile, user } from '@zivoe/database/schema';

import { db } from '@/server/clients/db';
import { qstash } from '@/server/clients/qstash';
import { redis } from '@/server/clients/redis';
import { getWalletAddressesForUser } from '@/server/data/wallets';
import { BASE_URL } from '@/server/utils/base-url';
import { sendTelegramMessage } from '@/server/utils/send-telegram';

import { INDIVIDUAL_AMOUNT_OPTIONS, ORG_AMOUNT_OPTIONS } from '@/lib/onboarding-options';
import { QSTASH_JOB_LABELS, getQstashFailureCallback } from '@/lib/qstash';
import { addressSchema } from '@/lib/schemas';
import { escapeHtml } from '@/lib/utils';

import { env } from '@/env';

// The Telegram alert for a wallet Chainalysis flags. The assessment route
// queues it (`enqueueChainalysisAlert`); the QStash receiver at
// `CHAINALYSIS_ALERT_PATH` sends it (`deliverChainalysisAlert`). A send that
// keeps failing lands in the DLQ, and the failure callback reports it to Sentry.
// No idempotency guard on the send: a Telegram call that times out after
// delivering is retried and posts twice. Rare, and a duplicate beats a miss.

export const CHAINALYSIS_ALERT_PATH = '/api/telegram/chainalysis';

/** Every page load re-screens a connected wallet, so an alert stays quiet this long for the same wallet, user and risk. */
const ALERT_WINDOW_SECONDS = 24 * 60 * 60;
const MAX_OTHER_WALLETS = 5;

export const chainalysisAlertJobSchema = z.object({
  userId: z.string().uuid(),
  address: addressSchema,
  risk: z.enum(['High', 'Severe']),
  riskReason: z.string().nullable()
});

export type ChainalysisAlertJob = z.infer<typeof chainalysisAlertJobSchema>;

/**
 * Queues the alert unless this wallet, user and risk already alerted in the
 * last 24 hours. Another account on the same wallet, or a different risk,
 * alerts again. Throws when Redis or QStash fails; the claim is kept either
 * way, since a publish that errored may still have queued the job.
 */
export async function enqueueChainalysisAlert(job: ChainalysisAlertJob): Promise<'queued' | 'already_alerted'> {
  const key = `chainalysis:alerted:${job.address.toLowerCase()}:${job.userId}:${job.risk}`;

  const claimed = await redis.set(key, '1', { nx: true, ex: ALERT_WINDOW_SECONDS });
  if (claimed === null) return 'already_alerted';

  await qstash.publishJSON({
    url: `${BASE_URL}${CHAINALYSIS_ALERT_PATH}`,
    body: job,
    retries: 3,
    failureCallback: getQstashFailureCallback(BASE_URL),
    label: QSTASH_JOB_LABELS.telegramChainalysis
  });

  return 'queued';
}

/** Sends a queued alert, naming who connected the wallet. Throws when the read or the send fails, so QStash retries. */
export async function deliverChainalysisAlert(job: ChainalysisAlertJob) {
  const [person] = await db
    .select({
      email: user.email,
      name: user.name,
      accountType: profile.accountType,
      firstName: profile.firstName,
      lastName: profile.lastName,
      entityName: profile.entityName,
      countryOfResidence: profile.countryOfResidence,
      countryOfIncorporation: profile.countryOfIncorporation,
      amountOfInterest: profile.amountOfInterest
    })
    .from(user)
    .leftJoin(profile, eq(profile.id, user.id))
    .where(eq(user.id, job.userId))
    .limit(1);

  const wallets = await getWalletAddressesForUser(job.userId);
  const otherWallets = wallets
    .filter((wallet) => wallet !== job.address.toLowerCase())
    // Checksummed like the flagged one; a malformed row is shown as stored rather than failing the alert.
    .map((wallet) => (isAddress(wallet) ? getAddress(wallet) : wallet));

  await sendTelegramMessage({
    chatId: env.TELEGRAM_CHAINALYSIS_CHAT_ID,
    text: formatChainalysisAlert({ job, person: person ?? null, otherWallets })
  });
}

type AlertPerson = {
  email: string;
  name: string;
  accountType: AccountType | null;
  firstName: string | null;
  lastName: string | null;
  entityName: string | null;
  countryOfResidence: string | null;
  countryOfIncorporation: string | null;
  amountOfInterest: AmountOfInterest | null;
};

const AMOUNT_LABELS: Record<AmountOfInterest, string> = { ...INDIVIDUAL_AMOUNT_OPTIONS, ...ORG_AMOUNT_OPTIONS };

/** The message ops reads: risk, who connected the wallet, and their other wallets. */
export function formatChainalysisAlert({
  job,
  person,
  otherWallets
}: {
  job: ChainalysisAlertJob;
  person: AlertPerson | null;
  otherWallets: Array<string>;
}): string {
  const lines = [
    `🚩 <b>Chainalysis: ${escapeHtml(job.risk)} risk</b>`,
    `<b>Reason:</b> ${escapeHtml(job.riskReason ?? 'None given')}`
  ];

  if (person) {
    const name = [person.firstName, person.lastName].filter(Boolean).join(' ') || person.name;
    lines.push(`<b>Who:</b> ${escapeHtml(name)} · ${escapeHtml(person.email)}`);

    const details =
      person.accountType === 'organization'
        ? ['Organization', person.entityName, person.countryOfIncorporation]
        : person.accountType === 'individual'
          ? ['Individual', person.countryOfResidence]
          : [];
    if (person.amountOfInterest) details.push(AMOUNT_LABELS[person.amountOfInterest]);

    const profileLine = details.filter(Boolean).join(' · ');
    if (profileLine) lines.push(`<b>Profile:</b> ${escapeHtml(profileLine)}`);
  } else {
    lines.push('<b>Who:</b> Account not found');
  }

  lines.push(`<b>Wallet:</b> <code>${escapeHtml(job.address)}</code>`);

  if (otherWallets.length > 0) {
    const shown = otherWallets.slice(0, MAX_OTHER_WALLETS).map((wallet) => `<code>${escapeHtml(wallet)}</code>`);
    const more = otherWallets.length - shown.length;
    lines.push(`<b>Other wallets:</b> ${shown.join(', ')}${more > 0 ? ` and ${more} more` : ''}`);
  }

  return lines.join('\n');
}
