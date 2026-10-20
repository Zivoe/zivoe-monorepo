'use server';

import { headers } from 'next/headers';

import * as Sentry from '@sentry/nextjs';
import { Ratelimit } from '@upstash/ratelimit';
import { type Address, type Hex } from 'viem';
import { z } from 'zod';

import { auth } from '@/server/auth';
import { redis } from '@/server/clients/redis';
import { isKycEnabled } from '@/server/kyc/kyc-flag';
import { walletLink } from '@/server/wallet-link';
import { type CompleteLinkError, type IssueChallengeError } from '@/server/wallet-link/wallet-link';
import { type WalletLinkTypedData } from '@/server/wallet-link/wallet-link-typed-data';
import { type LinkedAddress, toLinkedAddress } from '@/server/wallet-link/wallet-link-view';

import { isActiveChainId } from '@/lib/chains';
import { addressSchema } from '@/lib/schemas';

// The Wallets step's two writes and its one read, in the shape of
// `investor-profile.ts`: session, the `kyc` flag, zod on the input, then the module. Every answer
// is plain data the client maps to copy; a thrown failure is captured here
// and answered as `failed`, so the page never shows a server's words.

export type WalletLinkActionError = {
  code:
    | 'unauthorized'
    | 'invalid_input'
    | 'rate_limited'
    | 'failed'
    | IssueChallengeError['code']
    | CompleteLinkError['code'];
};

export type WalletLinkActionResult<T> = { ok: true; value: T } | { ok: false; error: WalletLinkActionError };

// Trimmed, and a blank one is no name: `''` would print as an empty "Wallet:" line.
const displayString = z
  .string()
  .max(64)
  .regex(/^[^\p{Cc}\p{Zl}\p{Zp}]*$/u)
  .transform((value) => value.trim() || null);

const issueSchema = z.object({
  address: addressSchema,
  // The domain names the chain; a chain this deployment does not serve has nothing to link for.
  chainId: z.number().int().refine(isActiveChainId),
  // Display only: stored as given and shown to ops, escaped. No control
  // characters and no Unicode line or paragraph separators: a line break
  // would let the wallet's name pose as the next field of the operator message.
  walletType: displayString.nullable(),
  walletName: displayString.nullable()
});

// Whole bytes: half a byte is not a signature, yet it would cost an `eth_call`
// and a Sentry warning. No floor: a Safe that signed on-chain hands the dapp
// `0x`, and its contract answers for it. ERC-6492 wraps a counterfactual
// wallet's signature with its deploy data (a few KB); past 20 000 it is not a signature.
const completeSchema = z.object({
  address: addressSchema,
  signature: z
    .string()
    .max(20_000)
    .regex(/^0x(?:[0-9a-fA-F]{2})*$/)
});

/**
 * Per user, across the two writes: an issue costs a Chainalysis call and a
 * row, a completion an RPC verification. A person links a handful of
 * addresses in a sitting; a script does not get to spend the screening budget.
 */
const ratelimit = new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(20, '10 m') });

/** The signed-in user the `kyc` flag is on for — the page's own gate — or null. */
async function authorizedUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;
  return (await isKycEnabled({ user: session.user })) ? session.user.id : null;
}

async function guarded<T>(
  flow: string,
  run: (userId: string) => Promise<WalletLinkActionResult<T>>
): Promise<WalletLinkActionResult<T>> {
  const userId = await authorizedUserId();
  if (!userId) return { ok: false, error: { code: 'unauthorized' } };

  try {
    // A limiter that cannot answer refuses too: Upstash answers a timeout as
    // a success with a reason, and nothing here is worth running unmetered.
    const limit = await ratelimit.limit(`wallet-link:${userId}`);
    if (!limit.success || limit.reason === 'timeout') return { ok: false, error: { code: 'rate_limited' } };

    return await run(userId);
  } catch (error) {
    Sentry.captureException(error, { tags: { source: 'SERVER', flow }, extra: { userId } });
    return { ok: false, error: { code: 'failed' } };
  }
}

/**
 * The step's read: the session's Linked addresses, for the client cache the
 * page seeded. Outside the limiter on purpose — one indexed select, and a
 * refetch must not spend the budget the writes are metered by.
 */
export async function listWalletLinks(): Promise<WalletLinkActionResult<Array<LinkedAddress>>> {
  const userId = await authorizedUserId();
  if (!userId) return { ok: false, error: { code: 'unauthorized' } };

  try {
    return { ok: true, value: (await walletLink.listLinks({ userId })).map(toLinkedAddress) };
  } catch (error) {
    Sentry.captureException(error, { tags: { source: 'SERVER', flow: 'wallet-link-list' }, extra: { userId } });
    return { ok: false, error: { code: 'failed' } };
  }
}

/** Step one of a link: the challenge the wallet signs — the same one again while it is unexpired. */
export async function issueWalletLinkChallenge(input: {
  address: string;
  chainId: number;
  walletType: string | null;
  walletName: string | null;
}): Promise<WalletLinkActionResult<{ linkId: string; typedData: WalletLinkTypedData }>> {
  const parsed = issueSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: 'invalid_input' } };

  return guarded('wallet-link-issue', async (userId) => {
    const result = await walletLink.issueChallenge({
      userId,
      address: parsed.data.address as Address,
      chainId: parsed.data.chainId,
      walletType: parsed.data.walletType,
      walletName: parsed.data.walletName
    });
    return result.ok ? { ok: true, value: result.value } : { ok: false, error: result.error };
  });
}

/** Step two: the signature, verified on chain against the stored challenge. */
export async function completeWalletLink(input: {
  address: string;
  signature: string;
}): Promise<WalletLinkActionResult<LinkedAddress>> {
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: 'invalid_input' } };

  return guarded('wallet-link-complete', async (userId) => {
    const address = parsed.data.address as Address;
    const result = await walletLink.completeLink({ userId, address, signature: parsed.data.signature as Hex });
    if (result.ok) return { ok: true, value: toLinkedAddress(result.value) };
    // The one refusal worth a signal; every other one is the step working. A
    // signature that does not verify is also all a smart wallet hears when
    // its chain's RPC cannot be reached (the verification fails closed), and
    // nothing else would say an investor is stuck there.
    if (result.error.code === 'bad_signature') {
      Sentry.captureMessage('Wallet link refused: signature did not verify', {
        level: 'warning',
        tags: { source: 'SERVER', flow: 'wallet-link-complete' },
        extra: { userId, address }
      });
    }
    return { ok: false, error: result.error };
  });
}
