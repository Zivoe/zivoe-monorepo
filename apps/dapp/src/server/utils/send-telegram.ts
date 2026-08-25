import 'server-only';

import { env } from '@/env';

const TELEGRAM_MAX_LENGTH = 4096;
/** A hung Telegram request must not run a caller into its function deadline (the tx monitor holds a DB lock meanwhile). */
const TELEGRAM_TIMEOUT_MS = 15_000;

export async function sendTelegramMessage({
  chatId = env.TELEGRAM_ONBOARDING_CHAT_ID,
  text,
  parseMode = 'HTML'
}: {
  chatId?: string;
  text: string;
  parseMode?: 'HTML' | 'MarkdownV2';
}) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode
    }),
    signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }

  return response.json();
}

/**
 * Batches multiple text items into as few Telegram messages as possible,
 * splitting at item boundaries to stay under the 4096 char limit.
 */
export async function sendBatchedTelegramMessages({
  chatId,
  items,
  separator = '\n\n'
}: {
  chatId: string;
  items: Array<string>;
  separator?: string;
}) {
  if (items.length === 0) return;

  // A single oversized item would occupy its own over-limit message and be
  // rejected by Telegram with a permanent 400 — wedging retry loops forever.
  // Truncate at a line boundary: items are line-structured and HTML tags never
  // span lines, so the result stays well-formed for HTML parse mode.
  const bounded = items.map((item) => {
    if (item.length <= TELEGRAM_MAX_LENGTH - 2) return item;
    const cut = item.lastIndexOf('\n', TELEGRAM_MAX_LENGTH - 2);
    return `${item.slice(0, cut > 0 ? cut : TELEGRAM_MAX_LENGTH - 2)}\n…`;
  });

  const chunks: Array<string> = [];
  let current = '';

  for (const item of bounded) {
    const candidate = current ? current + separator + item : item;

    if (candidate.length > TELEGRAM_MAX_LENGTH) {
      if (current) chunks.push(current);
      current = item;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);

  for (const chunk of chunks) {
    await sendTelegramMessage({ chatId, text: chunk, parseMode: 'HTML' });
  }
}
