import { type Address } from 'viem';

import {
  type CentrifugeChain,
  listLiveChains,
  listShareClassChainIdentities,
  listShareClassKeys
} from '@zivoe/centrifuge-indexer';

import { ACTIVE_CHAINS, ACTIVE_ENVIRONMENT } from '@/lib/chains';

import { type ContractReader, readHookMembership } from '@/centrifuge/reads';

// ---------------------------------------------------------------------------
// Whitelist membership of one address, as a vocabulary: which (chain, share
// class) pairs an address must be a member of, one verdict per pair, and the
// one summary the badge, the count line and the reconcile all read. Pure —
// no `@/server`, no viem client — so the client hook and the server sweep
// share it and can never disagree on what "whitelisted" means.
// ---------------------------------------------------------------------------

/** One share token an address must be admitted to: a live share class on an active chain. */
export type MembershipTarget = {
  chain: CentrifugeChain;
  chainId: number;
  shareClassKey: string;
  shareTokenAddress: Address;
};

/** `unknown` is a read that failed or a hook that could not be interrogated — never a false negative. */
export type MembershipVerdict = 'member' | 'not-member' | 'unknown';

/**
 * One verdict per target, and beside it whether the hook has the address
 * frozen there. The two are independent on the contract: a frozen member is
 * still a member (an unfreeze restores access), so a freeze never hides
 * membership from the count; it is reported on its own. False when the read
 * failed.
 */
export type AddressMembership = Array<{ target: MembershipTarget; verdict: MembershipVerdict; frozen: boolean }>;

/**
 * Every live (chain, share class) pair of this deployment, in catalog order.
 * "Whitelisted" means a member on all of them; a chain the class is only
 * staged on is not asked about, since nothing can be a member there yet.
 */
export function listMembershipTargets(): Array<MembershipTarget> {
  const targets: Array<MembershipTarget> = [];
  for (const key of listShareClassKeys(ACTIVE_ENVIRONMENT)) {
    const liveChains = new Set(listLiveChains({ environment: ACTIVE_ENVIRONMENT, key }));
    for (const chain of ACTIVE_CHAINS) {
      if (!liveChains.has(chain)) continue;
      // Every vault of the class on a chain shares one share token; the first identity names it.
      const [identity] = listShareClassChainIdentities({ chain, key });
      targets.push({
        chain,
        chainId: identity.chainId,
        shareClassKey: key,
        shareTokenAddress: identity.shareTokenAddress
      });
    }
  }
  return targets;
}

/**
 * Every address asked about on every target: one `hook()` read and one
 * multicall per target, whatever the number of addresses, through whichever
 * client the caller has for the chain — wagmi's in the browser, the server's
 * viem clients in the reconcile. A target without a client, or one whose
 * read fails, answers 'unknown' for every address.
 */
export async function readAddressesMembership({
  addresses,
  targets,
  clientFor
}: {
  addresses: ReadonlyArray<Address>;
  targets: Array<MembershipTarget>;
  clientFor: (target: MembershipTarget) => ContractReader | undefined;
}): Promise<Record<Address, AddressMembership>> {
  const unknown = { verdict: 'unknown', frozen: false } as const;
  const byTarget = await Promise.all(
    targets.map(async (target): Promise<Array<Omit<AddressMembership[number], 'target'>>> => {
      const client = clientFor(target);
      if (!client) return addresses.map(() => unknown);
      try {
        const facts = await readHookMembership({
          client,
          shareTokenAddress: target.shareTokenAddress,
          investors: addresses
        });
        return facts.map(({ isFrozen, isMember }) => ({ verdict: isMember ? 'member' : 'not-member', frozen: isFrozen }));
      } catch {
        return addresses.map(() => unknown);
      }
    })
  );

  return Object.fromEntries(
    addresses.map((address, index) => [
      address,
      targets.map((target, targetIndex) => ({ target, ...(byTarget[targetIndex]?.[index] ?? unknown) }))
    ])
  );
}

export type MembershipSummary = {
  /**
   * `whitelisted`: a member everywhere. `partial`: a member somewhere, not
   * everywhere — a hub transaction whose message a destination chain never
   * executed looks like this. `pending`: a member nowhere. `unchecked`: at
   * least one read failed, so nothing can be concluded — never a green badge.
   */
  status: 'whitelisted' | 'partial' | 'pending' | 'unchecked';
  memberOn: number;
  total: number;
  unknown: number;
};

export function summarizeMembership(membership: AddressMembership): MembershipSummary {
  const total = membership.length;
  const memberOn = membership.filter(({ verdict }) => verdict === 'member').length;
  const unknown = membership.filter(({ verdict }) => verdict === 'unknown').length;

  const status: MembershipSummary['status'] =
    total === 0 || unknown > 0
      ? 'unchecked'
      : memberOn === total
        ? 'whitelisted'
        : memberOn > 0
          ? 'partial'
          : 'pending';

  return { status, memberOn, total, unknown };
}
