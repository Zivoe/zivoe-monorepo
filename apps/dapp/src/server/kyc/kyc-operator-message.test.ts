import { describe, expect, it, vi } from 'vitest';

import { createTelegramOperatorMessenger, formatOperatorMessage } from './kyc-operator-message';

// `escapeHtml` lives in @/lib/utils, whose toast import drags in the React runtime.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));

describe('the operator message', () => {
  it('names the move, the user and their email and the inquiry', () => {
    const text = formatOperatorMessage({
      status: 'pending_review',
      userId: 'user-1',
      email: 'ada@example.com',
      inquiryId: 'inq_1'
    });

    expect(text.split('\n')).toEqual([
      '<b>KYC Verification</b>',
      '',
      '<b>Status:</b> Needs manual review',
      '<b>User:</b> user-1',
      '<b>Email:</b> ada@example.com',
      '<b>Inquiry:</b> inq_1'
    ]);
  });

  it('posts to the channel it was wired with', async () => {
    const sendTelegramMessage = vi.fn(async () => ({}));

    await createTelegramOperatorMessenger({ sendTelegramMessage, chatId: 'chat-1' }).send({
      status: 'approved',
      userId: 'user-1',
      email: null,
      inquiryId: 'inq_1'
    });

    expect(sendTelegramMessage).toHaveBeenCalledWith({
      chatId: 'chat-1',
      text: expect.stringContaining('<b>Status:</b> Approved')
    });
  });
});
