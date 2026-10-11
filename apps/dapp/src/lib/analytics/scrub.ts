import type { BeforeSendFn, Properties } from 'posthog-js';

/**
 * The `token` an unsubscribe link carries changes the holder's email preferences, so it
 * never reaches PostHog. `scrubSecretParams` is the `before_send` hook: it strips the token
 * from every URL-valued event property (`$current_url`, `$referrer`, `$session_entry_url`,
 * the `$initial_*` person properties). Session replay keeps the page URL and every request
 * URL inside its own snapshots, where that hook does not look, so the recorder runs
 * `scrubSecretUrl` over them too (instrumentation-client.ts).
 */
export const scrubSecretParams: BeforeSendFn = (event) => {
  if (!event) return event;

  for (const properties of [event.properties, event.$set, event.$set_once]) {
    if (properties) scrubProperties(properties);
  }

  return event;
};

function scrubProperties(properties: Properties) {
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === 'string') properties[key] = scrubSecretUrl(value);
  }
}

/** The URL without its `token` parameter; anything that is not a URL comes back as it is. */
export function scrubSecretUrl(value: string) {
  if (!value.includes('://')) return value;

  try {
    const url = new URL(value);
    // Parsed, so a percent-encoded name (`%74oken`) is caught as well.
    if (!url.searchParams.has('token')) return value;
    url.searchParams.delete('token');
    return url.toString();
  } catch {
    return value;
  }
}
