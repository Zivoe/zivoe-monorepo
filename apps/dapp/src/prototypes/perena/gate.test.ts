import { describe, expect, it } from 'vitest';

import { isPerenaDemoAllowed } from './gate';

describe('demo environment gate', () => {
  const local = { enabled: 'true', nodeEnv: 'development', publicEnv: 'development' };
  const preview = { ...local, nodeEnv: 'production', vercel: '1', vercelEnv: 'preview' };

  it('allows explicitly enabled local development and Vercel preview builds', () => {
    expect(isPerenaDemoAllowed(local)).toBe(true);
    expect(isPerenaDemoAllowed(preview)).toBe(true);
  });

  it.each([undefined, 'false', '1', 'TRUE', ''])('defaults closed for flag %j', (enabled) => {
    expect(isPerenaDemoAllowed({ ...local, enabled })).toBe(false);
    expect(isPerenaDemoAllowed({ ...preview, enabled })).toBe(false);
  });

  it.each([
    { ...preview, vercelEnv: 'production' },
    { ...preview, publicEnv: 'production' },
    { ...local, publicEnv: 'production' },
    { ...local, vercelEnv: 'production' },
    { ...local, nodeEnv: 'production' },
    { ...preview, vercel: undefined },
    { ...local, vercel: '1', vercelEnv: 'development' },
    { ...local, nodeEnv: 'test' },
    {}
  ])('refuses production and non-preview deployments: %j', (environment) => {
    expect(isPerenaDemoAllowed(environment)).toBe(false);
  });
});
