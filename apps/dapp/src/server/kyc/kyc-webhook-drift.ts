import { type PersonaApi, type PersonaApiError, type PersonaWebhookConfig } from './kyc-verification';

// ---------------------------------------------------------------------------
// The Drift check. `PERSONA_SUBSCRIBED_EVENTS` is enforced only after a
// delivery arrives, so it can only ever catch drift in one direction —
// Persona sending something unexpected. The other direction is silence: a
// webhook disabled, narrowed, or pointed elsewhere in the dashboard produces
// no event to alert on. This check, run daily against Persona's registered
// configuration, is what sees the silence. The diff is pure; the factory
// below owns the two Persona reads and what each failure means.
// ---------------------------------------------------------------------------

/** Host case and a trailing slash are not drift; a different host or path is. */
function sameEndpoint(a: string, b: string) {
  const normalize = (url: string) => {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname.replace(/\/+$/, '')}${parsed.search}`;
    } catch {
      return url;
    }
  };
  return normalize(a) === normalize(b);
}

/** The relationships the webhook parser reads from every delivery. */
const PARSED_RELATIONSHIPS = ['account', 'inquiry-template', 'inquiry-template-version'];

/**
 * Human-readable findings, empty when the dashboard matches expectations.
 * Compared per endpoint URL: other webhooks in the environment (other apps,
 * other tools) are none of this check's business.
 */
export function diffPersonaWebhookConfig({
  webhooks,
  endpointUrl,
  expectedEvents,
  expectedApiVersion
}: {
  webhooks: Array<PersonaWebhookConfig>;
  endpointUrl: string;
  expectedEvents: ReadonlySet<string>;
  expectedApiVersion: string;
}): Array<string> {
  const matching = webhooks.filter((webhook) => sameEndpoint(webhook.url, endpointUrl));
  if (matching.length === 0) return [`no webhook is registered for ${endpointUrl}`];

  const findings: Array<string> = [];
  if (matching.length > 1) {
    findings.push(`${matching.length} webhooks point at ${endpointUrl}; every event arrives once per webhook`);
  }

  for (const webhook of matching) {
    const name = `webhook ${webhook.id}`;

    if (webhook.status !== 'enabled') findings.push(`${name} is ${webhook.status}, not enabled`);
    if (webhook.apiVersion !== expectedApiVersion) {
      findings.push(
        `${name} is pinned to API version ${webhook.apiVersion ?? 'unknown'}; the adapter speaks ${expectedApiVersion}`
      );
    }

    // The payload shape the parser reads. Any other inflection makes every
    // delivery unparseable, which the route acknowledges with a 200 — so
    // Persona never retries and nothing else would notice.
    if (webhook.keyInflection && webhook.keyInflection !== 'kebab') {
      findings.push(`${name} sends ${webhook.keyInflection} keys; the parser reads kebab-case`);
    }
    const relationships = webhook.relationshipAllowlist ?? 'include_all';
    const withheld =
      relationships === 'include_all'
        ? []
        : PARSED_RELATIONSHIPS.filter((relationship) => !relationships.includes(relationship));
    if (withheld.length > 0) {
      findings.push(`${name} withholds the ${withheld.join(', ')} relationship the parser reads`);
    }
    // Identity data stays in Persona: see docs/runbooks/persona-webhook-attribute-blocklist.md.
    if (webhook.attributeBlocklist.length === 0) {
      findings.push(`${name} has no attribute blocklist; every delivery carries the investor's identity fields`);
    }

    if (webhook.enabledEvents.includes('*')) {
      findings.push(`${name} subscribes to every event ('*') instead of exactly the handled set`);
      continue;
    }
    const enabled = new Set(webhook.enabledEvents);
    const missing = [...expectedEvents].filter((event) => !enabled.has(event));
    const extra = webhook.enabledEvents.filter((event) => !expectedEvents.has(event));
    if (missing.length > 0) {
      findings.push(`${name} is missing ${missing.join(', ')} — those transitions never arrive`);
    }
    if (extra.length > 0) {
      findings.push(`${name} also delivers ${extra.join(', ')} — the route drops them as unsubscribed`);
    }
  }

  return findings;
}

export type DriftReport = {
  /** The endpoint the check expected the dashboard to point at. */
  endpointUrl: string;
  /** False when Persona could not be read at all: not drift, and nothing was compared. */
  reachable: boolean;
  /** Why, when `reachable` is false. */
  unavailable?: PersonaApiError;
  /** True when the template's latest published version was read and compared against the pin. */
  templateChecked: boolean;
  /** Why the template was not compared although an id was configured: the read failed. Not drift. */
  templateUnavailable?: PersonaApiError;
  findings: Array<string>;
};

/**
 * The Drift check over the Persona port: what the dashboard must have
 * registered for the endpoint, and the template version the app pins. One
 * `check` is two Persona reads; the caller turns the report into alerts.
 */
export function createPersonaDriftCheck({
  persona,
  config: { endpointUrl, expectedEvents, expectedApiVersion, templateVersionId, templateId }
}: {
  persona: Pick<PersonaApi, 'listWebhooks' | 'latestPublishedVersion'>;
  config: {
    endpointUrl: string;
    expectedEvents: ReadonlySet<string>;
    expectedApiVersion: string;
    /** The version the app creates inquiries on; a newer published one is a finding. */
    templateVersionId: string;
    /** The template that version belongs to (`itmpl_…`). Without it the template is not checked. */
    templateId?: string;
  };
}): { check(): Promise<DriftReport> } {
  return {
    async check() {
      // Persona being unreachable is its own condition, not drift; the next run tries again.
      const listed = await persona.listWebhooks();
      if (!listed.ok) {
        return { endpointUrl, reachable: false, unavailable: listed.error, templateChecked: false, findings: [] };
      }

      const findings = diffPersonaWebhookConfig({
        webhooks: listed.value,
        endpointUrl,
        expectedEvents,
        expectedApiVersion
      });

      // The app pins a template version, so a publish in the dashboard changes
      // nothing until someone bumps the pin — and nothing said a newer version
      // existed. Persona does not expose templates to sandbox keys; a failed
      // read is reported as "not checked", never as drift.
      if (!templateId) return { endpointUrl, reachable: true, templateChecked: false, findings };
      const latest = await persona.latestPublishedVersion({ templateId });
      if (!latest.ok) {
        return { endpointUrl, reachable: true, templateChecked: false, templateUnavailable: latest.error, findings };
      }
      if (latest.value && latest.value !== templateVersionId) {
        findings.push(
          `template ${templateId} has a newer published version ${latest.value}; the app is pinned to ${templateVersionId}`
        );
      }
      return { endpointUrl, reachable: true, templateChecked: true, findings };
    }
  };
}
