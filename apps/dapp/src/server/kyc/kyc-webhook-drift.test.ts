import { describe, expect, it } from 'vitest';

import { type PersonaWebhookConfig } from './kyc-verification';
import { createFakePersonaApi, createManualClock } from './kyc-verification.fakes';
import { createPersonaDriftCheck, diffPersonaWebhookConfig } from './kyc-webhook-drift';

const ENDPOINT = 'https://app.zivoe.com/api/webhooks/persona';
const EXPECTED_EVENTS = new Set(['inquiry.approved', 'inquiry.declined', 'workflow-run.errored']);
const API_VERSION = '2025-12-08';

function webhook(overrides: Partial<PersonaWebhookConfig> = {}): PersonaWebhookConfig {
  return {
    id: 'wbh_1',
    status: 'enabled',
    url: ENDPOINT,
    apiVersion: API_VERSION,
    enabledEvents: [...EXPECTED_EVENTS],
    keyInflection: 'kebab',
    attributeBlocklist: ['/data/attributes/*', '!/data/attributes/status'],
    relationshipAllowlist: 'include_all',
    unreadable: [],
    ...overrides
  };
}

function diff(webhooks: Array<PersonaWebhookConfig>) {
  return diffPersonaWebhookConfig({
    webhooks,
    endpointUrl: ENDPOINT,
    expectedEvents: EXPECTED_EVENTS,
    expectedApiVersion: API_VERSION
  });
}

describe('diffPersonaWebhookConfig', () => {
  it('finds nothing when the registered webhook matches expectations exactly', () => {
    expect(diff([webhook()])).toEqual([]);
  });

  it('names a setting Persona returned in a shape the adapter could not read', () => {
    expect(diff([webhook({ unreadable: ['relationship-allowlist'] })])).toEqual([
      'webhook wbh_1 returned relationship-allowlist in a shape the check cannot read'
    ]);
  });

  it('does not count a trailing slash or host case as a different endpoint', () => {
    expect(diff([webhook({ url: 'https://APP.zivoe.com/api/webhooks/persona/' })])).toEqual([]);
  });

  it('reports a missing registration, and ignores other endpoints in the environment', () => {
    expect(diff([webhook({ url: 'https://other-app.example.com/hooks' })])).toEqual([
      `no webhook is registered for ${ENDPOINT}`
    ]);
  });

  it('reports a disabled webhook — the silence the in-route whitelist can never see', () => {
    expect(diff([webhook({ status: 'disabled' })])).toEqual(['webhook wbh_1 is disabled, not enabled']);
  });

  it('reports missing and extra events by name', () => {
    const findings = diff([webhook({ enabledEvents: ['inquiry.approved', 'inquiry.transitioned'] })]);

    expect(findings).toEqual([
      'webhook wbh_1 is missing inquiry.declined, workflow-run.errored — those transitions never arrive',
      'webhook wbh_1 also delivers inquiry.transitioned — the route drops them as unsubscribed'
    ]);
  });

  it('treats a wildcard subscription as drift rather than as covering everything', () => {
    expect(diff([webhook({ enabledEvents: ['*'] })])).toEqual([
      "webhook wbh_1 subscribes to every event ('*') instead of exactly the handled set"
    ]);
  });

  it('reports an api-version pin the adapter does not speak', () => {
    expect(diff([webhook({ apiVersion: '2023-01-05' })])).toEqual([
      'webhook wbh_1 is pinned to API version 2023-01-05; the adapter speaks 2025-12-08'
    ]);
  });

  it('reports a payload shape the parser cannot read', () => {
    expect(
      diff([webhook({ keyInflection: 'camel', relationshipAllowlist: ['account', 'inquiry-template-version'] })])
    ).toEqual([
      'webhook wbh_1 sends camel keys; the parser reads kebab-case',
      'webhook wbh_1 withholds the inquiry-template relationship the parser reads'
    ]);
  });

  it('reports a webhook that blocks no attributes, and reads unset settings as Persona defaults', () => {
    expect(diff([webhook({ attributeBlocklist: [], keyInflection: null, relationshipAllowlist: null })])).toEqual([
      "webhook wbh_1 has no attribute blocklist; every delivery carries the investor's identity fields"
    ]);
  });

  it('reports duplicate registrations for the endpoint, then diffs each', () => {
    const findings = diff([webhook(), webhook({ id: 'wbh_2', status: 'disabled' })]);

    expect(findings).toEqual([
      `2 webhooks point at ${ENDPOINT}; every event arrives once per webhook`,
      'webhook wbh_2 is disabled, not enabled'
    ]);
  });
});

