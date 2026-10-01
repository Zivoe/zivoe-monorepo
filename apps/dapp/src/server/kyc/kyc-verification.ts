import { randomUUID } from 'node:crypto';

import { type KycStatus } from '@zivoe/database/kyc';
import { type AccountType } from '@zivoe/database/onboarding';

import { type Result, err, ok } from '@/lib/result';

import {
  AWAITING_INVESTOR_STATUSES,
  IN_REVIEW_STATUSES,
  type KycEmailStatus,
  type KycOperatorStatus,
  type KycStatusView,
  PERSONA_STATUS_TO_KYC_STATUS,
  type PersonaInquiryStatus,
  UNDECIDED_STATUSES,
  canResumeFrom,
  canStartFrom,
  isDecision,
  isHumanOwned,
  isKycEmailStatus,
  isKycOperatorStatus,
  isNonTerminal,
  refusalFrom
} from './kyc-status';
import { parsePersonaWebhookEvent, verifyPersonaSignature } from './persona-webhook';

// ---------------------------------------------------------------------------
// KYC Verification — one module, one external seam, seven operations.
//
// Dependencies are accepted, not created: a store, a Persona API, an outbox,
// the two notification channels and a clock. Production wires Postgres /
// HTTPS / QStash / Resend / Telegram / Date; tests wire the in-memory
// adapters in kyc-verification.fakes.ts and drive the module only through
// the interface below. The vocabulary (status sets, policy, status view)
// lives in kyc-status.ts so renderers share it without this file.
// ---------------------------------------------------------------------------

/** The app's read model of one user's verification. No PII, by construction. */
export type KycVerificationRecord = {
  userId: string;
  status: KycStatus;
  personaInquiryId: string | null;
  personaAccountId: string | null;
  attemptCount: number;
  /** When `status` last changed, on Persona's clock — the regression guard compares source timestamps against it. */
  statusChangedAt: Date;
  /** When the record was last confirmed against Persona (webhook, sweep or start). */
  lastSyncedAt: Date;
};

/** What the module needs from the onboarding profile: the investor path and the prefill. */
export type KycProfile = {
  accountType: AccountType;
  firstName: string;
  lastName: string;
  email: string;
  /** ISO 3166-1 alpha-2; null when the profile's country cannot be resolved to a code. */
  countryCode: string | null;
};

/**
 * Store port — the app database. Methods reject on infrastructure failure;
 * the module decides per operation whether that is a typed error
 * (`receiveWebhook` → `store_failure`, so the caller can ask for a retry) or
 * propagates.
 */
