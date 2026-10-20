import 'server-only';

import { Client } from '@upstash/qstash';

import { getChainalysisAssessment } from '@/server/chainalysis/assessment';
import { db } from '@/server/clients/db';
import { kycVerification } from '@/server/kyc';
import { BASE_URL } from '@/server/utils/base-url';
import { sendAddressWhitelistedEmail } from '@/server/utils/send-email';
import { sendTelegramMessage } from '@/server/utils/send-telegram';

import { env } from '@/env';

import { createWalletLink } from './wallet-link';
import { createViemChainPort } from './wallet-link-chain';
import { createTelegramWalletLinkMessenger } from './wallet-link-operator-message';
import { createQstashWalletLinkOutbox } from './wallet-link-outbox';
import { createPostgresWalletLinkStore } from './wallet-link-store';

// The wiring, and only the wiring. Types come from `./wallet-link`, the
// signed message from `./wallet-link-typed-data` and the membership
// vocabulary from `./wallet-link-membership`, so a client tree never reaches
// a module that opens a database connection through them.

/** Same one-quick-retry client as the KYC outbox: a server action should not hang on a queue outage. */
const outboxQstash = new Client({ token: env.QSTASH_TOKEN, retry: { retries: 1, backoff: () => 200 } });

/**
 * The default-wired Wallet link: real adapters, system clock. Pages, actions
 * and routes import this, and it is the only way in. Tests construct their
 * own with the in-memory adapters in wallet-link.fakes.ts.
 */
export const walletLink = createWalletLink({
  store: createPostgresWalletLinkStore({ db }),
  kyc: kycVerification,
  screening: {
    // The same screen the dapp runs on connect (safelist first, then
    // Chainalysis); High or Severe refuses. A screen that cannot be made
    // rejects, and nothing is linked on an unanswered question.
    async assess({ address }) {
      const { risk } = await getChainalysisAssessment({ address });
      return risk === 'High' || risk === 'Severe' ? 'flagged' : 'clear';
    }
  },
  chain: createViemChainPort(),
  outbox: createQstashWalletLinkOutbox({ qstash: outboxQstash, baseUrl: BASE_URL }),
  operatorMessages: createTelegramWalletLinkMessenger({
    sendTelegramMessage,
    chatId: env.TELEGRAM_WALLET_LINK_CHAT_ID
  }),
  whitelistedEmails: {
    async send(input) {
      await sendAddressWhitelistedEmail(input);
    }
  },
  clock: { now: () => new Date() }
});
