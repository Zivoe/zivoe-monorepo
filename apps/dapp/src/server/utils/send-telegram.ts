import 'server-only';

import { env } from '@/env';

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
