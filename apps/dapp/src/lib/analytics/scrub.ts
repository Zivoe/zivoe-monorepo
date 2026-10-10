import type { BeforeSendFn, Properties } from 'posthog-js';

/**
 * The `token` an unsubscribe link carries changes the holder's email preferences, so it
 * never reaches PostHog: PostHog's `before_send` hook strips it from every URL-valued
 * property (`$current_url`, `$referrer`, `$session_entry_url`, the `$initial_*` person
 * properties) before an event leaves the browser.
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
    if (typeof value !== 'string' || !value.includes('token=')) continue;

    try {
      const url = new URL(value);
      url.searchParams.delete('token');
      properties[key] = url.toString();
    } catch {
      // Not a URL: leave it as it is.
    }
  }
}
