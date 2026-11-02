import {
  type StoredVerification,
  type VerificationNotification,
  type VerificationRecord,
  type VerificationSnapshot
} from './verification';
import {
  type DecisionStatus,
  type InvestorPath,
  type KybCaseStatusSets,
  classifyCaseStatus,
  isDecision,
  isHumanOwned,
  isVerificationEmailStatus,
  isVerificationOperatorStatus
} from './verification-status';

// ---------------------------------------------------------------------------
// The Status Write Path's rules, as one pure function: what a Persona
// snapshot does to a record. No I/O — the module reads the record, asks
// `decide`, queues `notifications`, writes `next` against the version it
// read, and asks again if another write got there first. Every guard lives
// here and nowhere else; the store only refuses a stale version.
// ---------------------------------------------------------------------------

/** One Persona snapshot to apply: an event's, or a fresh read's. */
export type SnapshotInput = {
  userId: string;
  /** The user's flow, from the profile or the row: an organization with no row yet is still one. */
  path: InvestorPath;
  snapshot: VerificationSnapshot;
  /** Persona's clock: the event's created-at, or the resource's updated-at on a read. */
  sourceAt: Date;
  source: 'event' | 'fetch';
  /**
   * For a read: the inquiry the record pointed at when the read was issued
   * (null for no record). A record pointing elsewhere by the time the answer
   * arrives was re-pointed by a concurrent writer — a start creating a fresh
   * inquiry while the sweep's list call was in flight — and the answer
   * describes an inquiry that is no longer the user's. Events pass nothing.
   */
  fetchedFor?: string | null;
  /** An operator's resync: a Human-owned status gives way to what Persona holds. */
  release?: boolean;
  now: Date;
};

export type Transition = {
  /** `changed` is a transition (the status or the inquiry moved); a case move the status does not follow is `unchanged`. */
  outcome: 'changed' | 'unchanged' | 'superseded';
  /** The row to write; null when the snapshot changes nothing. */
  next: VerificationRecord | null;
  /** With no row to write: a read of the present, so the record is confirmed (`lastSyncedAt`) all the same. */
  confirm: boolean;
  /** The transition's compliance notifications, queued before the write: a queue that refuses fails it. */
  notifications: Array<VerificationNotification>;
  /** A raw case move worth a line in the feed, queued after the write, best effort. */
  caseMove: VerificationNotification | null;
};

/**
 * What `input` does to `record`. In order:
 *
 * 1. A read for an inquiry the record no longer follows changes nothing.
 * 2. A Human-owned status is never moved by Persona, except on an
 *    operator's resync; the case it follows is still recorded.
 * 3. An event for an inquiry the record has replaced is `superseded`.
 * 4. A snapshot not newer than the newest the record has taken
 *    (`sourceAt`) is a duplicate or out-of-order delivery. An inquiry read
 *    carries whole seconds, so it is compared at that grain, strictly. The
 *    stamp moves with every write, and with a newer case snapshot alone.
 * 5. A Decision is never replaced by a non-Decision, except by a reopen: the
 *    record's own KYB case moved into a review status the configuration
 *    knows. A status it does not know keeps the Decision (and is recorded).
 * 6. Otherwise the snapshot is the record's present. A move of status or
 *    inquiry is a transition, stamped strictly after the last one so the
 *    receivers can order their jobs; anything else is a case move, a raw
 *    status the feed hears unless it is the organization's own people's turn.
 */
