import type { BeforeSendFn, Properties } from 'posthog-js';

/**
 * The `token` an unsubscribe link carries changes the holder's email preferences, so it
 * never reaches PostHog. `scrubSecretParams` is the `before_send` hook: it strips the token
 * from every URL in an event's properties, at any depth and in object keys too, since
 * `$web_vitals` nests a copy of the page URL and `$$heatmap` keys its data by URL.
 * Session replay keeps the page URL and every request URL inside its own snapshots; the
 * recorder runs `scrubSecretUrl` over those (instrumentation-client.ts), so the hook skips
 * the large `$snapshot` events.
 */
export const scrubSecretParams: BeforeSendFn = (event) => {
  if (!event || event.event === '$snapshot') return event;

  for (const key of ['properties', '$set', '$set_once'] as const) {
    if (event[key]) event[key] = scrubDeep(event[key]) as Properties;
  }

  return event;
};

function scrubDeep(value: unknown): unknown {
  if (typeof value === 'string') return scrubSecretUrl(value);
  if (Array.isArray(value)) return value.map(scrubDeep);
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [scrubSecretUrl(key), scrubDeep(item)]));
  }
  return value;
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
