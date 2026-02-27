import 'server-only';

import { env } from '@/env';

const TELEGRAM_MAX_LENGTH = 4096;

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
    })
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
  items: string[];
  separator?: string;
}) {
  if (items.length === 0) return;

  const chunks: string[] = [];
  let current = '';

  for (const item of items) {
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
