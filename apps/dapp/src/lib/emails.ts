/**
 * Public contact addresses. A leaf module on purpose: copy that a client
 * tree renders needs the address without pulling in `@/lib/utils`, which
 * imports `next/server`, viem, Sentry and the toast runtime behind it.
 */
export const EMAILS = {
  INQUIRE: 'inquire@zivoe.com'
} as const;
