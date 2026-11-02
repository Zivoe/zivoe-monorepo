import { type VerificationStatus } from '@zivoe/database/kyc';

// ---------------------------------------------------------------------------
// The verification vocabulary: status sets, the status mapping, the access policy and
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
export const HUMAN_OWNED_STATUSES = [
  'manually_approved',
  'revoked'
] as const satisfies ReadonlyArray<VerificationStatus>;
export type HumanOwnedStatus = (typeof HUMAN_OWNED_STATUSES)[number];

/** A Decision answers "is this person verified"; everything else is "not yet". */
export const DECISION_STATUSES = ['approved', 'declined'] as const satisfies ReadonlyArray<VerificationStatus>;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

/**
 * Non-terminal and waiting on the investor: nothing moves until they come
 * back and finish or resume. The sweep gives these a short horizon — past it
 * they are abandoned, and a returning user is served by `startVerification`, which
 * re-reads Persona before it acts.
 */
export const AWAITING_INVESTOR_STATUSES = [
  'in_progress',
  'expired'
] as const satisfies ReadonlyArray<VerificationStatus>;

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
] as const satisfies ReadonlyArray<VerificationStatus>;

/**
 * Statuses that can still move on their own (Persona or the user acts next).
 * The Reconciliation Sweep and a start only ever re-read these.
 * Derived from the two halves above so a new status cannot be added to one
 * and silently left out of here.
 */
export const NON_TERMINAL_STATUSES = [
  ...AWAITING_INVESTOR_STATUSES,
  ...AWAITING_PERSONA_STATUSES
] as const satisfies ReadonlyArray<VerificationStatus>;

/**
 * Waiting on Persona's own decisioning, not on a person: `submitted` on the
 * decisioning Workflow, `failed` on the Inquiry Failed Workflow. Past a short
 * threshold nothing is coming: either no Workflow decisions this template or
 * the run failed. That is a defect, and the sweep reports it as one.
 */
export const UNDECIDED_STATUSES = ['submitted', 'failed'] as const satisfies ReadonlyArray<VerificationStatus>;

/**
 * Waiting on a human reviewer. Slow is normal here — a compliance review can
 * legitimately take days — so a long wait is an operations nudge, not an
 * error. `in_progress` and `expired` are in neither set: they wait on the
 * investor and would alarm forever for every abandoned flow.
 */
export const IN_REVIEW_STATUSES = ['pending_review'] as const satisfies ReadonlyArray<VerificationStatus>;

export const isHumanOwned = isOneOf(HUMAN_OWNED_STATUSES);
export const isDecision = isOneOf(DECISION_STATUSES);
export const isNonTerminal = isOneOf(NON_TERMINAL_STATUSES);

/**
 * A yes Decision — what lands `/verification` on the Wallets step and what
 * its writes gate on: Persona's `approved` (an individual's inquiry, an
 * organization's KYB case) or the team's `manually_approved`.
 *
 * Only a yes keeps a Linked address, as only a yes can link one: anything
 * else ends them — a decline, an operator's revocation, a KYB case reopened
 * for review, an operator's resync that hands the user back to a Persona
 * that has not decided.
 */
export const YES_DECISION_STATUSES = [
  'approved',
  'manually_approved'
] as const satisfies ReadonlyArray<VerificationStatus>;

export const isYesDecision = (view: VerificationStatusView) => isOneOf(YES_DECISION_STATUSES)(view.status);

/**
 * Statuses the user is emailed about. `failed` only reaches an organization,
 * for whom it is the end of the road; an individual's is decided by a
 * Workflow seconds later and its decision is what gets the email.
 */
export const VERIFICATION_EMAIL_STATUSES = [
  'approved',
  'declined',
  'pending_review',
  'expired',
  'failed'
] as const satisfies ReadonlyArray<VerificationStatus>;
export type VerificationEmailStatus = (typeof VERIFICATION_EMAIL_STATUSES)[number];
export const isVerificationEmailStatus = isOneOf(VERIFICATION_EMAIL_STATUSES);

/**
 * Statuses operators are pinged about — every lifecycle move worth watching in
 * the Persona channel, not only the ones that demand action. `in_progress`
 * pings come from `startVerification` (create/resume) and from fetch adoptions; the
 * rest are announced by the Status Write Path on transition.
 *
 * `failed` tells operators a failure happened; what follows is the Inquiry
 * Failed Workflow's decision — a review, an approval or a decline — which
 * arrives as its own ping seconds later for the same inquiry.
 */
