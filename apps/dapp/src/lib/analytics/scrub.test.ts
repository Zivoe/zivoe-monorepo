import type { CaptureResult } from 'posthog-js';
import { describe, expect, it } from 'vitest';

import { scrubSecretParams, scrubSecretUrl } from './scrub';

const event = (overrides: Partial<CaptureResult>): CaptureResult => ({
  uuid: 'uuid',
  event: '$pageview',
  properties: {},
  ...overrides
});

describe('scrubSecretParams', () => {
  it('strips the unsubscribe token from URL properties and keeps the rest of the URL', () => {
    const scrubbed = scrubSecretParams(
      event({
        properties: {
          $current_url: 'https://app.zivoe.com/unsubscribe?token=abc.def&utm_source=email',
          $session_entry_url: 'https://app.zivoe.com/unsubscribe?token=abc.def',
          $pathname: '/unsubscribe'
        },
        $set_once: { $initial_current_url: 'https://app.zivoe.com/unsubscribe?token=abc.def' }
      })
    );

    expect(scrubbed?.properties).toEqual({
      $current_url: 'https://app.zivoe.com/unsubscribe?utm_source=email',
      $session_entry_url: 'https://app.zivoe.com/unsubscribe',
      $pathname: '/unsubscribe'
    });
    expect(scrubbed?.$set_once).toEqual({ $initial_current_url: 'https://app.zivoe.com/unsubscribe' });
  });

  it('strips a token whose parameter name arrives percent-encoded', () => {
    const scrubbed = scrubSecretParams(
      event({ properties: { $current_url: 'https://app.zivoe.com/unsubscribe?%74oken=abc.def' } })
    );

    expect(scrubbed?.properties).toEqual({ $current_url: 'https://app.zivoe.com/unsubscribe' });
  });

  it('leaves values that are not URLs alone', () => {
    const scrubbed = scrubSecretParams(event({ properties: { note: 'token=abc' } }));

    expect(scrubbed?.properties).toEqual({ note: 'token=abc' });
  });
});

describe('scrubSecretUrl', () => {
  it('cleans a URL the way session replay needs, and leaves other strings as they are', () => {
    expect(scrubSecretUrl('https://app.zivoe.com/unsubscribe?token=abc.def')).toBe('https://app.zivoe.com/unsubscribe');
    expect(scrubSecretUrl('https://app.zivoe.com/portfolio')).toBe('https://app.zivoe.com/portfolio');
    expect(scrubSecretUrl('')).toBe('');
  });
});
