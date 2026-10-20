import { type Client } from '@upstash/qstash';
import { describe, expect, it } from 'vitest';

import { type WalletLinkJob } from './wallet-link';
import {
  WALLET_LINK_OPERATOR_MESSAGE_PATH,
  WALLET_LINK_WHITELISTED_EMAIL_PATH,
  createQstashWalletLinkOutbox,
  parseWalletLinkJob
} from './wallet-link-outbox';

const BASE_URL = 'https://app.example.com';
const LINK_ID = '7b6f9a1e-0c1d-4e6f-9a2b-3c4d5e6f7a8b';
const AT = new Date('2026-10-01T10:00:00.000Z');

/** Captures what the adapter would publish, without a QStash client. */
function setup() {
  const published: Array<Record<string, unknown>> = [];
  const qstash = {
    publishJSON: async (request: Record<string, unknown>) => {
      published.push(request);
      return { messageId: 'msg_1' };
    }
  } as unknown as Client;

  return { published, outbox: createQstashWalletLinkOutbox({ qstash, baseUrl: BASE_URL }) };
}

const job = (kind: WalletLinkJob['kind']): WalletLinkJob => ({ linkId: LINK_ID, kind, at: AT });

describe('createQstashWalletLinkOutbox', () => {
  it.each([
    ['whitelist_request', WALLET_LINK_OPERATOR_MESSAGE_PATH],
    ['revoke_request', WALLET_LINK_OPERATOR_MESSAGE_PATH],
    ['whitelisted_email', WALLET_LINK_WHITELISTED_EMAIL_PATH]
  ] as const)("publishes a %s job to its channel's route after the settle delay", async (kind, path) => {
    const { published, outbox } = setup();

    await outbox.enqueue(job(kind));

    expect(published[0]).toMatchObject({ url: `${BASE_URL}${path}`, delay: '5s', retries: 3 });
  });

  it('carries the stamp the receiver checks against the row', async () => {
    const { published, outbox } = setup();

    await outbox.enqueue(job('revoke_request'));

    expect(published[0]?.body).toEqual({ linkId: LINK_ID, kind: 'revoke_request', at: AT.toISOString() });
  });
});

describe('the wire contract between the outbox and its receivers', () => {
  it.each([
    [job('whitelist_request'), ['whitelist_request', 'revoke_request']],
    [job('whitelisted_email'), ['whitelisted_email']]
  ] as const)('publishes a body the receiver parses back to the same $kind', async (sent, kinds) => {
    const { published, outbox } = setup();

    await outbox.enqueue(sent);

    expect(parseWalletLinkJob({ kinds, body: published[0]?.body })).toEqual(sent);
  });

  it('refuses a kind the route does not serve, and a body this outbox never produced', () => {
    const body = { linkId: LINK_ID, kind: 'whitelisted_email', at: AT.toISOString() };

    expect(parseWalletLinkJob({ kinds: ['whitelist_request', 'revoke_request'], body })).toBeNull();
    expect(parseWalletLinkJob({ kinds: ['whitelisted_email'], body: { linkId: LINK_ID } })).toBeNull();
  });
});