export const VERIFICATION_OPERATOR_STATUSES = [
  'in_progress',
  'submitted',
  'pending_review',
  'approved',
  'declined',
  'failed'
] as const satisfies ReadonlyArray<VerificationStatus>;
export type VerificationOperatorStatus = (typeof VERIFICATION_OPERATOR_STATUSES)[number];
export const isVerificationOperatorStatus = isOneOf(VERIFICATION_OPERATOR_STATUSES);

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
export const PERSONA_STATUS_TO_VERIFICATION_STATUS = {
  created: 'in_progress',
  pending: 'in_progress',
  completed: 'submitted',
  needs_review: 'pending_review',
  approved: 'approved',
  declined: 'declined',
  failed: 'failed',
  expired: 'expired'
} as const satisfies Record<PersonaInquiryStatus, VerificationStatus>;

export type StartRefusal = 'awaiting_decision' | 'already_verified' | 'declined' | 'revoked' | 'failed';

/**
 * Which flow a user verifies through: the individual KYC inquiry, or the
 * organization's KYB inquiry and case. Follows the profile's account type.
 */
export type InvestorPath = 'individual' | 'organization';

/**
 * The access policy, one row per status: why a user may not begin from this
 * state, or null when they may (by starting or by resuming). The single
 * source both the status view and `startVerification` enforce — exhaustive, so a new
 * status is a compile error here rather than a silent fall-through. An
 * individual's `failed` inquiry is Persona's to decide, never the investor's
 * to retry; an organization's is the end of the road, since no Workflow
 * decides a failed business inquiry — the team takes it from there.
 */
export function refusalFrom(status: VerificationStatus, path: InvestorPath): StartRefusal | null {
  switch (status) {
    case 'not_started':
    case 'in_progress':
    case 'expired':
      return null;
    case 'failed':
      return path === 'organization' ? 'failed' : 'awaiting_decision';
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

export const canResumeFrom = (status: VerificationStatus) => status === 'in_progress' || status === 'expired';

export const canStartFrom = (status: VerificationStatus, path: InvestorPath) =>
  refusalFrom(status, path) === null && !canResumeFrom(status);

/**
 * Which `submitted`/`failed` rows wait on Persona's own decisioning for a
 * path: an individual's failed inquiry is decided by the Inquiry Failed
 * Workflow; an organization's is terminal (see `refusalFrom`), so only its
 * `submitted` waits on the KYB Workflow to open a case.
 */
export const undecidedStatusesFor = (path: InvestorPath): ReadonlyArray<VerificationStatus> =>
  path === 'organization' ? ['submitted'] : UNDECIDED_STATUSES;

// ---------------------------------------------------------------------------
// The KYB case: an organization's review and decision live on a Persona
// case, whose statuses are template-defined strings. Every status of the
// template belongs to exactly one configured set; a status outside all four
// is a new one Persona added, which the write path treats as in review and
// the webhook reports as drift.
// ---------------------------------------------------------------------------

export type KybCaseStatusSets = {
  /** End statuses that mean approved. */
  approved: ReadonlyArray<string>;
  /** End statuses that mean declined. */
  declined: ReadonlyArray<string>;
  /** Intermediate statuses that wait on the organization's own people — owners verifying their identity. */
  people: ReadonlyArray<string>;
  /** The initial and intermediate statuses that wait on the team. */
  team: ReadonlyArray<string>;
};

/** The fixed status mappings for the KYB case template as published on 2026-10-13. */
export const KYB_CASE_STATUS_SETS: KybCaseStatusSets = {
  approved: ['Approved'],
  declined: ['Declined'],
  people: ['Waiting on UBOs'],
  team: ['Open', 'Ready for Review']
};

/** Which set a raw case status falls in; `unknown` for one outside all four. */
export type CaseStatusKind = keyof KybCaseStatusSets | 'unknown';

export function classifyCaseStatus({ status, sets }: { status: string; sets: KybCaseStatusSets }): CaseStatusKind {
  if (sets.approved.includes(status)) return 'approved';
  if (sets.declined.includes(status)) return 'declined';
  if (sets.people.includes(status)) return 'people';
  if (sets.team.includes(status)) return 'team';
  return 'unknown';
}

/** Case status kind → Verification Status: the two decisions, and in review for everything else. */
export const CASE_STATUS_KIND_TO_VERIFICATION_STATUS = {
  approved: 'approved',
  declined: 'declined',
  people: 'pending_review',
  team: 'pending_review',
  unknown: 'pending_review'
} as const satisfies Record<CaseStatusKind, VerificationStatus>;

/** What the card and the page render. */
export type VerificationStatusView = {
  status: VerificationStatus;
  path: InvestorPath;
  canStart: boolean;
  canResume: boolean;
  /** The current inquiry when a resume is possible. */
  inquiryId: string | null;
  /**
   * For an organization in review, who the KYB case waits on: its own people
   * (owners verifying) or the team. Null otherwise, and for every individual.
   */
  caseWaitingOn: 'people' | 'team' | null;
};
