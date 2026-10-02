/**
 * Verification Status — the app's own KYC status for a user, distinct from
 * Persona's inquiry status. `not_started` is listed for completeness; the
 * normal way to express it is the absence of a `kyc_verification` row.
 * Human-owned values (`manually_approved`, `revoked`) are only ever set and
 * cleared by an operator.
 */
export const kycStatusValues = [
  'not_started',
  'in_progress',
  'submitted',
  'pending_review',
  'approved',
  'declined',
  'failed',
  'expired',
  'manually_approved',
  'revoked'
] as const;
export type KycStatus = (typeof kycStatusValues)[number];
