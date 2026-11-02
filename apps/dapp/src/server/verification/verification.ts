import { randomUUID } from 'node:crypto';

import { type VerificationStatus, verificationStatusValues } from '@zivoe/database/kyc';
import { type AccountType } from '@zivoe/database/onboarding';

import { type Result, err, ok } from '@/lib/result';

import { type PersonaCase } from './persona-case';
import { parsePersonaWebhookEvent, verifyPersonaSignature } from './persona-webhook';
import {
  AWAITING_INVESTOR_STATUSES,
  CASE_STATUS_KIND_TO_VERIFICATION_STATUS,
  DECISION_STATUSES,
  type DecisionStatus,
  type HumanOwnedStatus,
  IN_REVIEW_STATUSES,
  type InvestorPath,
  type KybCaseStatusSets,
  PERSONA_STATUS_TO_VERIFICATION_STATUS,
  type PersonaInquiryStatus,
  type StartRefusal,
  type VerificationEmailStatus,
  type VerificationOperatorStatus,
  type VerificationStatusView,
  YES_DECISION_STATUSES,
  canResumeFrom,
  canStartFrom,
  classifyCaseStatus,
  isDecision,
  isNonTerminal,
  isOneOf,
  refusalFrom,
  undecidedStatusesFor
} from './verification-status';
import { type SnapshotInput, decide } from './verification-transition';

// ---------------------------------------------------------------------------
// Verification (KYC and KYB) — one module, one external seam, nine operations.
//
// Dependencies are accepted, not created: a store, a Persona API, an outbox,
// the two notification channels and a clock. Production wires Postgres /
// HTTPS / QStash / Resend / Telegram / Date; tests wire the in-memory
// adapters in verification.fakes.ts and drive the module only through
// the interface below. The vocabulary (status sets, policy, status view)
// lives in verification-status.ts so renderers share it without this file.
// ---------------------------------------------------------------------------

/** The app's read model of one user's verification. No PII, by construction. */
export type VerificationRecord = {
  userId: string;
  status: VerificationStatus;
  personaInquiryId: string | null;
  personaAccountId: string | null;
  /** The KYB case the row follows; null until the Workflow has created one, and for every individual. */
  personaCaseId: string | null;
  /** Persona's raw case status, kept for copy and digests; never an input to the access policy. */
  personaCaseStatus: string | null;
  /**
   * Persona's clock for the newest snapshot the record has taken — an
   * event's created-at, or a read resource's updated-at — whether or not it
   * moved the status: three case statuses map to one Verification Status, so
   * only this orders moves between them. A snapshot not newer loses.
   */
  sourceAt: Date;
  /**
   * When `status` (or the inquiry) last changed: the identity of the
   * transition a notification announces, strictly later than the one before.
   * Never compared to order snapshots; `sourceAt` does that.
   */
  statusChangedAt: Date;
  /** When the record was last confirmed against Persona (webhook, sweep or start). */
  lastSyncedAt: Date;
};

/** What a read returns: the record, the flow it belongs to (from the profile in the same query) and its version. */
export type StoredVerification = VerificationRecord & {
  accountType: AccountType;
  /** Bumped by every `write`; a writer passes the one it read. */
  version: number;
};

/** What the module needs from the onboarding profile: the investor path and the prefill. */
export type VerificationProfile = {
  accountType: AccountType;
  firstName: string;
  lastName: string;
  email: string;
  /** ISO 3166-1 alpha-2; null when the profile's country cannot be resolved to a code. */
  countryCode: string | null;
  /** The organization's legal name, for the business prefill; null for an individual. */
  entityName: string | null;
  /** ISO 3166-1 alpha-2 of the country of incorporation; null for an individual or an unresolvable name. */
  countryOfIncorporationCode: string | null;
};

/**
 * Store port — the app database. Methods reject on infrastructure failure;
 * the module decides per operation whether that is a typed error
 * (`receiveWebhook` → `store_failure`, so the caller can ask for a retry) or
 * propagates.
 */
export type VerificationStore = {
  get(input: { userId: string }): Promise<StoredVerification | null>;
  /**
   * The records whose current inquiry is one of `inquiryIds` — how a case
   * event, which names no user, finds its row. A case lists the business
   * inquiry and its owners' child inquiries; the unique index makes this at
   * most one record per id, so one query answers none, one or several.
   */
  getByInquiryIds(input: { inquiryIds: ReadonlyArray<string> }): Promise<Array<StoredVerification>>;
  /**
   * Inserts the record when `expectVersion` is null, else updates it when the
   * stored version is still `expectVersion`; resolves the row's new version,
   * or null when another write got there first (a row inserted meanwhile, or
   * a version moved on). That is the store's one rule: the write path
   * decides everything else on the row it read, and decides again on a null.
   */
  write(record: VerificationRecord, options: { expectVersion: number | null }): Promise<number | null>;
  /**
   * Confirms the record against Persona — `lastSyncedAt` only, nothing else,
   * and not a version: a confirmation can never carry a stale snapshot over
   * a concurrent write, nor fail one. A no-op for a user without a record.
   */
  markSynced(input: { userId: string; syncedAt: Date }): Promise<void>;
  /** Insert-if-absent. Resolves true when this call inserted the id, false when it was already recorded. */
  recordEventIfAbsent(input: { eventId: string; receivedAt: Date }): Promise<boolean>;
  /** Forgets recorded events received before the cut-off; resolves how many. */
  deleteEventsBefore(input: { receivedBefore: Date }): Promise<number>;
  /**
   * Records in one of `statuses`, optionally of one flow (`accountType`) or
   * only those of `userIds`, last synced before `syncedBefore` and/or whose
   * status last changed inside (`changedAfter`, `changedBefore`); oldest
   * sync first, at most `limit`.
   */
  list(input: {
    statuses: ReadonlyArray<VerificationStatus>;
    accountType?: AccountType;
    userIds?: ReadonlyArray<string>;
    syncedBefore?: Date;
    changedBefore?: Date;
    changedAfter?: Date;
    limit: number;
  }): Promise<Array<StoredVerification>>;
  /**
   * How many records are in one of `statuses`, optionally of one flow and/or
   * holding one of `caseStatuses` as their raw case status, and changed
   * before `changedBefore`.
   */
  count(input: {
    statuses: ReadonlyArray<VerificationStatus>;
    accountType?: AccountType;
    caseStatuses?: ReadonlyArray<string>;
    changedBefore: Date;
  }): Promise<number>;
  /** Null when the user has not completed onboarding. */
  getProfile(input: { userId: string }): Promise<VerificationProfile | null>;
};