export type KycStore = {
  get(input: { userId: string }): Promise<KycVerificationRecord | null>;
  /**
   * Insert, or update when `record.statusChangedAt` is not older than the
   * stored one and the stored status is not Human-owned; resolves whether the
   * row was written. Two writers that read the same record therefore cannot
   * roll the status back — the older source loses at the database, whatever
   * order they arrive in — and a write that read the record before an
   * operator's revocation cannot undo it. `overrideHumanOwned` is the
   * operator's word (a revocation, a resync's release), the one writer that
   * may replace a Human-owned status. `expectInquiryId` is the inquiry the
   * writer saw the record pointing at when it read (null for no record): a
   * row re-pointed meanwhile — a start replacing the inquiry while an event
   * for the old one was in flight — refuses the write, whatever its
   * timestamp, so the stale writer re-reads instead of taking the record
   * back. The insert path has no row to compare against.
   */
  upsert(
    record: KycVerificationRecord,
    options: { overrideHumanOwned?: boolean; expectInquiryId: string | null }
  ): Promise<boolean>;
  /**
   * Confirms the record against Persona — `lastSyncedAt` only, nothing else
   * — so a confirmation can never carry a stale snapshot over a concurrent
   * write. A no-op for a user without a record.
   */
  markSynced(input: { userId: string; syncedAt: Date }): Promise<void>;
  /** Insert-if-absent. Resolves true when this call inserted the id, false when it was already recorded. */
  recordEventIfAbsent(input: { eventId: string; receivedAt: Date }): Promise<boolean>;
  /** Forgets recorded events received before the cut-off; resolves how many. */
  deleteEventsBefore(input: { receivedBefore: Date }): Promise<number>;
  /**
   * Records in one of `statuses`, optionally only those last synced before
   * `syncedBefore` and/or whose status last changed inside
   * (`changedAfter`, `changedBefore`); oldest sync first, at most `limit`.
   */
  list(input: {
    statuses: ReadonlyArray<KycStatus>;
    syncedBefore?: Date;
    changedBefore?: Date;
    changedAfter?: Date;
    limit: number;
  }): Promise<Array<KycVerificationRecord>>;
  /** How many records are in one of `statuses` and changed before `changedBefore`. */
  count(input: { statuses: ReadonlyArray<KycStatus>; changedBefore: Date }): Promise<number>;
  /** Null when the user has not completed onboarding. */
  getProfile(input: { userId: string }): Promise<KycProfile | null>;
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
 * Persona port — the only external. The first three serve the flow; the last
 * two are read-only views of the dashboard's configuration, for the Drift
 * check. Every method returns a Result and never throws: the module maps any
 * failure to `persona_unavailable` and the caller decides what to tell the user.
 */
export type PersonaApi = {
  /**
   * Creates an inquiry on the pinned template version with an auto-created
   * account (by `referenceId`) and session. `idempotencyKey` names this one
   * creation: Persona answers a retry carrying the same key with the inquiry
   * it already made instead of a second one.
   */
  createInquiry(input: {
    referenceId: string;
    prefill: { firstName: string; lastName: string; email: string; countryCode: string | null };
    idempotencyKey?: string;
  }): Promise<Result<PersonaSession, PersonaApiError>>;
  /** Fresh session token for an existing inquiry; Persona moves `expired` back to `pending`. */
  resumeInquiry(input: { inquiryId: string }): Promise<Result<PersonaSession, PersonaApiError>>;
  /** Every inquiry carrying `referenceId`, newest first — unmodelled statuses included, as null. */
  listInquiries(input: { referenceId: string }): Promise<Result<Array<ParsedPersonaInquiry>, PersonaApiError>>;
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
export type KycNotification = {
  userId: string;
  inquiryId: string;
  statusChangedAt: Date;
} & ({ kind: 'status_email'; status: KycEmailStatus } | { kind: 'operator_message'; status: KycOperatorStatus });

/** Outbox port — QStash in production. Rejects on failure. */
export type Outbox = {
  enqueue(notification: KycNotification): Promise<void>;
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
    status: KycEmailStatus;
    inquiryId: string;
    statusChangedAt: Date;
  }): Promise<void>;
};

/**
 * Operator message port — the Persona Telegram channel in production. Rejects on
 * failure. `email` is read from the onboarding profile at delivery, never
 * carried in the job; null when the profile is gone, and the line still goes.
 */
export type OperatorMessenger = {
  send(input: {
    status: KycOperatorStatus;
    userId: string;
    email: string | null;
    inquiryId: string;
    attemptCount: number;
  }): Promise<void>;
};

export type Clock = { now(): Date };

// ---------------------------------------------------------------------------
// The external seam.
// ---------------------------------------------------------------------------

export type StartKycError =
  | {
      code: 'already_verified' | 'awaiting_decision' | 'declined' | 'revoked' | 'organization' | 'profile_missing';
    }
  | { code: 'persona_unavailable'; cause: PersonaApiError };

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
 * silent; `unadopted_inquiry` is a person's call and the route alerts on it.
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
  | 'unadopted_inquiry';

export type WebhookOutcome =
  /** `unchanged`: the current inquiry's event, older than or equal to what the record holds, or refused by a guard. */
  | { outcome: 'applied' | 'unchanged' | 'duplicate' }
  | { outcome: 'ignored'; reason: Exclude<WebhookIgnoredReason, 'unadopted_inquiry'>; eventName: string }
  /** Names the user and the inquiry, which the operator's resync needs. */
  | { outcome: 'ignored'; reason: 'unadopted_inquiry'; eventName: string; userId: string; inquiryId: string }
  /** An operations event: no status touched; the route alerts with the resource id. */
  | { outcome: 'ops_alert'; eventName: string; resourceId: string | null };

