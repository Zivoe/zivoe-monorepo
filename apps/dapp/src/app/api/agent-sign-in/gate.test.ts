import { describe, expect, it } from 'vitest';

import { isAgentSignInAllowed, isLocalDatabase, toOriginRelative } from './gate';

// Tables over each gate's whole surface: every layer refusing alone, and the exact
// combinations that pass. The default row is the strictest legitimate arrival.
const local = { nodeEnv: 'development', forwardedFor: '127.0.0.1', fetchSite: null };

describe('isAgentSignInAllowed', () => {
  it.each([
    ['a local dev request with no fetch metadata (curl, an agent)', local, true],
    ['an address-bar navigation', { ...local, fetchSite: 'none' }, true],
    ['a link inside the dapp', { ...local, fetchSite: 'same-origin' }, true],
    ['IPv6 loopback', { ...local, forwardedFor: '::1' }, true],
    ['IPv4-mapped loopback from a dual-stack listener', { ...local, forwardedFor: '::ffff:127.0.0.1' }, true],
    ['the uppercase spelling of that mapped form', { ...local, forwardedFor: '::FFFF:127.0.0.1' }, true],
    ['a padded header value', { ...local, forwardedFor: ' 127.0.0.1 ' }, true],

    ['a production build', { ...local, nodeEnv: 'production' }, false],
    ['a test run', { ...local, nodeEnv: 'test' }, false],
    ['an unclassified environment', { ...local, nodeEnv: undefined }, false],
    ['a LAN caller', { ...local, forwardedFor: '192.168.1.5' }, false],
    ['an address the runtime cannot report', { ...local, forwardedFor: null }, false],
    ['a header present but empty', { ...local, forwardedFor: '' }, false],
    ['a routable IPv6 address', { ...local, forwardedFor: '2001:db8::1' }, false],
    ['a forwarded chain, even one claiming loopback', { ...local, forwardedFor: '127.0.0.1, 10.0.0.2' }, false],
    ['a spoofed non-loopback IPv6-ish value', { ...local, forwardedFor: '::2' }, false],
    ['a cross-site navigation', { ...local, fetchSite: 'cross-site' }, false],
    ['a same-site navigation (another app on another localhost port)', { ...local, fetchSite: 'same-site' }, false],
    ['a fetch-site value no spec defines yet', { ...local, fetchSite: 'future-value' }, false]
  ])('%s → %s', (_case, inputs, allowed) => {
    expect(isAgentSignInAllowed(inputs)).toBe(allowed);
  });
});

describe('isLocalDatabase', () => {
  it.each([
    ['the local database this repo runs', 'postgres://zivoe:pw@localhost:5433/zivoe', true],
    ['loopback by address', 'postgres://zivoe:pw@127.0.0.1:5432/zivoe', true],
    ['IPv6 loopback, which URL reports bracketed', 'postgres://zivoe:pw@[::1]:5432/zivoe', true],

    ['a managed database', 'postgres://user:pw@ep-cool-name.eu-central-1.aws.neon.tech/zivoe', false],
    ['a host merely starting with the local one', 'postgres://user:pw@localhost.db.example.com/zivoe', false],
    ['a socket URL naming no host', 'postgres:///zivoe', false],
    ['a value that is not a URL', 'not-a-url', false],
    ['an empty value', '', false]
  ])('%s → %s', (_case, databaseUrl, isLocal) => {
    expect(isLocalDatabase(databaseUrl)).toBe(isLocal);
  });
});

describe('toOriginRelative', () => {
  const requestUrl = 'https://zivoe-dapp-v2-git-feat-zivoe.vercel.app/api/agent-sign-in/tok';

  it.each([
    ['an absolute redirect to another origin', 'https://zivoe-dapp-v2-abc123-zivoe.vercel.app/', '/'],
    [
      'an error redirect, keeping its query',
      'https://app.zivoe.com/sign-in?error=EXPIRED_TOKEN',
      '/sign-in?error=EXPIRED_TOKEN'
    ],
    ['an already relative path', '/dashboard?tab=1', '/dashboard?tab=1']
  ])('%s → %s', (_case, location, expected) => {
    expect(toOriginRelative(location, requestUrl)).toBe(expected);
  });
});
