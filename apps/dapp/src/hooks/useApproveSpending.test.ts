import { describe, expect, it, vi } from 'vitest';

import { needsAllowanceReset } from './useApproveSpending';

// The module reaches the transaction lifecycle, whose toast import drags in the React runtime.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));

describe('needsAllowanceReset', () => {
  it('resets only a legacy token holding a non-zero allowance — a standard token never signs twice', () => {
    expect(needsAllowanceReset({ approval: 'legacy', allowance: 500_000n })).toBe(true);
    expect(needsAllowanceReset({ approval: 'legacy', allowance: 0n })).toBe(false);
    // An unread allowance never triggers a reset: the flow withholds Approve until it is read.
    expect(needsAllowanceReset({ approval: 'legacy', allowance: undefined })).toBe(false);
    expect(needsAllowanceReset({ approval: undefined, allowance: 500_000n })).toBe(false);
  });
});
