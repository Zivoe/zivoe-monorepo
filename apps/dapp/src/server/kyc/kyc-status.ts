import { type KycStatus } from '@zivoe/database/kyc';

// ---------------------------------------------------------------------------
// The KYC vocabulary: status sets, the status mapping, the access policy and
// the status view. Pure — it imports nothing from `@/server` and nothing
// Node-specific — so renderers, routes and the module all share one copy
// and a client tree can never reach the wiring through it.
// ---------------------------------------------------------------------------

/** `includes` that narrows: membership in a literal tuple, as a type guard. */
export const isOneOf =
  <T extends string>(values: ReadonlyArray<T>) =>
  (value: string): value is T =>
    values.some((candidate) => candidate === value);

/** The Status Write Path never overwrites these: only a human sets or clears them. */
export const HUMAN_OWNED_STATUSES = ['manually_approved', 'revoked'] as const satisfies ReadonlyArray<KycStatus>;
export type HumanOwnedStatus = (typeof HUMAN_OWNED_STATUSES)[number];

/** A Decision answers "is this person verified"; everything else is "not yet". */
export const DECISION_STATUSES = ['approved', 'declined'] as const satisfies ReadonlyArray<KycStatus>;

/**
 * Non-terminal and waiting on the investor: nothing moves until they come
 * back and finish or resume. The sweep gives these a short horizon — past it
 * they are abandoned, and a returning user is served by `startKyc`, which
 * re-reads Persona before it acts.
 */
export const AWAITING_INVESTOR_STATUSES = ['in_progress', 'expired'] as const satisfies ReadonlyArray<KycStatus>;

/**
 * Non-terminal and waiting on Persona: a Workflow or a reviewer can move
 * these with no user action at all, so a lost webhook here is invisible until
 * the sweep re-reads. A `failed` record waits on the Inquiry Failed Workflow
 * the same way `submitted` waits on the decisioning one — the investor gets
 * no retry; Persona decides what follows. The sweep treats the two halves
 * differently (see `UNDECIDED_STATUSES` and `IN_REVIEW_STATUSES` below).
 */
export const AWAITING_PERSONA_STATUSES = [
  'submitted',
  'pending_review',
  'failed'
] as const satisfies ReadonlyArray<KycStatus>;

/**
 * Statuses that can still move on their own (Persona or the user acts next).
 * The Reconciliation Sweep and a start only ever re-read these.
 * Derived from the two halves above so a new status cannot be added to one
 * and silently left out of here.
 */
export const NON_TERMINAL_STATUSES = [
  ...AWAITING_INVESTOR_STATUSES,
  ...AWAITING_PERSONA_STATUSES
] as const satisfies ReadonlyArray<KycStatus>;

/**
 * Waiting on Persona's own decisioning, not on a person: `submitted` on the
 * decisioning Workflow, `failed` on the Inquiry Failed Workflow. Past a short
 * threshold nothing is coming: either no Workflow decisions this template or
 * the run failed. That is a defect, and the sweep reports it as one.
 */
export const UNDECIDED_STATUSES = ['submitted', 'failed'] as const satisfies ReadonlyArray<KycStatus>;

/**
 * Waiting on a human reviewer. Slow is normal here — a compliance review can
 * legitimately take days — so a long wait is an operations nudge, not an
 * error. `in_progress` and `expired` are in neither set: they wait on the
 * investor and would alarm forever for every abandoned flow.
 */
export const IN_REVIEW_STATUSES = ['pending_review'] as const satisfies ReadonlyArray<KycStatus>;

export const isHumanOwned = isOneOf(HUMAN_OWNED_STATUSES);
export const isDecision = isOneOf(DECISION_STATUSES);
export const isNonTerminal = isOneOf(NON_TERMINAL_STATUSES);

/** Statuses the user is emailed about. */
export const KYC_EMAIL_STATUSES = [
  'approved',
  'declined',
  'pending_review',
  'expired'
] as const satisfies ReadonlyArray<KycStatus>;
export type KycEmailStatus = (typeof KYC_EMAIL_STATUSES)[number];
export const isKycEmailStatus = isOneOf(KYC_EMAIL_STATUSES);

/**
 * Statuses operators are pinged about — every lifecycle move worth watching in
 * the Persona channel, not only the ones that demand action. `in_progress`
 * pings come from `startKyc` (create/resume) and from fetch adoptions; the
 * rest are announced by the Status Write Path on transition.
 *
 * `failed` tells operators a failure happened; what follows is the Inquiry
 * Failed Workflow's decision — a review, an approval or a decline — which
 * arrives as its own ping seconds later for the same inquiry.
 */
export const KYC_OPERATOR_STATUSES = [
  'in_progress',
  'submitted',
  'pending_review',
  'approved',
  'declined',
  'failed'
] as const satisfies ReadonlyArray<KycStatus>;
export type KycOperatorStatus = (typeof KYC_OPERATOR_STATUSES)[number];
export const isKycOperatorStatus = isOneOf(KYC_OPERATOR_STATUSES);

/** Persona's inquiry statuses — the input side of the status mapping. */
export const PERSONA_INQUIRY_STATUSES = [
  'created',
  'pending',
  'completed',
  'needs_review',
  'approved',
  'declined',
  'failed',
  'expired'
] as const;
export type PersonaInquiryStatus = (typeof PERSONA_INQUIRY_STATUSES)[number];
export const isPersonaInquiryStatus = isOneOf(PERSONA_INQUIRY_STATUSES);

/** Persona inquiry status → Verification Status. `created`/`pending` are both "the user is in the flow". */
export const PERSONA_STATUS_TO_KYC_STATUS = {
  created: 'in_progress',
  pending: 'in_progress',
  completed: 'submitted',
  needs_review: 'pending_review',
  approved: 'approved',
  declined: 'declined',
  failed: 'failed',
  expired: 'expired'
} as const satisfies Record<PersonaInquiryStatus, KycStatus>;

export type StartRefusal = 'awaiting_decision' | 'already_verified' | 'declined' | 'revoked';

/**
 * The access policy, one row per status: why a user may not begin from this
 * state, or null when they may (by starting or by resuming). The single
 * source both the status view and `startKyc` enforce — exhaustive, so a new
 * status is a compile error here rather than a silent fall-through. A
 * `failed` inquiry is Persona's to decide, never the investor's to retry.
 */
export function refusalFrom(status: KycStatus): StartRefusal | null {
  switch (status) {
    case 'not_started':
    case 'in_progress':
    case 'expired':
      return null;
    case 'failed':
    case 'submitted':
    case 'pending_review':
      return 'awaiting_decision';
    case 'approved':
    case 'manually_approved':
      return 'already_verified';
    case 'declined':
      return 'declined';
    case 'revoked':
      return 'revoked';
  }
}

export const canResumeFrom = (status: KycStatus) => status === 'in_progress' || status === 'expired';

export const canStartFrom = (status: KycStatus) => refusalFrom(status) === null && !canResumeFrom(status);

export type InvestorPath = 'individual' | 'organization';

/** What the card and the page render. `organization` accounts never start or resume. */
export type KycStatusView = {
  status: KycStatus;
  path: InvestorPath;
  canStart: boolean;
  canResume: boolean;
  /** The current inquiry when a resume is possible. */
  inquiryId: string | null;
  /** Inquiries the app created for this user so far — informational, never a limit. */
  attemptCount: number;
};