/** The slice of a Persona inquiry the module reads. Never its contents. */
export type PersonaInquiry = {
  id: string;
  status: PersonaInquiryStatus;
  /** The app's user id, set at creation; null for inquiries created outside the app. */
  referenceId: string | null;
  accountId: string | null;
  /** The template the inquiry runs (`itmpl_…`); absent or null when Persona did not say. */
  templateId?: string | null;
  /** The template version the inquiry was created on (`itmplv_…`); an inquiry is locked to it for life. */
  templateVersionId: string | null;
  /** Persona deleted its data (a retention policy or a deletion request); it keeps its status but cannot be resumed. */
  redacted?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * What the Status Write Path applies: a Persona resource reduced to the
 * Verification Status it maps to, the inquiry the record follows, and the
 * case it was read from when it was one. An inquiry snapshot carries no case;
 * a case snapshot names the business inquiry it lists.
 */
export type VerificationSnapshot = {
  status: VerificationStatus;
  inquiryId: string;
  accountId: string | null;
  case: { id: string; status: string } | null;
};

/**
 * An inquiry as Persona serialises it, before the status mapping: `status` is
 * null for a value the mapping does not cover (Persona may add one without a
 * versioned change). Lists and webhook payloads carry these; a session
 * always carries a mapped `PersonaInquiry`.
 */
export type ParsedPersonaInquiry = Omit<PersonaInquiry, 'status'> & { status: PersonaInquiryStatus | null };

export type PersonaApiError = {
  reason: 'network' | 'http' | 'invalid_response';
  message: string;
  httpStatus?: number;
};

export type PersonaSession = { inquiry: PersonaInquiry; sessionToken: string };

/** The slice of a registered Persona webhook the Drift check compares. */
export type PersonaWebhookConfig = {
  id: string;
  /** Persona's operational state; anything but `enabled` means no deliveries. */
  status: string;
  url: string;
  apiVersion: string | null;
  /** Event names, or `['*']` for everything. */
  enabledEvents: Array<string>;
  /** How payload keys are cased; null reads as Persona's default, kebab. */
  keyInflection: string | null;
  /** Payload paths Persona leaves out of each delivery. */
  attributeBlocklist: Array<string>;
  /** Which relationships a delivery carries: `include_all`, or a list of names; null reads as `include_all`. */
  relationshipAllowlist: string | Array<string> | null;
  /** Settings Persona returned in a shape the adapter could not read; each is compared at its fallback above. */
  unreadable: Array<string>;
};

/**
 * Persona port — the only external. The first four serve the flows; the last
 * two are read-only views of the dashboard's configuration, for the Drift
 * check. Every method returns a Result and never throws: the module maps any
 * failure to `persona_unavailable` and the caller decides what to tell the user.
 */
export type PersonaApi = {
  /**
   * Creates an inquiry on `templateVersionId`, prefilled with `fields` (the
   * template's own kebab-case keys), with an auto-created account (by
   * `referenceId`, of `accountTypeId` when given — Persona's default type
   * otherwise) and a session. `idempotencyKey` names this one creation:
   * Persona answers a retry carrying the same key with the inquiry it
   * already made instead of a second one.
   */
  createInquiry(input: {
    templateVersionId: string;
    fields: Record<string, string>;
    referenceId: string;
    accountTypeId?: string;
    idempotencyKey?: string;
  }): Promise<Result<PersonaSession, PersonaApiError>>;
  /** Fresh session token for an existing inquiry; Persona moves `expired` back to `pending`. */
  resumeInquiry(input: { inquiryId: string }): Promise<Result<PersonaSession, PersonaApiError>>;
  /** Every inquiry carrying `referenceId`, newest first — unmodelled statuses included, as null. */
  listInquiries(input: { referenceId: string }): Promise<Result<Array<ParsedPersonaInquiry>, PersonaApiError>>;
  /** Every case `inquiryId` is attached to, newest first; empty until a Workflow has created one. */
  listCases(input: { inquiryId: string }): Promise<Result<Array<PersonaCase>, PersonaApiError>>;
  /** The dashboard's registered webhooks. */
  listWebhooks(): Promise<Result<Array<PersonaWebhookConfig>, PersonaApiError>>;
  /** The `itmplv_…` id Persona currently serves for a template, or null when nothing is published. */
  latestPublishedVersion(input: { templateId: string }): Promise<Result<string | null, PersonaApiError>>;
};

/**
 * One queued notification: the transition it announces, as (inquiry, status,
 * `statusChangedAt`). It leaves through the Outbox and comes back through
 * `deliverNotification`, which re-reads the record and compares — a job the
 * record has moved past is stale (skip), one it has not caught up with yet is
 * early (retry). Idempotency of the send itself is the channel's business,
 * keyed on the same three.
 */
export type VerificationNotification = {
  userId: string;
  inquiryId: string;
  statusChangedAt: Date;
} &
  /**
   * `reopenedFrom` marks a reopen: the organization's KYB case moved off
   * this Decision back into review. Absent on every other transition, and
   * on jobs queued before it existed.
   */
  (| { kind: 'status_email'; status: VerificationEmailStatus; reopenedFrom?: DecisionStatus }
    | { kind: 'operator_message'; status: VerificationOperatorStatus; reopenedFrom?: DecisionStatus }
    /**
     * A raw KYB case move the Verification Status did not follow — the
     * owners done and the team's turn. `status` and
     * `statusChangedAt` are the record's at enqueue, carried because every
     * job body names them; the receiver matches on the case id and raw
     * status, and delivers while the record still holds both.
     */
    | { kind: 'case_status'; status: VerificationStatus; caseId: string; caseStatus: string }
  );

/** Outbox port — QStash in production. Rejects on failure. */
export type Outbox = {
  enqueue(notification: VerificationNotification): Promise<void>;
};

/**
 * Status email port — Resend in production. The adapter keys its own
 * idempotency on (status, inquiry, `statusChangedAt`), so a redelivered job
 * is one email and a status reached twice (approved, declined, approved
 * again) is two. Rejects on failure.
 */
export type StatusEmailSender = {
  send(input: {
    to: string;
    name?: string;
    status: VerificationEmailStatus;
    /** Which flow the email is about: an individual's identity, or an organization. */
    accountType: AccountType;
    /** For an organization's review email: who the KYB case waits on at the time of sending. */
    caseWaitingOn: 'people' | 'team' | null;
    /** For a review email: the Decision a reopened KYB case took back, when it was one. */
    reopenedFrom?: DecisionStatus;
    inquiryId: string;
    statusChangedAt: Date;
  }): Promise<void>;
};

/**
 * Operator message port — the Persona Telegram channel in production. Rejects on
 * failure. `email`, the flow and the case are read from the profile and the
 * record at delivery, never carried in the job; `email` is null when the
 * profile is gone, and the line still goes.
 */
export type OperatorMessenger = {
  send(
    input: {
      userId: string;
      email: string | null;
      inquiryId: string;
      /** Which flow the line is about; null when the profile is gone. */
      accountType: AccountType | null;
    } & (
      | {
          kind: 'status';
          status: VerificationOperatorStatus;
          case: { id: string; status: string } | null;
          /** The Decision a reopened KYB case took back, when the move is one. */
          reopenedFrom?: DecisionStatus;
        }
      /** A raw case move: the case as moved, and the Verification Status the record keeps meanwhile. */
      | { kind: 'case_status'; status: VerificationStatus; case: { id: string; status: string } }
    )
  ): Promise<void>;
};

/**
 * Approval-ended port — in production, a run of the Wallet link sweep queued
 * on QStash, so ops is asked to revoke the user's whitelisted addresses now
 * rather than on the next hourly run. Called after the write lands, best
 * effort: a lost notice only waits for the schedule, which reads the same
 * records. Optional; nothing is notified without it.
 */
export type ApprovalEndedNotifier = {
  notify(input: { userId: string }): Promise<void>;
};

export type Clock = { now(): Date };

// ---------------------------------------------------------------------------
// The external seam.
// ---------------------------------------------------------------------------

export type StartVerificationError =
  | { code: StartRefusal | 'organization' | 'profile_missing' }
  | { code: 'persona_unavailable'; cause: PersonaApiError }
  /** The re-read before the start applied a transition whose notifications could not be queued; nothing was persisted. */
  | { code: 'queue_unavailable'; cause: unknown };

/**
 * The first four are the caller's "do not retry"; the last two its "retry" (a
 * real 5xx). `oversized` and `bad_signature` are answered before anything is
 * read or hashed: both are unauthenticated input.
 */
export type WebhookError =
  | { code: 'oversized' | 'bad_signature' | 'stale_timestamp' | 'malformed' }
  | { code: 'store_failure' | 'outbox_failure'; cause: unknown };

/**
 * Why a verified, well-formed event changed nothing. The first two mean the
 * dashboard subscription and this module have drifted apart — the event was
 * accepted, authenticated and then dropped — and the route alerts on them.
 * `foreign_inquiry` and `superseded_inquiry` are ordinary traffic and stay
 * silent; `unadopted_inquiry` and `case_decides` are a person's call and the
 * route alerts on them.
 */
export type WebhookIgnoredReason =
  /** Persona delivers it; `PERSONA_SUBSCRIBED_EVENTS` does not list it. */
  | 'unsubscribed_event'
  /** An inquiry status the mapping does not cover — Persona added one. */
  | 'unmapped_status'
  /** No reference id, one that is not a user id, or another template's inquiry: not this app's Inquiry. */
  | 'foreign_inquiry'
  /** A late event for an inquiry the user has already replaced. */
  | 'superseded_inquiry'
  /**
   * An inquiry created after the record's Decision (a reviewer's follow-up,
   * a re-verification): the record keeps the Decision, since neither the
   * sweep nor a start re-reads one, until an operator resyncs.
   */
  | 'unadopted_inquiry'
  /**
   * A decision on an organization's business inquiry itself (a reviewer
   * approved or declined the inquiry in the dashboard): only its KYB case
   * decides an organization, so the event is dropped and the route alerts.
   */
  | 'case_decides'
  /** A case on another case template (a KYC review's), or any case while the organization flow is off. */
  | 'foreign_case'
  /**
   * A KYB case none of whose inquiries any record follows: a start whose
   * row write was lost, or an inquiry made in the dashboard. The retried or
   * later inquiry event creates the row, and the sweep then reads the case.
   */
  | 'unmatched_case'
  /** A KYB case naming an individual's inquiry, a second case on a record's inquiry, or several records at once. */
  | 'conflicting_case';

/** Reasons the route alerts on with the case id, since nobody else will look. */
export type CaseAlertReason = 'unmatched_case' | 'conflicting_case';
/** Reasons the route alerts on with the user and the inquiry, which the operator's follow-up needs. */
export type InquiryAlertReason = 'unadopted_inquiry' | 'case_decides';

export type WebhookOutcome =
  /**
   * `unchanged`: the current inquiry's event, older than or equal to what the
   * record holds, or refused by a guard. `unknownCaseStatus` names a KYB case
   * status outside every configured set — applied as in review, and drift
   * for the route to report.
   */
  | { outcome: 'applied' | 'unchanged' | 'duplicate'; unknownCaseStatus?: string }
  | {
      outcome: 'ignored';
      reason: Exclude<WebhookIgnoredReason, InquiryAlertReason | CaseAlertReason>;
      eventName: string;
    }
  /** Names the user and the inquiry: a resync adopts the one, a case decision settles the other. */
  | { outcome: 'ignored'; reason: InquiryAlertReason; eventName: string; userId: string; inquiryId: string }
  /** Names the case, which is all the route has to point an operator at. */
  | { outcome: 'ignored'; reason: CaseAlertReason; eventName: string; caseId: string }
  /** An operations event: no status touched; the route alerts with the resource id and the Workflow it ran. */
  | { outcome: 'ops_alert'; eventName: string; resourceId: string | null; workflowId: string | null };

export type ReconcileReport = {
  /** Stale records the sweep re-read. */
  checked: number;
  changed: number;
  /** Re-reads Persona could not answer; they stay stale for the next sweep. */
  unavailable: number;
  /** Why the first of them failed — a revoked key and an outage look alike by count alone. */
  unavailableCause?: PersonaApiError;
  /** Re-reads that failed on this side (a store or queue failure) after Persona answered; they too stay stale for the next sweep. */
  errored: number;
  erroredCause?: unknown;
  /** `submitted` or `failed` records past the decision threshold: a Workflow that did not run. A defect. */
  undecided: number;
  /** Records a reviewer has not got to past the review threshold. A queue, not a defect. */
  awaitingReview: number;
  /**
   * Organizations in review past the same threshold whose KYB case waits on
   * their own owners, not on a reviewer: counted apart so a long owner wait
   * does not read as the team's backlog.
   */
  awaitingOwners: number;
};

/**
 * Why a queued notification was not delivered. Both are the caller's "retry":
 * `not_caught_up` because the record has not reached the transition the job
 * announces yet (the write path enqueues before it persists), `send_failed`
 * because the channel did not take it.
 */
export type DeliveryError = { code: 'not_caught_up' } | { code: 'send_failed'; cause: unknown };

/** `skipped`: the record has moved past this job, so there is nothing left to announce. */
export type DeliveryOutcome = 'sent' | 'skipped';

/**
 * What an operator action did to the record: `not_started` stands for no
 * record, equal ends for no change. `inquiryId` is the Inquiry the record
 * follows afterwards — for a resync, null means Persona holds none to go
 * back to and the record was left as it is.
 */
export type OperatorChange = {
  from: VerificationStatus;
  to: VerificationStatus;
  inquiryId: string | null;
  /** Which flow the user is on. */
  path: InvestorPath;
  /** The KYB case the record follows afterwards, with its raw status; null for an individual. */
  case: { id: string; status: string } | null;
};

/** `conflict`: a concurrent write landed a later stamp between the read and the write — the caller's "retry". */
export type HumanOwnedWriteError = { code: 'profile_missing' | 'conflict' };

export type ResyncError = { code: 'profile_missing' } | { code: 'persona_unavailable'; cause: PersonaApiError };

export type Verification = {
  /** Local read; never calls Persona. */
  getVerificationStatus(input: { userId: string }): Promise<VerificationStatusView>;
  /**
   * Local read, one query for all of them: which of `userIds` hold a record
   * that is not a yes Decision (`isYesDecision`). A user with no record is
   * not among them: nobody without one could have linked.
   */
  listUnapproved(input: { userIds: ReadonlyArray<string> }): Promise<Set<string>>;
  /** Applies the access policy, then creates or resumes the user's inquiry. */
  startVerification(input: {
    userId: string;
  }): Promise<Result<{ inquiryId: string; sessionToken: string }, StartVerificationError>>;
  /** Verifies, applies (through the Status Write Path) and records one Persona event. */
  receiveWebhook(input: {
    rawBody: string;
    signatureHeader: string | null;
    receivedAt: Date;
  }): Promise<Result<WebhookOutcome, WebhookError>>;
  /** The Reconciliation Sweep: re-reads stale non-terminal records and decided organizations, and reports the stuck ones. */
  reconcile(input: { now: Date }): Promise<ReconcileReport>;
  /**
   * The receiving half of the Outbox: re-reads the record, drops a job it has
   * moved past, asks for a retry of one it has not caught up with, and sends
   * the rest through the channel for the notification's kind.
   */
  deliverNotification(input: {
    notification: VerificationNotification;
  }): Promise<Result<DeliveryOutcome, DeliveryError>>;
  /**
   * An operator's revocation — the one producer of the Human-owned `revoked`.
   * From then on no Persona event or re-read touches the record, until
   * `resyncFromPersona` releases it. A user without a record gets one, which
   * also keeps them from starting.
   */
  revoke(input: { userId: string }): Promise<Result<OperatorChange, HumanOwnedWriteError>>;
  /**
   * An operator's approval — the one producer of the Human-owned
   * `manually_approved`, for a user Persona never decides: an organization, or
   * an investor verified before Persona. Deaf to Persona like a revocation,
   * so an individual with an Inquiry is decided in Persona instead. `revoke`
   * undoes it; it is also how a revoked organization is restored, which a
   * resync cannot do with no Inquiry to go back to.
   */
  approveManually(input: { userId: string }): Promise<Result<OperatorChange, HumanOwnedWriteError>>;
  /**
   * An operator's re-read of one user, whatever the record says: the one way a
   * Human-owned status is cleared, and the recovery for a Decision whose
   * change never arrived (the sweep leaves Decisions alone). The record
   * becomes what Persona holds now — never a status typed by hand, because
   * everything Persona sent while the record was Human-owned was dropped.
   */
  resyncFromPersona(input: { userId: string }): Promise<Result<OperatorChange, ResyncError>>;
};

/**
 * One flow's Persona template: what the app creates inquiries on and what it
 * recognises as its own. An inquiry on any other template is never the
 * user's Inquiry, whatever reference id it carries — its events are ignored
 * and a re-read does not adopt it, so a reviewer's follow-up inquiry or the
 * other flow's cannot replace the record's own. One that names no template
 * is let through.
 */
export type KycFlowConfig = {
  path: 'individual';
  /** The template (`itmpl_…`). */
  templateId: string;
  /**
   * The version inquiries are created on (`itmplv_…`). An inquiry created on
   * an older version is not resumed: Persona's guidance is to create a fresh
   * one so the investor goes through the current configuration.
   */
  templateVersionId: string;
};

/** The organization flow: the business template, and the KYB case that decides it. */
export type KybFlowConfig = Omit<KycFlowConfig, 'path'> & {
  path: 'organization';
  /** The Business account type the auto-created account must have; the Workflow's owner relation fails on any other. */
  accountTypeId: string;
  /** The KYB case template (`ctmpl_…`); a case on any other template is never an organization's. */
  caseTemplateId: string;
  caseStatuses: KybCaseStatusSets;
};

export type VerificationConfig = {
  /** Persona's webhook secret for this endpoint (previews and production differ). */
  webhookSecret: string;
  flows: {
    individual: KycFlowConfig;
    /** Absent until the KYB environment is configured: an organization is then refused as before. */
    organization?: KybFlowConfig;
  };
  /** How long a sync stays fresh for the sweep: a record confirmed more recently than this is not re-read. */
  staleAfterMs?: number;
  /**
   * A `submitted` or `failed` record still undecided after this long is
   * reported as a defect: Persona decides in seconds when a Workflow exists,
   * so anything past an hour means one did not run.
   */
  undecidedAfterMs?: number;
  /** A record a human has not reviewed after this long is reported as a backlog. */
  reviewAfterMs?: number;
  /**
   * Wall-clock budget for starting Persona re-reads in one sweep; what does
   * not fit drains on the next one. A batch that starts inside the budget may
   * run a full Persona timeout past it, and the route still has its counts,
   * the digest and Sentry to do inside the function limit — size accordingly.
   */
  reconcileBudgetMs?: number;
  /**
   * How long the sweep keeps re-reading a `submitted` or `failed` record
   * (waiting on Persona's own decisioning), and how long recorded events are
   * kept — well past Persona's ~2-day retry horizon either way.
   */
  reconcileHorizonMs?: number;
  /**
   * How long the sweep keeps re-reading a record that waits on a REVIEWER,
   * and how often. A compliance review can take weeks, an organization's
   * waits on its owners for up to a month first, and only a person can move
   * either, so these rows are re-read on a slow cadence for a long while: a
   * few reads a day, and the one lost decision webhook is still caught.
   */
  reviewHorizonMs?: number;
  reviewCadenceMs?: number;
  /**
   * How long the sweep keeps re-reading a record that waits on the INVESTOR.
   * Past this they have abandoned the flow: an expired inquiry cannot move
   * without them, and when they return `startVerification` fetches. Re-reading these
   * for the full horizon is the largest and least useful part of every batch.
   */
  abandonedAfterMs?: number;
};

export const VERIFICATION_DEFAULT_THRESHOLDS = {
  staleAfterMs: 30 * 60_000,
  undecidedAfterMs: 60 * 60_000,
  reviewAfterMs: 24 * 60 * 60_000,
  reconcileBudgetMs: 25_000,
  reconcileHorizonMs: 7 * 24 * 60 * 60_000,
  reviewHorizonMs: 90 * 24 * 60 * 60_000,
  reviewCadenceMs: 6 * 60 * 60_000,
  abandonedAfterMs: 24 * 60 * 60_000
} as const;

/**
 * The events the dashboard subscription delivers. `inquiry.transitioned` is a
 * dynamic-flow step event, not a status catch-all — deliberately absent.
 */
export const PERSONA_SUBSCRIBED_EVENTS = new Set([
  'inquiry.completed',
  'inquiry.marked-for-review',
  'inquiry.approved',
  'inquiry.declined',
  'inquiry.failed',
  'inquiry.expired'
]);

/**
 * The case events the subscription delivers for an organization's KYB case:
 * its creation, and every status move. A resolve and a reopen each also
 * move the status, so their own events would only repeat these. A delivery
 * carries the case as it was at event time (Persona's delivery records,
 * 2026-10-26); only the API's event reads render the current state.
 */
export const PERSONA_CASE_EVENTS = new Set(['case.created', 'case.status-updated']);

/**
 * Events that never touch a Verification Status: they name something broken
 * on Persona's side (a decisioning Workflow run that errored) hours before
 * the undecided alarm could infer it. The dashboard subscription must enable
 * these alongside `PERSONA_SUBSCRIBED_EVENTS`.
 */
export const PERSONA_OPS_EVENTS = new Set(['workflow-run.errored']);

/** Persona events are a few KB; anything past this is not Persona and is not worth an HMAC. */
const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * How often a write that lost to a concurrent one decides again. Contention
 * is one user's row, so a third loss means something is writing in a loop.
 */
const MAX_WRITE_ATTEMPTS = 3;
/** Records one sweep lists; the budget, not this, is what bounds a pass. */
const RECONCILE_BATCH_SIZE = 200;
/** Persona reads are independent per user; a small fan-out keeps one slow read from eating the budget. */
const RECONCILE_CONCURRENCY = 5;
/**
 * How long a start waits for its best-effort operator ping before handing
 * out the session anyway. The QStash client has no deadline of its own, and
 * a queue that hangs would otherwise hold the response until the platform
 * killed the function — for a verification that had already started.
 */
const ANNOUNCE_TIMEOUT_MS = 5_000;

/** Raised inside the write path so `receiveWebhook` can tell a queue failure from a database one. */
class OutboxFailure extends Error {
  constructor(readonly cause: unknown) {
    super('KYC notification could not be enqueued');
  }
}

const isYes = isOneOf(YES_DECISION_STATUSES);
/** Every status but a yes Decision, for `listUnapproved`'s one query. */
const UNAPPROVED_STATUSES = verificationStatusValues.filter((status) => !isYes(status));

export function createVerification({
  store,
  persona,
  outbox,
  statusEmails,
  operatorMessages,
  approvalEnded,
  clock,
  config
}: {
  store: VerificationStore;
  persona: PersonaApi;
  outbox: Outbox;
  statusEmails: StatusEmailSender;
  operatorMessages: OperatorMessenger;
  approvalEnded?: ApprovalEndedNotifier;
  clock: Clock;
  config: VerificationConfig;
}): Verification {
  /** A yes that a landed write took away: the Wallet link hears now, not on its next run. */
  async function announceApprovalEnded({
    userId,
    from,
    to
  }: {
    userId: string;
    from: VerificationStatus | undefined;
    to: VerificationStatus;
  }) {
    if (!approvalEnded || !from || !isYes(from) || isYes(to)) return;
    try {
      await approvalEnded.notify({ userId });
    } catch {
      // The hourly sweep reads the same records and catches up.
    }
  }

  /**
   * The Status Write Path — the one way a Persona snapshot becomes a
   * Verification Status. Webhooks, the sweep and a start all call it with
   * what they read: an inquiry, or an organization's case. `sourceAt` is the
   * event's created-at or the resource's updated-at; `source` says whether
   * the snapshot is a point-in-time event (proves nothing about the present)
   * or a fetch made just now (confirms the record, and is by definition the
   * user's current inquiry).
   */
  async function applySnapshot(input: SnapshotInput): Promise<{
    outcome: 'changed' | 'unchanged' | 'superseded';
    record: StoredVerification | null;
  }> {
    const { userId, now } = input;
    // Read, decide, write against the version read. A write that lost to
    // another one decides again on the present; the store holds no rules.
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
      const record = await store.get({ userId });
      const transition = decide({ record, input, caseStatuses: config.flows.organization?.caseStatuses });
      if (!transition.next) {
        if (transition.confirm) await store.markSynced({ userId, syncedAt: now });
        return { outcome: transition.outcome, record };
      }

      // Enqueue before persisting. A persist failure leaves the event
      // unrecorded, so the retry (or the sweep) re-applies and re-enqueues;
      // the receivers tell an early job from a stale one by `statusChangedAt`
      // and Resend's idempotency key absorbs a genuine double send. The other
      // order has no recovery: a persisted status with a failed enqueue is
      // "unchanged" to every later pass and the email is never sent.
      try {
        for (const notification of transition.notifications) await outbox.enqueue(notification);
      } catch (cause) {
        throw new OutboxFailure(cause);
      }

      const version = await store.write(transition.next, { expectVersion: record?.version ?? null });
      if (version === null) continue;

      // Announced after the persist and best-effort: a redelivery sees no
      // change and would not re-enqueue, so a failed enqueue is dropped
      // rather than failing the write; the digest still counts the row.
      if (transition.caseMove) await outbox.enqueue(transition.caseMove).catch(() => undefined);
      await announceApprovalEnded({ userId, from: record?.status, to: transition.next.status });
      return {
        outcome: transition.outcome,
        record: { ...transition.next, accountType: record?.accountType ?? input.path, version }
      };
    }
    throw new Error(`The verification record of ${userId} kept changing under the write`);
  }

  /**
   * A case event through the write path. A case names no user: the record
   * is found by the inquiries the case lists, of which the business inquiry
   * is one. A move the status does not follow — the owners done and the
   * team's turn, a decision reached again — is still recorded as the raw
   * case status the card and the digest read.
   */
  async function receiveCase({
    event,
    kybCase,
    receivedAt
  }: {
    event: { id: string; name: string; createdAt: Date };
    kybCase: PersonaCase;
    receivedAt: Date;
  }): Promise<Result<WebhookOutcome, WebhookError>> {
    const ignored = (reason: 'foreign_case'): Result<WebhookOutcome, never> =>
      ok({ outcome: 'ignored', reason, eventName: event.name });
    const alert = (reason: CaseAlertReason): Result<WebhookOutcome, never> =>
      ok({ outcome: 'ignored', reason, eventName: event.name, caseId: kybCase.id });

    const flow = config.flows.organization;
    if (!flow) return ignored('foreign_case');
    if (kybCase.caseTemplateId !== flow.caseTemplateId) return ignored('foreign_case');

    let records: Array<StoredVerification>;
    try {
      records = await store.getByInquiryIds({ inquiryIds: kybCase.inquiryIds });
    } catch (cause) {
      return err({ code: 'store_failure', cause });
    }
    if (records.length === 0) return alert('unmatched_case');
    const [record] = records;
    if (records.length > 1 || !record?.personaInquiryId || record.accountType !== 'organization') {
      return alert('conflicting_case');
    }
    if (record.personaCaseId && record.personaCaseId !== kybCase.id) return alert('conflicting_case');

    const kind = classifyCaseStatus({ status: kybCase.status, sets: flow.caseStatuses });
    const snapshot = fromCase({
      kybCase,
      inquiryId: record.personaInquiryId,
      accountId: null,
      sets: flow.caseStatuses
    });

    try {
      const applied = await applySnapshot({
        userId: record.userId,
        path: 'organization',
        snapshot,
        sourceAt: event.createdAt,
        source: 'event',
        now: receivedAt
      });
      // A concurrent start re-pointed the row between the lookup and the write.
      if (applied.outcome === 'superseded') return alert('conflicting_case');

      const inserted = await store.recordEventIfAbsent({ eventId: event.id, receivedAt });
      if (!inserted) return ok({ outcome: 'duplicate' });
      return ok({
        outcome: applied.outcome === 'changed' ? 'applied' : 'unchanged',
        ...(kind === 'unknown' ? { unknownCaseStatus: kybCase.status } : {})
      });
    } catch (cause) {
      if (cause instanceof OutboxFailure) return err({ code: 'outbox_failure', cause: cause.cause });
      return err({ code: 'store_failure', cause });
    }
  }

  /** A case as a snapshot: its raw status through the configured sets, naming the business inquiry it decides. */
  const fromCase = ({
    kybCase,
    inquiryId,
    accountId,
    sets
  }: {
    kybCase: PersonaCase;
    inquiryId: string;
    accountId: string | null;
    sets: KybCaseStatusSets;
  }): VerificationSnapshot => ({
    status: CASE_STATUS_KIND_TO_VERIFICATION_STATUS[classifyCaseStatus({ status: kybCase.status, sets })],
    inquiryId,
    accountId,
    case: { id: kybCase.id, status: kybCase.status }
  });

  /** An inquiry as a snapshot: its status through the mapping, and no case. */
  const fromInquiry = (inquiry: PersonaInquiry): VerificationSnapshot => ({
    status: PERSONA_STATUS_TO_VERIFICATION_STATUS[inquiry.status],
    inquiryId: inquiry.id,
    accountId: inquiry.accountId,
    case: null
  });

  const staleAfterMs = config.staleAfterMs ?? VERIFICATION_DEFAULT_THRESHOLDS.staleAfterMs;
  const undecidedAfterMs = config.undecidedAfterMs ?? VERIFICATION_DEFAULT_THRESHOLDS.undecidedAfterMs;
  const reviewAfterMs = config.reviewAfterMs ?? VERIFICATION_DEFAULT_THRESHOLDS.reviewAfterMs;
  const reconcileBudgetMs = config.reconcileBudgetMs ?? VERIFICATION_DEFAULT_THRESHOLDS.reconcileBudgetMs;
  const reconcileHorizonMs = config.reconcileHorizonMs ?? VERIFICATION_DEFAULT_THRESHOLDS.reconcileHorizonMs;
  const reviewHorizonMs = config.reviewHorizonMs ?? VERIFICATION_DEFAULT_THRESHOLDS.reviewHorizonMs;
  const reviewCadenceMs = config.reviewCadenceMs ?? VERIFICATION_DEFAULT_THRESHOLDS.reviewCadenceMs;
  const abandonedAfterMs = config.abandonedAfterMs ?? VERIFICATION_DEFAULT_THRESHOLDS.abandonedAfterMs;

  /** The flow a user verifies through, by account type — undefined for an organization while KYB is not configured. */
  const flowFor = (path: InvestorPath) => config.flows[path];
  /**
   * Whether an inquiry's own status may decide the flow. An individual's
   * does. An organization is decided by its KYB case alone: a decision on
   * the business inquiry itself (a reviewer's click on the inquiry page,
   * which the runbook forbids) must never grant or remove access.
   */
  const inquiryDecides = (flow: KycFlowConfig | KybFlowConfig, status: VerificationStatus) =>
    flow.path !== 'organization' || !isDecision(status);
  /**
   * Who an organization's review waits on, from the raw case status the
   * row keeps: its own people, or the team — which a status the
   * configuration does not know also reads as. Null off review, and for an individual.
   */
  const caseWaitingOnFor = (record: VerificationRecord | null, path: InvestorPath): 'people' | 'team' | null => {
    const flow = flowFor(path);
    if (flow?.path !== 'organization' || record?.status !== 'pending_review' || !record.personaCaseStatus) return null;
    return classifyCaseStatus({ status: record.personaCaseStatus, sets: flow.caseStatuses }) === 'people'
      ? 'people'
      : 'team';
  };
  /** True for an inquiry that names a template other than the flow's; one that names none is let through. */
  const onOtherTemplate = (inquiry: Pick<ParsedPersonaInquiry, 'templateId'>, flow: KycFlowConfig | KybFlowConfig) =>
    !!inquiry.templateId && inquiry.templateId !== flow.templateId;

  /**
   * Re-reads the user's newest inquiry from Persona through the write path.
   * Persona being unavailable is not an error here — the caller answers
   * from the local record and the next read or sweep tries again.
   */
  async function refreshFromPersona({
    userId,
    flow,
    record,
    release,
    now
  }: {
    userId: string;
    flow: KycFlowConfig | KybFlowConfig;
    record: StoredVerification | null;
    release?: boolean;
    now: Date;
  }): Promise<
    | {
        outcome: 'changed' | 'unchanged' | 'superseded';
        record: StoredVerification | null;
        /** The inquiry that was applied, as Persona holds it now. */
        inquiry?: PersonaInquiry;
      }
    | { outcome: 'unavailable'; record: StoredVerification | null; error: PersonaApiError }
  > {
    const listed = await persona.listInquiries({ referenceId: userId });
    if (!listed.ok) return { outcome: 'unavailable', record, error: listed.error };

    // An organization that follows a KYB case is decided by that case alone,
    // read through its own inquiry whatever is newer: a business inquiry
    // opened since in the dashboard must not hide a reopen, and a second case
    // is the webhook's conflict to alert on, never the sweep's to apply. An
    // operator's resync adopts what is newest instead, as for an individual.
    const bound =
      flow.path === 'organization' && !release && record?.personaCaseId && record.personaInquiryId
        ? { caseId: record.personaCaseId, inquiryId: record.personaInquiryId }
        : null;
    // Newest first, the flow's template only: a follow-up inquiry, or the
    // other flow's, under the same reference id must not replace the user's Inquiry.
    const newest = bound
      ? listed.value.find((inquiry) => inquiry.id === bound.inquiryId)
      : listed.value.find((inquiry) => !onOtherTemplate(inquiry, flow));
    if (!newest) {
      // Nothing under this reference any more (retention deleted it): confirmed,
      // nothing to apply — and no `inquiry`, which a start reads as "gone".
      if (record) await store.markSynced({ userId, syncedAt: now });
      return { outcome: 'unchanged', record };
    }
    // A status the mapping does not cover on the newest inquiry is not ours
    // to interpret: the record is confirmed but not re-pointed at an older
    // inquiry. The webhook for the same inquiry raises `unmapped_status`,
    // which is where the drift shows.
    if (!newest.status) {
      if (record) await store.markSynced({ userId, syncedAt: now });
      const error: PersonaApiError = { reason: 'invalid_response', message: `unknown inquiry status on ${newest.id}` };
      return { outcome: 'unavailable', record, error };
    }

    const inquiry: PersonaInquiry = { ...newest, status: newest.status };
    let snapshot = fromInquiry(inquiry);
    let sourceAt = inquiry.updatedAt;
    // An organization's business inquiry, once submitted, is decided by its
    // KYB case — whether Persona left it `completed`, a Workflow marked it
    // for review, or someone decided the inquiry itself in the dashboard.
    // Once the Workflow has made a case, the case is the snapshot; a decided
    // case outranks a newer open one someone made by hand. An inquiry-level
    // decision with no case behind it decides nothing: the record is
    // confirmed as it is, and the undecided alarm is what says so.
    const submitted = ['completed', 'needs_review', 'approved', 'declined'].includes(inquiry.status);
    if (flow.path === 'organization' && submitted) {
      const listedCases = await persona.listCases({ inquiryId: inquiry.id });
      if (!listedCases.ok) return { outcome: 'unavailable', record, error: listedCases.error };
      const { caseStatuses: sets } = flow;
      const decided = (kybCase: PersonaCase) =>
        ['approved', 'declined'].includes(classifyCaseStatus({ status: kybCase.status, sets }));
      // Persona ignores a filter it does not know, so the case must name the inquiry itself.
      const own = listedCases.value.filter(
        (kybCase) => kybCase.caseTemplateId === flow.caseTemplateId && kybCase.inquiryIds.includes(inquiry.id)
      );
      const kybCase = bound ? own.find((candidate) => candidate.id === bound.caseId) : (own.find(decided) ?? own[0]);
      if (kybCase) {
        // The record's own case reached through another inquiry (a resync
        // adopting the newest) keeps the record on the inquiry, and the
        // account, it started on.
        const ownInquiryId = kybCase.id === record?.personaCaseId ? record.personaInquiryId : null;
        snapshot = ownInquiryId
          ? fromCase({
              kybCase,
              inquiryId: ownInquiryId,
              accountId: record?.personaAccountId ?? inquiry.accountId,
              sets
            })
          : fromCase({ kybCase, inquiryId: inquiry.id, accountId: inquiry.accountId, sets });
        sourceAt = kybCase.updatedAt;
      } else if (bound || !inquiryDecides(flow, snapshot.status)) {
        if (record) await store.markSynced({ userId, syncedAt: now });
        return { outcome: 'unchanged', record, inquiry };
      }
    }
    const applied = await applySnapshot({
      userId,
      path: flow.path,
      snapshot,
      sourceAt,
      source: 'fetch',
      fetchedFor: record?.personaInquiryId ?? null,
      release,
      now
    });
    return { ...applied, inquiry };
  }

  /**
   * The operator's own write of a Human-owned status, behind `revoke` and
   * `approveManually`. Keeps the record's Persona identifiers and notifies
   * nobody: the operator route reports the change.
   */
  async function setHumanOwned({
    userId,
    status
  }: {
    userId: string;
    status: HumanOwnedStatus;
  }): Promise<Result<OperatorChange, HumanOwnedWriteError>> {
    const now = clock.now();
    const [record, profile] = await Promise.all([store.get({ userId }), store.getProfile({ userId })]);
    if (!profile) return err({ code: 'profile_missing' });
    const inquiryId = record?.personaInquiryId ?? null;
    const change = { inquiryId, path: profile.accountType, case: caseOf(record) };
    if (record?.status === status) return ok({ from: status, to: status, ...change });

    // Strictly after the last transition, like every other stamp: Persona's
    // clock may run ahead of this one, and the receivers order jobs by it.
    const statusChangedAt = new Date(Math.max(now.getTime(), (record?.statusChangedAt.getTime() ?? 0) + 1));
    const written = await store.write(
      {
        userId,
        status,
        personaInquiryId: inquiryId,
        personaAccountId: record?.personaAccountId ?? null,
        personaCaseId: record?.personaCaseId ?? null,
        personaCaseStatus: record?.personaCaseStatus ?? null,
        // Persona's clock, which an operator's word does not move.
        sourceAt: record?.sourceAt ?? statusChangedAt,
        statusChangedAt,
        // Not a confirmation against Persona, so an existing sync stamp stays.
        lastSyncedAt: record?.lastSyncedAt ?? now
      },
      { expectVersion: record?.version ?? null }
    );
    if (written === null) return err({ code: 'conflict' });
    await announceApprovalEnded({ userId, from: record?.status, to: status });
    return ok({ from: record?.status ?? 'not_started', to: status, ...change });
  }

  /** The case a record follows, as the operator report names it. */
  function caseOf(record: VerificationRecord | null): OperatorChange['case'] {
    return record?.personaCaseId && record.personaCaseStatus
      ? { id: record.personaCaseId, status: record.personaCaseStatus }
      : null;
  }

  return {
    // A local read, never a Persona call: webhooks and the sweep keep the
    // record honest (Persona's own guidance — webhooks plus your own store),
    // and a start re-reads Persona before it acts. A page render is neither
    // the place to spend a rate-limited call nor to wait out a Persona outage.
    async getVerificationStatus({ userId }) {
      const [record, profile] = await Promise.all([store.get({ userId }), store.getProfile({ userId })]);

      const status = record?.status ?? 'not_started';
      const path: InvestorPath = profile?.accountType ?? 'individual';

      // An organization without a configured flow is verified with the team:
      // nothing to start or resume, and the stored status still renders (a
      // human may have set it).
      const flow = flowFor(path);
      if (!flow) return { status, path, canStart: false, canResume: false, inquiryId: null, caseWaitingOn: null };

      const canResume = canResumeFrom(status);

      return {
        status,
        path,
        canStart: canStartFrom(status, path),
        canResume,
        inquiryId: canResume ? (record?.personaInquiryId ?? null) : null,
        caseWaitingOn: caseWaitingOnFor(record, path)
      };
    },

    // The status alone decides a no, for an individual and an organization
    // alike, so the profile `getVerificationStatus` reads is not needed here.
    async listUnapproved({ userIds }) {
      if (userIds.length === 0) return new Set();
      const records = await store.list({ statuses: UNAPPROVED_STATUSES, userIds, limit: userIds.length });
      return new Set(records.map((record) => record.userId));
    },

    async startVerification({ userId }) {
      const now = clock.now();

      // Best-effort operator ping for a session actually handed out. The ping
      // is observability, not state — a queue that fails or hangs must not
      // fail or hold the start, so the wait is capped and a miss is dropped.
      const announceStart = async (input: { inquiryId: string; statusChangedAt: Date }) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            outbox.enqueue({
              userId,
              inquiryId: input.inquiryId,
              statusChangedAt: input.statusChangedAt,
              kind: 'operator_message',
              status: 'in_progress'
            }),
            new Promise<void>((resolve) => {
              timer = setTimeout(resolve, ANNOUNCE_TIMEOUT_MS);
            })
          ]);
        } catch {
          // Swallowed on purpose; the compliance notifications in the write path do not do this.
        } finally {
          clearTimeout(timer);
        }
      };
      const [stored, profile] = await Promise.all([store.get({ userId }), store.getProfile({ userId })]);

      if (!profile) return err({ code: 'profile_missing' });
      // Before anything else: an organization starts only once its flow is configured.
      const path = profile.accountType;
      const flow = flowFor(path);
      if (!flow) return err({ code: 'organization' });

      // The policy must see the present, so this is the one read that never
      // trusts the staleness gate. A non-terminal record can have moved on
      // Persona's side since the last sync — a webhook lost at the completion
      // moment is the common case, and resuming a completed inquiry fails for
      // the wrong reason. No record is not proof of no inquiry either: a
      // record write that failed after a successful create leaves a live,
      // billable inquiry behind. One list call per click, and Persona being
      // down is a real answer here — nothing below could succeed without it.
      let record: StoredVerification | null = stored;
      let liveInquiry: PersonaInquiry | undefined;
      let listed = false;
      let announced = false;
      // A re-read that applies a transition enqueues its notifications first;
      // a queue that refuses leaves nothing persisted and is a typed answer
      // here, like Persona being down — the page rests and tries again.
      const queued = async <T>(work: () => Promise<T>): Promise<Result<T, StartVerificationError>> => {
        try {
          return ok(await work());
        } catch (cause) {
          if (cause instanceof OutboxFailure) return err({ code: 'queue_unavailable', cause: cause.cause });
          throw cause;
        }
      };
      if (!record || isNonTerminal(record.status)) {
        const refreshing = await queued(() => refreshFromPersona({ userId, flow, record, now }));
        if (!refreshing.ok) return refreshing;
        const refreshed = refreshing.value;
        if (refreshed.outcome === 'unavailable') return err({ code: 'persona_unavailable', cause: refreshed.error });
        record = refreshed.record;
        liveInquiry = refreshed.inquiry;
        listed = true;
        // A refresh that adopted or re-pointed an in-flight inquiry has already pinged operators for it.
        announced = refreshed.outcome === 'changed' && refreshed.record?.status === 'in_progress';
      }

      // -- The access policy (one exhaustive table in verification-status.ts).
      const refusal = refusalFrom(record?.status ?? 'not_started', path);
      if (refusal) return err({ code: refusal });

      // Two reasons not to resume the record's inquiry even though the policy
      // allows it: an inquiry is locked to the template version it was created
      // on, and once the app's pin has moved past it Persona's guidance is to
      // create a fresh one rather than resume the old configuration; and an
      // inquiry Persona no longer lists, or has redacted (retention, a deletion
      // request), cannot be resumed at all — Persona errors on every try.
      const outdated = !!liveInquiry?.templateVersionId && liveInquiry.templateVersionId !== flow.templateVersionId;
      const vanished = listed && !!record?.personaInquiryId && (!liveInquiry || !!liveInquiry.redacted);

      // -- Resume: same inquiry, fresh session token.
      // Persona moves an expired inquiry back to pending on resume, and resumes
      // a never-started (`created`) inquiry as well — probed in the sandbox on
      // 2026-09-04: 200, status unchanged, a session token returned — so
      // `in_progress` covers `created` and `pending` alike here.
      if (record?.personaInquiryId && canResumeFrom(record.status) && !outdated && !vanished) {
        const resumed = await persona.resumeInquiry({ inquiryId: record.personaInquiryId });
        if (!resumed.ok) return err({ code: 'persona_unavailable', cause: resumed.error });

        // Persona answers with the inquiry as it is now. Anything but "in the
        // flow" means it moved in the moment between the read above and this
        // call: apply what Persona said and let the policy answer again — a
        // `failed` inquiry is refused as `awaiting_decision` (its Workflow
        // decides it), a decided one with its decision.
        const resumedStatus = PERSONA_STATUS_TO_VERIFICATION_STATUS[resumed.value.inquiry.status];
        if (resumedStatus !== 'in_progress') {
          // An organization's inquiry decided by hand decides nothing; its case is still to come.
          if (!inquiryDecides(flow, resumedStatus)) return err({ code: 'awaiting_decision' });
          const current = record;
          const applying = await queued(() =>
            applySnapshot({
              userId,
              path,
              snapshot: fromInquiry(resumed.value.inquiry),
              sourceAt: resumed.value.inquiry.updatedAt,
              source: 'fetch',
              fetchedFor: current.personaInquiryId,
              now
            })
          );
          if (!applying.ok) return applying;
          const { record: moved } = applying.value;
          const movedRefusal = moved && refusalFrom(moved.status, path);
          if (movedRefusal) return err({ code: movedRefusal });
          record = moved;
        } else {
          // Persona's clock, like every other source timestamp, and strictly
          // after the expiry it replaces, the way the write path stamps a
          // transition: Persona's updated-at carries whole seconds, the stored
          // expiry milliseconds.
          const statusChangedAt =
            record.status === 'expired'
              ? new Date(Math.max(resumed.value.inquiry.updatedAt.getTime(), record.statusChangedAt.getTime() + 1))
              : record.statusChangedAt;
          const sourceAt = new Date(Math.max(record.sourceAt.getTime(), statusChangedAt.getTime()));
          const written = await store.write(
            { ...record, status: 'in_progress', sourceAt, statusChangedAt, lastSyncedAt: now },
            { expectVersion: record.version }
          );
          // A newer write landed meanwhile (a webhook between the read and here): it decides, not this session.
          if (written === null) {
            const latest = await store.get({ userId });
            const lateRefusal = latest && refusalFrom(latest.status, path);
            if (lateRefusal) return err({ code: lateRefusal });
          }
          if (!announced) await announceStart({ inquiryId: record.personaInquiryId, statusChangedAt });
          return ok({ inquiryId: record.personaInquiryId, sessionToken: resumed.value.sessionToken });
        }
      }

      // -- Create: not_started, or an in-flight inquiry that is outdated or
      // gone. The record is written only once Persona has the inquiry, so a
      // Persona failure leaves no trace.
      // One key per start, never reused across starts. Within this call the
      // adapter retries a create whose connection dropped with the same key,
      // so one click never makes two inquiries. Across clicks the key must be
      // fresh: Persona keeps the first answer under a key for a day, failures
      // included, and a key derived from the unchanged inputs would replay
      // one 5xx at every click until then. A create that succeeded without
      // reaching us is no duplicate risk either — the list above adopts it.
      const idempotencyKey = randomUUID();
      // The prefill, in the template's own keys. An individual's template
      // takes the person; the business template takes only the organization
      // (Persona's guidance) and leaves the people to the form. The business
      // inquiry sits on a Business-typed account, which the KYB Workflow's
      // owner relation requires.
      const fields: Record<string, string> =
        flow.path === 'organization'
          ? {
              ...(profile.entityName ? { 'business-name': profile.entityName } : {}),
              ...(profile.countryOfIncorporationCode
                ? { 'business-country-of-incorporation-code': profile.countryOfIncorporationCode }
                : {})
            }
          : {
              'name-first': profile.firstName,
              'name-last': profile.lastName,
              'email-address': profile.email,
              ...(profile.countryCode ? { 'address-country-code': profile.countryCode } : {})
            };
      const created = await persona.createInquiry({
        templateVersionId: flow.templateVersionId,
        fields,
        referenceId: userId,
        ...(flow.path === 'organization' ? { accountTypeId: flow.accountTypeId } : {}),
        idempotencyKey
      });
      if (!created.ok) return err({ code: 'persona_unavailable', cause: created.error });

      const { inquiry, sessionToken } = created.value;
      // Strictly after the last transition, like the resume stamp above: a
      // re-create can land inside the same second as the inquiry it replaces.
      const statusChangedAt = new Date(
        Math.max(inquiry.updatedAt.getTime(), (record?.statusChangedAt.getTime() ?? 0) + 1)
      );
      const written = await store.write(
        {
          userId,
          status: 'in_progress',
          personaInquiryId: inquiry.id,
          personaAccountId: inquiry.accountId,
          personaCaseId: null,
          personaCaseStatus: null,
          sourceAt: statusChangedAt,
          statusChangedAt,
          lastSyncedAt: now
        },
        { expectVersion: record?.version ?? null }
      );
      // Same race as on resume; the created inquiry is adopted by the next refresh if it is still the newest.
      if (written === null) {
        const latest = await store.get({ userId });
        const lateRefusal = latest && refusalFrom(latest.status, path);
        if (lateRefusal) return err({ code: lateRefusal });
      }
      await announceStart({ inquiryId: inquiry.id, statusChangedAt });
      return ok({ inquiryId: inquiry.id, sessionToken });
    },

    async receiveWebhook({ rawBody, signatureHeader, receivedAt }) {
      if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BODY_BYTES) return err({ code: 'oversized' });

      const signature = verifyPersonaSignature({
        rawBody,
        signatureHeader,
        secret: config.webhookSecret,
        now: receivedAt
      });
      if (!signature.ok) return err({ code: signature.error });

      const event = parsePersonaWebhookEvent(rawBody);
      if (!event) return err({ code: 'malformed' });

      // Ops events carry no inquiry and touch no status. The id is recorded
      // first so a redelivery cannot re-alert; the route captures the rest.
      if (PERSONA_OPS_EVENTS.has(event.name)) {
        try {
          const inserted = await store.recordEventIfAbsent({ eventId: event.id, receivedAt });
          if (!inserted) return ok({ outcome: 'duplicate' });
        } catch (cause) {
          return err({ code: 'store_failure', cause });
        }
        return ok({
          outcome: 'ops_alert',
          eventName: event.name,
          resourceId: event.resourceId,
          workflowId: event.workflowId
        });
      }

      // Acknowledged, unused — but each case answers with its own reason, so
      // the route can alert on the two that mean a misconfiguration and stay
      // quiet on the one that is just someone else's inquiry.
      const ignored = (reason: Exclude<WebhookIgnoredReason, InquiryAlertReason | CaseAlertReason>) =>
        ok<WebhookOutcome>({ outcome: 'ignored', reason, eventName: event.name });
      if (PERSONA_CASE_EVENTS.has(event.name)) {
        // A subscribed case event whose payload is not a case is not Persona's contract.
        if (!event.case) return err({ code: 'malformed' });
        return receiveCase({ event, kybCase: event.case, receivedAt });
      }
      if (!PERSONA_SUBSCRIBED_EVENTS.has(event.name)) return ignored('unsubscribed_event');
      // A subscribed inquiry event whose payload is not an inquiry is not Persona's contract.
      if (!event.inquiry) return err({ code: 'malformed' });
      const { referenceId } = event.inquiry;
      // Before the status check: another template's statuses are not this
      // module's drift to report. Which flow's template it must be is the
      // user's to say, below; an owner's child inquiry or a reviewer's
      // follow-up names neither flow's and stops here.
      const knownTemplate =
        !event.inquiry.templateId ||
        Object.values(config.flows).some((flow) => flow?.templateId === event.inquiry?.templateId);
      if (!knownTemplate) return ignored('foreign_inquiry');
      if (!event.inquiry.status) return ignored('unmapped_status');
      if (!referenceId || !UUID_PATTERN.test(referenceId)) return ignored('foreign_inquiry');
      // A well-formed id that is no onboarded user — deleted since, or a stray
      // UUID — is someone else's inquiry too. Without this the record's
      // foreign key would refuse the write and Persona would retry the 500
      // for two days, two dead jobs at a time. And the user's own flow must
      // own the template: an organization's inquiry on the individual
      // template is not its verification, nor the other way round.
      let flow: KycFlowConfig | KybFlowConfig | undefined;
      try {
        const profile = await store.getProfile({ userId: referenceId });
        flow = profile ? flowFor(profile.accountType) : undefined;
      } catch (cause) {
        return err({ code: 'store_failure', cause });
      }
      if (!flow || onOtherTemplate(event.inquiry, flow)) return ignored('foreign_inquiry');
      // Acknowledged and dropped, never applied: the organization's case is
      // where the decision belongs, and the route alerts so someone makes it there.
      if (!inquiryDecides(flow, PERSONA_STATUS_TO_VERIFICATION_STATUS[event.inquiry.status])) {
        return ok({
          outcome: 'ignored',
          reason: 'case_decides',
          eventName: event.name,
          userId: referenceId,
          inquiryId: event.inquiry.id
        });
      }

      try {
        // Apply first, record second: a failure in between leaves the event
        // unrecorded, so Persona's retry can still apply it. A genuine replay
        // is a no-op in the write path (`decide`, step 4) and answers `duplicate` here.
        const { outcome, record } = await applySnapshot({
          userId: referenceId,
          path: flow.path,
          snapshot: fromInquiry({ ...event.inquiry, status: event.inquiry.status }),
          sourceAt: event.createdAt,
          source: 'event',
          now: receivedAt
        });
        const inserted = await store.recordEventIfAbsent({ eventId: event.id, receivedAt });
        if (!inserted) return ok({ outcome: 'duplicate' });
        if (outcome !== 'superseded') return ok({ outcome: outcome === 'changed' ? 'applied' : 'unchanged' });
        const afterDecision = !!record && isDecision(record.status) && event.inquiry.createdAt > record.statusChangedAt;
        if (!afterDecision) return ignored('superseded_inquiry');
        return ok({
          outcome: 'ignored',
          reason: 'unadopted_inquiry',
          eventName: event.name,
          userId: referenceId,
          inquiryId: event.inquiry.id
        });
      } catch (cause) {
        if (cause instanceof OutboxFailure) return err({ code: 'outbox_failure', cause: cause.cause });
        return err({ code: 'store_failure', cause });
      }
    },

    async reconcile({ now }) {
      // Three horizons, because non-terminal records wait on different
      // people. A `submitted` or `failed` record waits on a Persona Workflow,
      // which answers in seconds: re-read at the staleness gate for a week,
      // past which it is a defect the counts below report. A `pending_review`
      // record waits on a reviewer, who may take weeks: re-read on a slow
      // cadence for a long while. A record waiting on the investor cannot
      // move until they come back, and `startVerification` fetches when they do;
      // keeping a week of abandoned flows in the batch is the largest and
      // least useful part of it.
      // A decided organization is the one terminal record re-read, on the
      // review cadence: its KYB case can be reopened.
      const syncedBefore = new Date(now.getTime() - staleAfterMs);
      const undecidedFor = (path: InvestorPath) => ({ statuses: undecidedStatusesFor(path), accountType: path });
      const batches = await Promise.all([
        // Undecided differs per flow: an organization's `failed` is terminal, nobody decides it.
        ...(['individual', 'organization'] as const).map((path) =>
          store.list({
            ...undecidedFor(path),
            syncedBefore,
            changedAfter: new Date(now.getTime() - reconcileHorizonMs),
            limit: RECONCILE_BATCH_SIZE
          })
        ),
        store.list({
          statuses: IN_REVIEW_STATUSES,
          syncedBefore: new Date(now.getTime() - reviewCadenceMs),
          changedAfter: new Date(now.getTime() - reviewHorizonMs),
          limit: RECONCILE_BATCH_SIZE
        }),
        store.list({
          statuses: AWAITING_INVESTOR_STATUSES,
          syncedBefore,
          changedAfter: new Date(now.getTime() - abandonedAfterMs),
          limit: RECONCILE_BATCH_SIZE
        }),
        // An organization's Decision can still move: a reviewer may reopen its
        // KYB case. A lost reopen webhook would leave it decided for good, so
        // decided organizations are re-read on the review cadence, for as long
        // as they hold one.
        store.list({
          statuses: DECISION_STATUSES,
          accountType: 'organization',
          syncedBefore: new Date(now.getTime() - reviewCadenceMs),
          limit: RECONCILE_BATCH_SIZE
        })
      ]);
      // Oldest sync first across all of them, then one batch cap: the budget
      // below is shared, so the queries must merge into a single queue.
      const stale = batches
        .flat()
        .sort((a, b) => a.lastSyncedAt.getTime() - b.lastSyncedAt.getTime())
        .slice(0, RECONCILE_BATCH_SIZE);

      const report: Pick<
        ReconcileReport,
        'checked' | 'changed' | 'unavailable' | 'unavailableCause' | 'errored' | 'erroredCause'
      > = {
        checked: 0,
        changed: 0,
        unavailable: 0,
        errored: 0
      };
      for (let index = 0; index < stale.length; index += RECONCILE_CONCURRENCY) {
        // Checked before a batch starts, not after it ends: a batch can hold
        // for a full Persona timeout, and one that begins past the budget
        // would run the route into the platform's limit. What does not fit
        // stays stale and drains next sweep.
        if (index > 0 && clock.now().getTime() - now.getTime() > reconcileBudgetMs) break;

        // Settled per record: one row whose persist or enqueue fails must not
        // abort the rest of the batch. It stays stale and is re-read next sweep.
        const outcomes = await Promise.allSettled(
          stale.slice(index, index + RECONCILE_CONCURRENCY).map(async (record) => {
            // An organization's row from before its flow was switched off has
            // nothing to be re-read against. Confirmed all the same, or it would
            // stay the oldest sync and take a slot at the head of every sweep.
            const flow = flowFor(record.accountType);
            if (flow) return refreshFromPersona({ userId: record.userId, flow, record, now });
            await store.markSynced({ userId: record.userId, syncedAt: now });
            return { outcome: 'unchanged' as const };
          })
        );
        for (const settled of outcomes) {
          report.checked += 1;
          if (settled.status === 'rejected') {
            report.errored += 1;
            report.erroredCause ??= settled.reason;
            continue;
          }
          const refreshed = settled.value;
          if (refreshed.outcome === 'changed') report.changed += 1;
          if (refreshed.outcome === 'unavailable') {
            report.unavailable += 1;
            report.unavailableCause ??= refreshed.error;
          }
        }
      }

      // Two conditions, not one: an undecided submission or failure is
      // something broken on Persona's side, a long review is a person who
      // has not got to it.
      // They differ in threshold, in urgency, and in who should hear about
      // it, so the report keeps them apart and the route routes them apart.
      // Counted over every record, not just the batch: a row a webhook
      // touched recently can still have waited too long.
      const undecidedBefore = new Date(now.getTime() - undecidedAfterMs);
      const reviewBefore = new Date(now.getTime() - reviewAfterMs);
      const peopleStatuses = config.flows.organization?.caseStatuses.people;
      const [undecidedIndividuals, undecidedOrganizations, inReview, awaitingOwners] = await Promise.all([
        store.count({ ...undecidedFor('individual'), changedBefore: undecidedBefore }),
        store.count({ ...undecidedFor('organization'), changedBefore: undecidedBefore }),
        store.count({ statuses: IN_REVIEW_STATUSES, changedBefore: reviewBefore }),
        // An organization whose case waits on its own owners is not the team's to act on.
        peopleStatuses
          ? store.count({
              statuses: IN_REVIEW_STATUSES,
              accountType: 'organization',
              caseStatuses: peopleStatuses,
              changedBefore: reviewBefore
            })
          : 0
      ]);
      const undecided = undecidedIndividuals + undecidedOrganizations;
      const awaitingReview = inReview - awaitingOwners;

      // Recorded events exist to answer replays; past Persona's retry
      // horizon `sourceAt` and the Decision rule are what make a late delivery harmless.
      await store.deleteEventsBefore({ receivedBefore: new Date(now.getTime() - reconcileHorizonMs) });

      return { ...report, undecided, awaitingReview, awaitingOwners };
    },

    async deliverNotification({ notification }) {
      const { userId, inquiryId, status, statusChangedAt } = notification;

      // Only the record's current transition is worth announcing — the same
      // inquiry, status AND stamp, so the job for an earlier visit to the same
      // status (approved, declined, approved again) is not taken for the
      // latest. The check is directional: a record that has moved PAST this
      // job is stale (skip), but one that has not caught UP to it yet is
      // early, and a retry will find it. The write path enqueues before it
      // persists, so "not caught up" includes no row at all (the user's first
      // transition) and a row still pointing at the inquiry this one replaced
      // — every transition is stamped strictly later than the one before it,
      // whatever the inquiry, so the timestamps order them. A job no row ever
      // catches up with dies after the queue's retries, in its failure callback.
      // A record that holds this very inquiry and status under another stamp
      // has nothing left to wait for: another write announced the same status
      // (the sweep re-applying what a webhook's failed persist left behind,
      // with Persona's whole-second stamp) or a later visit to it did.
      const record = await store.get({ userId });
      const dispatched = (sending: Promise<void>): Promise<Result<DeliveryOutcome, DeliveryError>> =>
        sending.then(
          () => ok<DeliveryOutcome>('sent'),
          (cause: unknown) => err({ code: 'send_failed', cause })
        );
      // The address is read fresh, never carried in the job: the queue's stored
      // payloads hold no email. A user gone since the enqueue has no record
      // either (the row cascades), so a missing profile is the rarer case of
      // one removed from under a record.
      const profile = await store.getProfile({ userId });
      const operatorLine = {
        userId,
        email: profile?.email ?? null,
        inquiryId,
        accountType: profile?.accountType ?? null
      };
      const recordCase =
        record?.personaCaseId && record.personaCaseStatus
          ? { id: record.personaCaseId, status: record.personaCaseStatus }
          : null;

      // A case move is written before it is enqueued, so there is no "early":
      // the row still holds that case and that raw status, or it has moved on.
      if (notification.kind === 'case_status') {
        const current =
          record?.personaInquiryId === inquiryId &&
          record.personaCaseId === notification.caseId &&
          record.personaCaseStatus === notification.caseStatus;
        if (!current) return ok('skipped');
        return dispatched(
          operatorMessages.send({
            ...operatorLine,
            kind: 'case_status',
            status: record.status,
            case: { id: notification.caseId, status: notification.caseStatus }
          })
        );
      }

      const sameStatus = record?.personaInquiryId === inquiryId && record.status === status;
      if (!sameStatus || record.statusChangedAt.getTime() !== statusChangedAt.getTime()) {
        const early = !sameStatus && (!record || record.statusChangedAt < statusChangedAt);
        return early ? err({ code: 'not_caught_up' }) : ok('skipped');
      }

      // The operator line still goes without an address — a record whose
      // profile vanished is exactly what a person should look at.
      if (notification.kind === 'operator_message') {
        return dispatched(
          operatorMessages.send({
            ...operatorLine,
            kind: 'status',
            status: notification.status,
            case: recordCase,
            ...(notification.reopenedFrom ? { reopenedFrom: notification.reopenedFrom } : {})
          })
        );
      }

      // An email with nobody to address it to; the retries end in the callback.
      if (!profile)
        return err({ code: 'send_failed', cause: new Error('No onboarding profile to address the email to') });
      return dispatched(
        statusEmails.send({
          to: profile.email,
          name: profile.firstName || undefined,
          status: notification.status,
          accountType: profile.accountType,
          caseWaitingOn: caseWaitingOnFor(record, profile.accountType),
          ...(notification.reopenedFrom ? { reopenedFrom: notification.reopenedFrom } : {}),
          inquiryId,
          statusChangedAt
        })
      );
    },

    revoke: ({ userId }) => setHumanOwned({ userId, status: 'revoked' }),

    approveManually: ({ userId }) => setHumanOwned({ userId, status: 'manually_approved' }),

    async resyncFromPersona({ userId }) {
      const now = clock.now();
      const [record, profile] = await Promise.all([store.get({ userId }), store.getProfile({ userId })]);
      if (!profile) return err({ code: 'profile_missing' });
      // An organization without a configured flow has nothing in Persona to go back to.
      const flow = flowFor(profile.accountType);
      const status = record?.status ?? 'not_started';
      const path = profile.accountType;
      if (!flow) return ok({ from: status, to: status, inquiryId: null, path, case: caseOf(record) });

      const refreshed = await refreshFromPersona({ userId, flow, record, release: true, now });
      if (refreshed.outcome === 'unavailable') return err({ code: 'persona_unavailable', cause: refreshed.error });
      return ok({
        from: status,
        to: refreshed.record?.status ?? 'not_started',
        inquiryId: refreshed.inquiry?.id ?? null,
        path,
        case: caseOf(refreshed.record)
      });
    }
  };
}