export type ReconcileReport = {
  /** Stale records the sweep re-read. */
  checked: number;
  changed: number;
  /** Re-reads Persona could not answer; they stay stale for the next sweep. */
  unavailable: number;
  /** Why the first of them failed — a revoked key and an outage look alike by count alone. */
  unavailableCause?: PersonaApiError;
  /** `submitted` or `failed` records past the decision threshold: a Workflow that did not run. A defect. */
  undecided: number;
  /** Records a human has not reviewed past the review threshold. A queue, not a defect. */
  awaitingReview: number;
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
export type OperatorChange = { from: KycStatus; to: KycStatus; inquiryId: string | null };

/** `conflict`: a concurrent write landed a later stamp between the read and the write — the caller's "retry". */
export type RevokeError = { code: 'profile_missing' | 'conflict' };

export type ResyncError = { code: 'profile_missing' } | { code: 'persona_unavailable'; cause: PersonaApiError };

export type KycVerification = {
  /** Local read; never calls Persona. */
  getKycStatus(input: { userId: string }): Promise<KycStatusView>;
  /** Applies the access policy, then creates or resumes the user's inquiry. */
  startKyc(input: { userId: string }): Promise<Result<{ inquiryId: string; sessionToken: string }, StartKycError>>;
  /** Verifies, applies (through the Status Write Path) and records one Persona event. */
  receiveWebhook(input: {
    rawBody: string;
    signatureHeader: string | null;
    receivedAt: Date;
  }): Promise<Result<WebhookOutcome, WebhookError>>;
  /** The Reconciliation Sweep: re-reads stale non-terminal records and reports the stuck ones. */
  reconcile(input: { now: Date }): Promise<ReconcileReport>;
  /**
   * The receiving half of the Outbox: re-reads the record, drops a job it has
   * moved past, asks for a retry of one it has not caught up with, and sends
   * the rest through the channel for the notification's kind.
   */
  deliverNotification(input: { notification: KycNotification }): Promise<Result<DeliveryOutcome, DeliveryError>>;
  /**
   * An operator's revocation — the one producer of the Human-owned `revoked`.
   * From then on no Persona event or re-read touches the record, until
   * `resyncFromPersona` releases it. A user without a record gets one, which
   * also keeps them from starting.
   */
  revoke(input: { userId: string }): Promise<Result<OperatorChange, RevokeError>>;
  /**
   * An operator's re-read of one user, whatever the record says: the one way a
   * Human-owned status is cleared, and the recovery for a Decision whose
   * change never arrived (the sweep leaves Decisions alone). The record
   * becomes what Persona holds now — never a status typed by hand, because
   * everything Persona sent while the record was Human-owned was dropped.
   */
  resyncFromPersona(input: { userId: string }): Promise<Result<OperatorChange, ResyncError>>;
};

export type KycVerificationConfig = {
  /** Persona's webhook secret for this endpoint (previews and production differ). */
  webhookSecret: string;
  /**
   * The template version the app creates inquiries on. When set, an inquiry
   * created on an older version is not resumed: Persona's guidance is to
   * create a fresh one so the investor goes through the current
   * configuration, and that costs no attempt.
   */
  templateVersionId?: string;
  /**
   * The investor template (`itmpl_…`). When set, an inquiry on any other
   * template is never the user's Inquiry, whatever reference id it carries:
   * its events are ignored and a re-read does not adopt it. A reviewer's
   * follow-up inquiry, or a KYB one, would otherwise replace the record's
   * own. An inquiry that names no template is let through.
   */
  templateId?: string;
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
   * and how often. A compliance review can take weeks and only a person can
   * move it, so these rows are re-read on a slow cadence for a long while: a
   * few reads a day, and the one lost decision webhook is still caught.
   */
  reviewHorizonMs?: number;
  reviewCadenceMs?: number;
  /**
   * How long the sweep keeps re-reading a record that waits on the INVESTOR.
   * Past this they have abandoned the flow: an expired inquiry cannot move
   * without them, and when they return `startKyc` fetches. Re-reading these
   * for the full horizon is the largest and least useful part of every batch.
   */
  abandonedAfterMs?: number;
};

export const KYC_DEFAULT_THRESHOLDS = {
  staleAfterMs: 30 * 60_000,
  undecidedAfterMs: 60 * 60_000,
  reviewAfterMs: 24 * 60 * 60_000,
  reconcileBudgetMs: 25_000,
  reconcileHorizonMs: 7 * 24 * 60 * 60_000,
  reviewHorizonMs: 45 * 24 * 60 * 60_000,
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
 * Events that never touch a Verification Status: they name something broken
 * on Persona's side (a decisioning Workflow run that errored) hours before
 * the undecided alarm could infer it. The dashboard subscription must enable
 * these alongside `PERSONA_SUBSCRIBED_EVENTS`.
 */
export const PERSONA_OPS_EVENTS = new Set(['workflow-run.errored']);

/** Persona events are a few KB; anything past this is not Persona and is not worth an HMAC. */
const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export function createKycVerification({
  store,
  persona,
  outbox,
  statusEmails,
  operatorMessages,
  clock,
  config
}: {
  store: KycStore;
  persona: PersonaApi;
  outbox: Outbox;
  statusEmails: StatusEmailSender;
  operatorMessages: OperatorMessenger;
  clock: Clock;
  config: KycVerificationConfig;
}): KycVerification {
  /**
   * The Status Write Path — the one way a Persona inquiry becomes a
   * Verification Status. Webhooks, the sweep and a start all call
   * it. `sourceAt` is the event's created-at or the inquiry's updated-at;
   * `source` says whether the inquiry is a point-in-time event (proves
   * nothing about the present) or a fetch made just now (confirms the
   * record, and is by definition the user's current inquiry).
   */
  async function applyInquiry({
    userId,
    inquiry,
    sourceAt,
    source,
    fetchedFor,
    release = false,
    now
  }: {
    userId: string;
    inquiry: PersonaInquiry;
    sourceAt: Date;
    source: 'event' | 'fetch';
    /**
     * For a fetch: the inquiry the record pointed at when the read was
     * issued (null for no record). A record that points elsewhere by the
     * time the answer arrives was re-pointed by a concurrent writer — a
     * start creating a fresh inquiry while the sweep's list call was in
     * flight — and the answer describes an inquiry that is no longer the
     * user's. Events never re-point, so they pass nothing.
     */
    fetchedFor?: string | null;
    /** An operator's resync: a Human-owned status gives way to what Persona holds. */
    release?: boolean;
    now: Date;
  }): Promise<{ outcome: 'changed' | 'unchanged' | 'superseded'; record: KycVerificationRecord | null }> {
    const mapped = PERSONA_STATUS_TO_KYC_STATUS[inquiry.status];
    const record = await store.get({ userId });

    // A stale snapshot: neither applied nor confirmed, so the next read sees
    // the present. Without this the snapshot would re-point the record at the
    // inquiry it replaced, with a timestamp manufactured to pass the store's
    // guard, and the replacement's own events would then be "superseded".
    if (source === 'fetch' && fetchedFor !== undefined && (record?.personaInquiryId ?? null) !== fetchedFor) {
      return { outcome: 'unchanged', record };
    }

    // A fetch is a read of the present: it confirms the record whatever the
    // guards decide, or a guarded record would stay stale and be re-read on
    // every sweep and every page view forever.
    const confirmed = async (outcome: 'unchanged' | 'superseded') => {
      if (source === 'fetch' && record) await store.markSynced({ userId, syncedAt: now });
      return { outcome, record };
    };

    // Guard 1: a human-owned status is never overwritten — except on an
    // operator's word, the one way a human clears it.
    const releasing = release && !!record && isHumanOwned(record.status);
    if (record && isHumanOwned(record.status) && !releasing) return confirmed('unchanged');

    // Guard 2: an older inquiry's late event cannot clobber a retry. The
    // newest inquiry under the user's reference id, fetched just now, IS the
    // current one — a record pointing elsewhere adopts it as a new attempt.
    const currentInquiry = !record?.personaInquiryId || record.personaInquiryId === inquiry.id;
    if (!currentInquiry && source === 'event') return confirmed('superseded');

    // A release skips guards 3 and 4: the Human-owned stamp is the operator's
    // clock, later than anything Persona did before it, so the comparison
    // would refuse every release.
    if (record && currentInquiry && !releasing) {
      // Guard 3: older than the last change → duplicate or out-of-order delivery.
      // Events carry milliseconds; a fetched inquiry's updated-at carries whole
      // seconds. A fetch is therefore compared at second granularity and
      // strictly — otherwise a transition inside the same second as the last
      // event could never be applied, and every later fetch would re-confirm
      // the stale status forever.
      // Guard 4: a Decision is never replaced by a non-Decision from the same inquiry.
      const older =
        source === 'event'
          ? sourceAt <= record.statusChangedAt
          : Math.floor(sourceAt.getTime() / 1000) < Math.floor(record.statusChangedAt.getTime() / 1000);
      const regresses = older || (isDecision(record.status) && !isDecision(mapped));
      if (regresses || mapped === record.status) return confirmed('unchanged');
    }

    const next: KycVerificationRecord = {
      userId,
      status: mapped,
      personaInquiryId: inquiry.id,
      personaAccountId: inquiry.accountId ?? record?.personaAccountId ?? null,
      // A record created or re-pointed here (an inquiry made outside the app) is a new attempt.
      attemptCount: currentInquiry ? (record?.attemptCount ?? 1) : (record?.attemptCount ?? 0) + 1,
      // Strictly after the last change, so the store's monotonic guard accepts
      // a same-second fetch and no two transitions ever share a timestamp —
      // the receivers tell an early job from a stale one by that ordering.
      statusChangedAt:
        record && sourceAt <= record.statusChangedAt ? new Date(record.statusChangedAt.getTime() + 1) : sourceAt,
      lastSyncedAt: now
    };

    // Enqueue before persisting. A persist failure leaves the event
    // unrecorded, so the retry (or the sweep) re-applies and re-enqueues;
    // the receivers tell an early job from a stale one by `statusChangedAt`
    // and Resend's idempotency key absorbs a genuine double send. The other
    // order has no recovery: a persisted status with a failed enqueue is
    // "unchanged" to every later pass and the email is never sent.
    const base = { userId, inquiryId: inquiry.id, statusChangedAt: next.statusChangedAt };
    // An expiry for an inquiry the app has no record of — one made in the
    // dashboard, or a start whose record write was lost — is not a nudge
    // worth sending: as far as the investor knows they never began anything.
    // The record is still created so the card and the sweep see it.
    const unseenExpiry = mapped === 'expired' && !record;
    try {
      if (isKycEmailStatus(mapped) && !unseenExpiry) {
        await outbox.enqueue({ ...base, kind: 'status_email', status: mapped });
      }
      if (isKycOperatorStatus(mapped)) await outbox.enqueue({ ...base, kind: 'operator_message', status: mapped });
    } catch (cause) {
      throw new OutboxFailure(cause);
    }

    // The store refuses a write older than what a concurrent writer landed
    // meanwhile — then the other write was the newer one and this is a no-op —
    // one whose inquiry the record no longer points at (a start replaced it
    // after the read above; the event is the old inquiry's, however late its
    // stamp) and, unless releasing, one over a Human-owned status an
    // operator set after guard 1 read the record.
    const applied = await store.upsert(next, {
      overrideHumanOwned: releasing,
      expectInquiryId: record?.personaInquiryId ?? null
    });
    return applied
      ? { outcome: 'changed', record: next }
      : { outcome: 'unchanged', record: await store.get({ userId }) };
  }

  const staleAfterMs = config.staleAfterMs ?? KYC_DEFAULT_THRESHOLDS.staleAfterMs;
  const undecidedAfterMs = config.undecidedAfterMs ?? KYC_DEFAULT_THRESHOLDS.undecidedAfterMs;
  const reviewAfterMs = config.reviewAfterMs ?? KYC_DEFAULT_THRESHOLDS.reviewAfterMs;
  const reconcileBudgetMs = config.reconcileBudgetMs ?? KYC_DEFAULT_THRESHOLDS.reconcileBudgetMs;
  const reconcileHorizonMs = config.reconcileHorizonMs ?? KYC_DEFAULT_THRESHOLDS.reconcileHorizonMs;
  const reviewHorizonMs = config.reviewHorizonMs ?? KYC_DEFAULT_THRESHOLDS.reviewHorizonMs;
  const reviewCadenceMs = config.reviewCadenceMs ?? KYC_DEFAULT_THRESHOLDS.reviewCadenceMs;
  const abandonedAfterMs = config.abandonedAfterMs ?? KYC_DEFAULT_THRESHOLDS.abandonedAfterMs;

  /** True for an inquiry that names a template other than the investor one; one that names none is let through. */
  const onOtherTemplate = (inquiry: Pick<ParsedPersonaInquiry, 'templateId'>) =>
    !!config.templateId && !!inquiry.templateId && inquiry.templateId !== config.templateId;

  /**
   * Re-reads the user's newest inquiry from Persona through the write path.
   * Persona being unavailable is not an error here — the caller answers
   * from the local record and the next read or sweep tries again.
   */
  async function refreshFromPersona({
    userId,
    record,
    release,
    now
  }: {
    userId: string;
    record: KycVerificationRecord | null;
    release?: boolean;
    now: Date;
  }): Promise<
    | {
        outcome: 'changed' | 'unchanged' | 'superseded';
        record: KycVerificationRecord | null;
        /** The inquiry that was applied, as Persona holds it now. */
        inquiry?: PersonaInquiry;
      }
    | { outcome: 'unavailable'; record: KycVerificationRecord | null; error: PersonaApiError }
  > {
    const listed = await persona.listInquiries({ referenceId: userId });
    if (!listed.ok) return { outcome: 'unavailable', record, error: listed.error };

    // Newest first, the investor template's only: a follow-up or KYB inquiry
    // under the same reference id must not replace the user's Inquiry.
    const newest = listed.value.find((inquiry) => !onOtherTemplate(inquiry));
    if (!newest) {
      // Nothing under this reference any more (retention deleted it): confirmed,
      // nothing to apply — and no `inquiry`, which a start reads as "gone".
      if (record) await store.markSynced({ userId, syncedAt: now });
      return { outcome: 'unchanged', record };
    }
    // A status the mapping does not cover on the newest inquiry is not ours
    // to interpret: the record is confirmed but not re-pointed at an older
    // inquiry, which would also charge an attempt. The webhook for the same
    // inquiry raises `unmapped_status`, which is where the drift shows.
    if (!newest.status) {
      if (record) await store.markSynced({ userId, syncedAt: now });
      const error: PersonaApiError = { reason: 'invalid_response', message: `unknown inquiry status on ${newest.id}` };
      return { outcome: 'unavailable', record, error };
    }

    const inquiry: PersonaInquiry = { ...newest, status: newest.status };
    const applied = await applyInquiry({
      userId,
      inquiry,
      sourceAt: inquiry.updatedAt,
      source: 'fetch',
      fetchedFor: record?.personaInquiryId ?? null,
      release,
      now
    });
    return { ...applied, inquiry };
  }

  return {
    // A local read, never a Persona call: webhooks and the sweep keep the
    // record honest (Persona's own guidance — webhooks plus your own store),
    // and a start re-reads Persona before it acts. A page render is neither
    // the place to spend a rate-limited call nor to wait out a Persona outage.
    async getKycStatus({ userId }) {
      const [record, profile] = await Promise.all([store.get({ userId }), store.getProfile({ userId })]);

      const status = record?.status ?? 'not_started';
      const attemptCount = record?.attemptCount ?? 0;

      // Entities are verified with the team, never through the individual
      // flow — the stored status still renders (a human may have set it).
      if (profile?.accountType === 'organization') {
        return { status, path: 'organization', canStart: false, canResume: false, inquiryId: null, attemptCount };
      }

      const canResume = canResumeFrom(status);

      return {
        status,
        path: 'individual',
        canStart: canStartFrom(status),
        canResume,
        inquiryId: canResume ? (record?.personaInquiryId ?? null) : null,
        attemptCount
      };
    },

    async startKyc({ userId }) {
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
      // Before anything else: entities never see the individual flow.
      if (profile.accountType === 'organization') return err({ code: 'organization' });

      // The policy must see the present, so this is the one read that never
      // trusts the staleness gate. A non-terminal record can have moved on
      // Persona's side since the last sync — a webhook lost at the completion
      // moment is the common case, and resuming a completed inquiry fails for
      // the wrong reason. No record is not proof of no inquiry either: a
      // record write that failed after a successful create leaves a live,
      // billable inquiry behind. One list call per click, and Persona being
      // down is a real answer here — nothing below could succeed without it.
      let record = stored;
      let liveInquiry: PersonaInquiry | undefined;
      let listed = false;
      let announced = false;
      if (!record || isNonTerminal(record.status)) {
        const refreshed = await refreshFromPersona({ userId, record, now });
        if (refreshed.outcome === 'unavailable') return err({ code: 'persona_unavailable', cause: refreshed.error });
        record = refreshed.record;
        liveInquiry = refreshed.inquiry;
        listed = true;
        // A refresh that adopted or re-pointed an in-flight inquiry has already pinged operators for it.
        announced = refreshed.outcome === 'changed' && refreshed.record?.status === 'in_progress';
      }

      // -- The access policy (one exhaustive table in kyc-status.ts).
      const refusal = refusalFrom(record?.status ?? 'not_started');
      if (refusal) return err({ code: refusal });

      // Two reasons not to resume the record's inquiry even though the policy
      // allows it, neither of them a new attempt since nothing failed: an
      // inquiry is locked to the template version it was created on, and once
      // the app's pin has moved past it Persona's guidance is to create a
      // fresh one rather than resume the old configuration; and an inquiry
      // Persona no longer lists, or has redacted (retention, a deletion
      // request), cannot be resumed at all — Persona errors on every try.
      const outdated =
        !!config.templateVersionId &&
        !!liveInquiry?.templateVersionId &&
        liveInquiry.templateVersionId !== config.templateVersionId;
      const vanished = listed && !!record?.personaInquiryId && (!liveInquiry || !!liveInquiry.redacted);

      // -- Resume: same inquiry, fresh session token, attempt count unchanged.
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
        if (PERSONA_STATUS_TO_KYC_STATUS[resumed.value.inquiry.status] !== 'in_progress') {
          const { record: moved } = await applyInquiry({
            userId,
            inquiry: resumed.value.inquiry,
            sourceAt: resumed.value.inquiry.updatedAt,
            source: 'fetch',
            fetchedFor: record.personaInquiryId,
            now
          });
          const movedRefusal = moved && refusalFrom(moved.status);
          if (movedRefusal) return err({ code: movedRefusal });
          record = moved;
        } else {
          // Persona's clock, like every other source timestamp, so the next
          // event compares against it without skew — and strictly after the
          // expiry it replaces, the way the write path stamps a transition:
          // Persona's updated-at carries whole seconds, the stored expiry
          // milliseconds, and a resume inside that same second would
          // otherwise be refused by the store's guard and leave the record
          // expired behind a live session.
          const statusChangedAt =
            record.status === 'expired'
              ? new Date(Math.max(resumed.value.inquiry.updatedAt.getTime(), record.statusChangedAt.getTime() + 1))
              : record.statusChangedAt;
          const written = await store.upsert(
            { ...record, status: 'in_progress', statusChangedAt, lastSyncedAt: now },
            { expectInquiryId: record.personaInquiryId }
          );
          // A newer write landed meanwhile (a webhook between the read and here): it decides, not this session.
          if (!written) {
            const latest = await store.get({ userId });
            const lateRefusal = latest && refusalFrom(latest.status);
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
      const created = await persona.createInquiry({
        referenceId: userId,
        prefill: {
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          countryCode: profile.countryCode
        },
        idempotencyKey
      });
      if (!created.ok) return err({ code: 'persona_unavailable', cause: created.error });

      const { inquiry, sessionToken } = created.value;
      // Strictly after the last transition, like the resume stamp above: a
      // re-create inside the same second as the inquiry it replaces would
      // otherwise be refused by the store's guard.
      const statusChangedAt = new Date(
        Math.max(inquiry.updatedAt.getTime(), (record?.statusChangedAt.getTime() ?? 0) + 1)
      );
      const written = await store.upsert(
        {
          userId,
          status: 'in_progress',
          personaInquiryId: inquiry.id,
          personaAccountId: inquiry.accountId,
          attemptCount: (record?.attemptCount ?? 0) + (outdated || vanished ? 0 : 1),
          statusChangedAt,
          lastSyncedAt: now
        },
        { expectInquiryId: record?.personaInquiryId ?? null }
      );
      // Same race as on resume; the created inquiry is adopted by the next refresh if it is still the newest.
      if (!written) {
        const latest = await store.get({ userId });
        const lateRefusal = latest && refusalFrom(latest.status);
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
        return ok({ outcome: 'ops_alert', eventName: event.name, resourceId: event.resourceId });
      }

      // Acknowledged, unused — but each case answers with its own reason, so
      // the route can alert on the two that mean a misconfiguration and stay
      // quiet on the one that is just someone else's inquiry.
      const ignored = (reason: Exclude<WebhookIgnoredReason, 'unadopted_inquiry'>) =>
        ok<WebhookOutcome>({ outcome: 'ignored', reason, eventName: event.name });
      if (!PERSONA_SUBSCRIBED_EVENTS.has(event.name)) return ignored('unsubscribed_event');
      // A subscribed inquiry event whose payload is not an inquiry is not Persona's contract.
      if (!event.inquiry) return err({ code: 'malformed' });
      const { referenceId } = event.inquiry;
      // Before the status check: another template's statuses are not this module's drift to report.
      if (onOtherTemplate(event.inquiry)) return ignored('foreign_inquiry');
      if (!event.inquiry.status) return ignored('unmapped_status');
      if (!referenceId || !UUID_PATTERN.test(referenceId)) return ignored('foreign_inquiry');
      // A well-formed id that is no onboarded user — deleted since, or a stray
      // UUID — is someone else's inquiry too. Without this the record's
      // foreign key would refuse the write and Persona would retry the 500
      // for two days, two dead jobs at a time.
      try {
        if (!(await store.getProfile({ userId: referenceId }))) return ignored('foreign_inquiry');
      } catch (cause) {
        return err({ code: 'store_failure', cause });
      }

      try {
        // Apply first, record second: a failure in between leaves the event
        // unrecorded, so Persona's retry can still apply it. A genuine replay
        // is a no-op in the write path (guard 3) and answers `duplicate` here.
        const { outcome, record } = await applyInquiry({
          userId: referenceId,
          inquiry: { ...event.inquiry, status: event.inquiry.status },
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
      // move until they come back, and `startKyc` fetches when they do;
      // keeping a week of abandoned flows in the batch is the largest and
      // least useful part of it.
      const syncedBefore = new Date(now.getTime() - staleAfterMs);
      const batches = await Promise.all([
        store.list({
          statuses: UNDECIDED_STATUSES,
          syncedBefore,
          changedAfter: new Date(now.getTime() - reconcileHorizonMs),
          limit: RECONCILE_BATCH_SIZE
        }),
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
        })
      ]);
      // Oldest sync first across all three, then one batch cap: the budget
      // below is shared, so the queries must merge into a single queue.
      const stale = batches
        .flat()
        .sort((a, b) => a.lastSyncedAt.getTime() - b.lastSyncedAt.getTime())
        .slice(0, RECONCILE_BATCH_SIZE);

      const report: Pick<ReconcileReport, 'checked' | 'changed' | 'unavailable' | 'unavailableCause'> = {
        checked: 0,
        changed: 0,
        unavailable: 0
      };
      for (let index = 0; index < stale.length; index += RECONCILE_CONCURRENCY) {
        // Checked before a batch starts, not after it ends: a batch can hold
        // for a full Persona timeout, and one that begins past the budget
        // would run the route into the platform's limit. What does not fit
        // stays stale and drains next sweep.
        if (index > 0 && clock.now().getTime() - now.getTime() > reconcileBudgetMs) break;

        const outcomes = await Promise.all(
          stale
            .slice(index, index + RECONCILE_CONCURRENCY)
            .map((record) => refreshFromPersona({ userId: record.userId, record, now }))
        );
        for (const refreshed of outcomes) {
          report.checked += 1;
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
      const [undecided, awaitingReview] = await Promise.all([
        store.count({ statuses: UNDECIDED_STATUSES, changedBefore: new Date(now.getTime() - undecidedAfterMs) }),
        store.count({ statuses: IN_REVIEW_STATUSES, changedBefore: new Date(now.getTime() - reviewAfterMs) })
      ]);

      // Recorded events exist to answer replays; past Persona's retry
      // horizon the regression guards are what make a late delivery harmless.
      await store.deleteEventsBefore({ receivedBefore: new Date(now.getTime() - reconcileHorizonMs) });

      return { ...report, undecided, awaitingReview };
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
      const sameStatus = record?.personaInquiryId === inquiryId && record.status === status;
      if (!sameStatus || record.statusChangedAt.getTime() !== statusChangedAt.getTime()) {
        const early = !sameStatus && (!record || record.statusChangedAt < statusChangedAt);
        return early ? err({ code: 'not_caught_up' }) : ok('skipped');
      }

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

      // The operator line still goes without an address — a record whose
      // profile vanished is exactly what a person should look at.
      if (notification.kind === 'operator_message') {
        return dispatched(
          operatorMessages.send({
            status: notification.status,
            userId,
            email: profile?.email ?? null,
            inquiryId,
            attemptCount: record.attemptCount
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
          inquiryId,
          statusChangedAt
        })
      );
    },

    async revoke({ userId }) {
      const now = clock.now();
      const [record, profile] = await Promise.all([store.get({ userId }), store.getProfile({ userId })]);
      if (!profile) return err({ code: 'profile_missing' });
      const inquiryId = record?.personaInquiryId ?? null;
      if (record?.status === 'revoked') return ok({ from: 'revoked', to: 'revoked', inquiryId });

      // Strictly after the last transition, like every other stamp: Persona's
      // clock may run ahead of this one, and the store refuses an older write.
      const statusChangedAt = new Date(Math.max(now.getTime(), (record?.statusChangedAt.getTime() ?? 0) + 1));
      const written = await store.upsert(
        {
          userId,
          status: 'revoked',
          personaInquiryId: inquiryId,
          personaAccountId: record?.personaAccountId ?? null,
          attemptCount: record?.attemptCount ?? 0,
          statusChangedAt,
          // Not a confirmation against Persona, so an existing sync stamp stays.
          lastSyncedAt: record?.lastSyncedAt ?? now
        },
        { overrideHumanOwned: true, expectInquiryId: inquiryId }
      );
      if (!written) return err({ code: 'conflict' });
      return ok({ from: record?.status ?? 'not_started', to: 'revoked', inquiryId });
    },

    async resyncFromPersona({ userId }) {
      const now = clock.now();
      const [record, profile] = await Promise.all([store.get({ userId }), store.getProfile({ userId })]);
      if (!profile) return err({ code: 'profile_missing' });

      const refreshed = await refreshFromPersona({ userId, record, release: true, now });
      if (refreshed.outcome === 'unavailable') return err({ code: 'persona_unavailable', cause: refreshed.error });
      return ok({
        from: record?.status ?? 'not_started',
        to: refreshed.record?.status ?? 'not_started',
        inquiryId: refreshed.inquiry?.id ?? null
      });
    }
  };
}