describe('createPersonaDriftCheck', () => {
  const PINNED = 'itmplv_pinned';
  const UNAVAILABLE = { reason: 'http', message: 'Persona GET failed (403)', httpStatus: 403 } as const;

  function setup({ templateId }: { templateId?: string } = {}) {
    const persona = createFakePersonaApi({ clock: createManualClock(new Date('2026-09-07T08:00:00.000Z')).clock });
    const drift = createPersonaDriftCheck({
      persona: persona.persona,
      config: {
        endpointUrl: ENDPOINT,
        expectedEvents: EXPECTED_EVENTS,
        expectedApiVersion: API_VERSION,
        templateVersionId: PINNED,
        templateId
      }
    });
    return { persona, drift };
  }

  it('reports Persona as unreachable rather than as drift, and does not go on to the template', async () => {
    const { persona, drift } = setup({ templateId: 'itmpl_1' });
    persona.failNextCall(UNAVAILABLE);

    await expect(drift.check()).resolves.toEqual({
      endpointUrl: ENDPOINT,
      reachable: false,
      unavailable: UNAVAILABLE,
      templateChecked: false,
      findings: []
    });
    expect(persona.calls.map((call) => call.method)).toEqual(['listWebhooks']);
  });

  it('finds nothing when the dashboard matches, and leaves the template alone without an id', async () => {
    const { persona, drift } = setup();
    persona.webhooks.push(webhook());

    await expect(drift.check()).resolves.toEqual({
      endpointUrl: ENDPOINT,
      reachable: true,
      templateChecked: false,
      findings: []
    });
    expect(persona.calls.map((call) => call.method)).toEqual(['listWebhooks']);
  });

  it('adds a newer published template version to the webhook findings', async () => {
    const { persona, drift } = setup({ templateId: 'itmpl_1' });
    persona.webhooks.push(webhook({ status: 'disabled' }));
    persona.latestVersions.set('itmpl_1', 'itmplv_newer');

    await expect(drift.check()).resolves.toEqual({
      endpointUrl: ENDPOINT,
      reachable: true,
      templateChecked: true,
      findings: [
        'webhook wbh_1 is disabled, not enabled',
        'template itmpl_1 has a newer published version itmplv_newer; the app is pinned to itmplv_pinned'
      ]
    });
  });

  it('reports a template it could not read as unchecked, never as drift, and keeps the webhook findings', async () => {
    const { persona, drift } = setup({ templateId: 'itmpl_1' });
    persona.webhooks.push(webhook({ enabledEvents: ['*'] }));
    persona.failNextCall(UNAVAILABLE, 'latestPublishedVersion');

    await expect(drift.check()).resolves.toEqual({
      endpointUrl: ENDPOINT,
      reachable: true,
      templateChecked: false,
      templateUnavailable: UNAVAILABLE,
      findings: ["webhook wbh_1 subscribes to every event ('*') instead of exactly the handled set"]
    });
  });

  it('treats a template with nothing published as checked and current', async () => {
    const { persona, drift } = setup({ templateId: 'itmpl_1' });
    persona.webhooks.push(webhook());
    persona.latestVersions.set('itmpl_1', null);

    await expect(drift.check()).resolves.toEqual({
      endpointUrl: ENDPOINT,
      reachable: true,
      templateChecked: true,
      findings: []
    });
  });
});
