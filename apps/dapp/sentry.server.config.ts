import * as Sentry from '@sentry/nextjs';

// Telegram's API carries the bot token as a URL path segment
// (api.telegram.org/bot<token>/…), so outgoing-request breadcrumbs and
// http.client spans would deliver it to everyone with Sentry read access.
const TELEGRAM_BOT_TOKEN = /\/bot\d+:[\w-]+/g;
const scrub = (value: string) => value.replace(TELEGRAM_BOT_TOKEN, '/bot[redacted]');

// A failed drizzle query is reported with its bound parameters appended to the
// message ("Failed query: …\nparams: …"): for a profile save that is the
// person's name, entity and country. The query text is kept; the values are not.
const QUERY_PARAMS = /\nparams: [\s\S]*$/;
const scrubQueryParams = (value: string) => value.replace(QUERY_PARAMS, '\nparams: [redacted]');

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NEXT_PUBLIC_ENV === 'production',
  sampleRate: 1,
  tracesSampleRate: 0.5,
  enableLogs: true,
  debug: false,
  beforeBreadcrumb(breadcrumb) {
    if (typeof breadcrumb.data?.url === 'string') breadcrumb.data.url = scrub(breadcrumb.data.url);
    if (typeof breadcrumb.message === 'string') breadcrumb.message = scrub(breadcrumb.message);
    return breadcrumb;
  },
  beforeSend(event) {
    for (const exception of event.exception?.values ?? []) {
      if (typeof exception.value === 'string') exception.value = scrubQueryParams(exception.value);
    }
    return event;
  },
  beforeSendTransaction(event) {
    for (const span of event.spans ?? []) {
      if (typeof span.description === 'string') span.description = scrub(span.description);
      for (const [key, value] of Object.entries(span.data ?? {})) {
        if (typeof value === 'string' && span.data) span.data[key] = scrub(value);
      }
    }
    return event;
  }
});
