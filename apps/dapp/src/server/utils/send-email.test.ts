import { describe, expect, it, vi } from 'vitest';

import { handleIdempotentResult } from './send-email';

// The module reaches @/lib/utils, whose toast import drags in the React runtime.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
// The real client throws at construction without an API key.
vi.mock('resend', () => ({ Resend: class {} }));

describe('handleIdempotentResult', () => {
  it('passes a successful send through', () => {
    expect(handleIdempotentResult({ data: { id: 'email-1' }, error: null })).toEqual({ data: { id: 'email-1' } });
  });

  it('reads a key bound to an earlier request as already sent', () => {
    expect(
      handleIdempotentResult({ data: null, error: { name: 'invalid_idempotent_request', message: 'used' } })
    ).toEqual({ data: null });
  });

  it('throws on a concurrent holder of the key — that request may still fail, so the retry must re-send', () => {
    expect(() =>
      handleIdempotentResult({ data: null, error: { name: 'concurrent_idempotent_requests', message: 'in flight' } })
    ).toThrow('in flight');
  });

  it('throws every other error', () => {
    expect(() => handleIdempotentResult({ data: null, error: { name: 'application_error', message: 'boom' } })).toThrow(
      'boom'
    );
  });
});