export function decide({
  record,
  input,
  caseStatuses
}: {
  record: StoredVerification | null;
  input: SnapshotInput;
  /** The organization flow's case status sets; absent while KYB is not configured. */
  caseStatuses?: KybCaseStatusSets;
}): Transition {
  const { userId, path, snapshot, sourceAt, source, now } = input;
  const nothing = (outcome: 'unchanged' | 'superseded', confirm = source === 'fetch' && !!record): Transition => ({
    outcome,
    next: null,
    confirm,
    notifications: [],
    caseMove: null
  });

  // 1. A stale read: neither applied nor confirmed, so the next read sees the present.
  if (source === 'fetch' && input.fetchedFor !== undefined && (record?.personaInquiryId ?? null) !== input.fetchedFor)
    return nothing('unchanged', false);

  const releasing = !!input.release && !!record && isHumanOwned(record.status);
  const humanOwned = !!record && isHumanOwned(record.status) && !releasing;
  // The newest inquiry under the user's reference id, fetched just now, IS the
  // current one, so a read adopts it; an event never re-points the record.
  const currentInquiry = !record?.personaInquiryId || record.personaInquiryId === snapshot.inquiryId;

  // 2–3.
  if (!currentInquiry && humanOwned) return nothing('unchanged');
  if (!currentInquiry && source === 'event') return nothing('superseded');

  // 4. A release skips it: the Human-owned stamp is the operator's, and Persona's present wins over it.
  if (record && currentInquiry && !releasing) {
    const older =
      source === 'fetch' && !snapshot.case
        ? Math.floor(sourceAt.getTime() / 1000) < Math.floor(record.sourceAt.getTime() / 1000)
        : sourceAt <= record.sourceAt;
    if (older) return nothing('unchanged');
  }

  // 5.
  const caseKind =
    snapshot.case && caseStatuses ? classifyCaseStatus({ status: snapshot.case.status, sets: caseStatuses }) : null;
  // A Human-owned status is no Decision, so neither of these touches one.
  const reopen = snapshot.case?.id === record?.personaCaseId && (caseKind === 'team' || caseKind === 'people');
  const reopenedFrom: DecisionStatus | undefined =
    reopen && record && isDecision(record.status) && !isDecision(snapshot.status) ? record.status : undefined;
  const regression = !!record && isDecision(record.status) && !isDecision(snapshot.status) && !reopenedFrom;
  // A status that stands keeps the record where it is; only the case it
  // follows on that same inquiry may move, so this is never a transition.
  const sameInquiry = record?.personaInquiryId === snapshot.inquiryId;
  const keepsStatus = humanOwned || regression;
  if (keepsStatus && !(snapshot.case && sameInquiry)) return nothing('unchanged');

  // 6.
  const status = keepsStatus && record ? record.status : snapshot.status;
  // The case the row follows: the snapshot's own, else the record's while the inquiry is the same.
  const personaCaseId = snapshot.case?.id ?? (sameInquiry ? record.personaCaseId : null);
  const personaCaseStatus = snapshot.case?.status ?? (sameInquiry ? record.personaCaseStatus : null);
  const transition = status !== record?.status || !sameInquiry;
  const nextSourceAt = new Date(Math.max(sourceAt.getTime(), record?.sourceAt.getTime() ?? 0));
  const statusChangedAt = !transition
    ? record.statusChangedAt
    : record && sourceAt <= record.statusChangedAt
      ? new Date(record.statusChangedAt.getTime() + 1)
      : sourceAt;
  const caseMoved =
    !!record && (personaCaseId !== record.personaCaseId || personaCaseStatus !== record.personaCaseStatus);

  // Nothing moved. A newer case snapshot is still written for its stamp: a
  // decision reached again (declined, reopened unheard, declined) moves
  // nothing else, and only the stamp keeps a delayed approval from between
  // the two out. An inquiry's updated-at moves for reasons of its own, so
  // writing it would only churn the row.
  if (!transition && !caseMoved && (!snapshot.case || nextSourceAt.getTime() === record.sourceAt.getTime()))
    return nothing('unchanged');

  const next: VerificationRecord = {
    userId,
    status,
    personaInquiryId: snapshot.inquiryId,
    personaAccountId: snapshot.accountId ?? record?.personaAccountId ?? null,
    personaCaseId,
    personaCaseStatus,
    sourceAt: nextSourceAt,
    statusChangedAt,
    lastSyncedAt: now
  };

  if (!transition) {
    // A case move: the team's turn and a Decision moved to a status the
    // configuration does not know are each worth a line; the organization's
    // own people's turn is not, and neither is a decision reached again.
    const announced = caseMoved && caseKind !== null && caseKind !== 'people';
    return {
      outcome: 'unchanged',
      next,
      confirm: false,
      notifications: [],
      caseMove:
        announced && snapshot.case
          ? {
              kind: 'case_status',
              userId,
              inquiryId: snapshot.inquiryId,
              status,
              statusChangedAt,
              caseId: snapshot.case.id,
              caseStatus: snapshot.case.status
            }
          : null
    };
  }

  const base = { userId, inquiryId: snapshot.inquiryId, statusChangedAt, ...(reopenedFrom ? { reopenedFrom } : {}) };
  const notifications: Array<VerificationNotification> = [];
  // An expiry for an inquiry the app has no record of — one made in the
  // dashboard, or a start whose record write was lost — is not a nudge worth
  // sending: as far as the investor knows they never began anything. A
  // failure is emailed only to an organization, for whom it is the end of
  // the road; an individual's is decided by a Workflow seconds later.
  const unseenExpiry = status === 'expired' && !record;
  const individualFailure = status === 'failed' && path !== 'organization';
  if (isVerificationEmailStatus(status) && !unseenExpiry && !individualFailure)
    notifications.push({ ...base, kind: 'status_email', status });
  if (isVerificationOperatorStatus(status)) notifications.push({ ...base, kind: 'operator_message', status });

  return { outcome: 'changed', next, confirm: false, notifications, caseMove: null };
}
