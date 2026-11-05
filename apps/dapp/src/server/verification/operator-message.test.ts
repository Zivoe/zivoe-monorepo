import { describe, expect, it, vi } from 'vitest';

import { createTelegramOperatorMessenger, formatOperatorMessage } from './operator-message';

// `escapeHtml` lives in @/lib/utils, whose toast import drags in the React runtime.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));

const LINE = {
  userId: 'user-1',
  email: 'ada@example.com',
  inquiryId: 'inq_1',
  accountType: 'individual',
  case: null
} as const;

describe('the operator message', () => {
  it('names the move, the user and their email and the inquiry', () => {
    const text = formatOperatorMessage({ ...LINE, kind: 'status', status: 'pending_review' });

    expect(text.split('\n')).toEqual([
      '<b>KYC Verification</b>',
      '',
      '<b>Status:</b> Needs manual review',
      '<b>User:</b> user-1',
      '<b>Email:</b> ada@example.com',
      '<b>Inquiry:</b> inq_1'
    ]);
  });

  it("heads an organization's line KYB, calls the review the case it is, and names the case and its raw status", () => {
    const text = formatOperatorMessage({
      ...LINE,
      accountType: 'organization',
      case: { id: 'case_1', status: 'Waiting on UBOs' },
      kind: 'status',
      status: 'pending_review'
    });

    expect(text.split('\n')).toEqual([
      '<b>KYB Verification</b>',
      '',
      '<b>Status:</b> KYB case opened',
      '<b>User:</b> user-1',
      '<b>Email:</b> ada@example.com',
      '<b>Inquiry:</b> inq_1',
      '<b>Case:</b> case_1 (Waiting on UBOs)'
    ]);
  });

  it('writes a raw case move as its own line with the status the record keeps, and calls an organization failure what it is', () => {
    const moved = formatOperatorMessage({
      ...LINE,
      accountType: 'organization',
      case: { id: 'case_1', status: 'Open' },
      kind: 'case_status',
      status: 'approved'
    });
    expect(moved).toContain('<b>Status:</b> Case moved to Open (verification approved)');

    const failed = formatOperatorMessage({ ...LINE, accountType: 'organization', kind: 'status', status: 'failed' });
    expect(failed).toContain('terminal for an organization');
  });

  it('says a reopen took a Decision back, and which one', () => {
    const line = (previousDecision: 'approved' | 'declined') =>
      formatOperatorMessage({
        ...LINE,
        accountType: 'organization',
        case: { id: 'case_1', status: 'Open' },
        kind: 'status',
        status: 'pending_review',
        previousDecision
      });

    expect(line('approved')).toContain('<b>Status:</b> KYB case reopened: the approval no longer stands');
    expect(line('declined')).toContain('<b>Status:</b> KYB case reopened after a decline');
  });

  it('says a reversal took the other Decision back, for either flow', () => {
    const line = (input: { accountType: 'individual' | 'organization'; status: 'approved' | 'declined' }) =>
      formatOperatorMessage({
        ...LINE,
        ...input,
        kind: 'status',
        previousDecision: input.status === 'approved' ? 'declined' : 'approved'
      });

    expect(line({ accountType: 'individual', status: 'declined' })).toContain(
      '<b>Status:</b> Declined: the approval no longer stands'
    );
    expect(line({ accountType: 'organization', status: 'approved' })).toContain(
      '<b>Status:</b> Approved after a decline'
    );
  });

  it('posts to the channel it was wired with', async () => {
    const sendTelegramMessage = vi.fn(async () => ({}));

    await createTelegramOperatorMessenger({ sendTelegramMessage, chatId: 'chat-1' }).send({
      ...LINE,
      email: null,
      kind: 'status',
      status: 'approved'
    });

    expect(sendTelegramMessage).toHaveBeenCalledWith({
      chatId: 'chat-1',
      text: expect.stringContaining('<b>Status:</b> Approved')
    });
  });
});
