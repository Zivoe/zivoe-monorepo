import { describe, expect, it } from 'vitest';

import { type AddressMembership, type MembershipVerdict, summarizeMembership } from './wallet-link-membership';

const target = (chain: 'sepolia' | 'base-sepolia') => ({
  chain,
  chainId: chain === 'sepolia' ? 11155111 : 84532,
  shareClassKey: 'zsmb',
  shareTokenAddress: '0x19Dad928674E78665fE172A56Eb721589d7964A6' as const
});

const membership = (verdicts: Array<MembershipVerdict>): AddressMembership =>
  verdicts.map((verdict, index) => ({ target: target(index === 0 ? 'sepolia' : 'base-sepolia'), verdict }));

describe('summarizeMembership', () => {
  it.each([
    ['member everywhere', ['member', 'member'], { status: 'whitelisted', memberOn: 2, total: 2, unknown: 0 }],
    ['member somewhere', ['member', 'not-member'], { status: 'partial', memberOn: 1, total: 2, unknown: 0 }],
    ['member nowhere', ['not-member', 'not-member'], { status: 'pending', memberOn: 0, total: 2, unknown: 0 }],
    ['frozen somewhere', ['member', 'frozen'], { status: 'partial', memberOn: 1, total: 2, unknown: 0 }],
    // A failed read is never a green badge, even with every other chain a member.
    ['one read failed', ['member', 'unknown'], { status: 'unchecked', memberOn: 1, total: 2, unknown: 1 }],
    ['nothing to check', [], { status: 'unchecked', memberOn: 0, total: 0, unknown: 0 }]
  ] as const)('%s', (_label, verdicts, expected) => {
    expect(summarizeMembership(membership([...verdicts]))).toEqual(expected);
  });
});
