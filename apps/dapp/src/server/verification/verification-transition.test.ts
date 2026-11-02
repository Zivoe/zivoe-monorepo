import { describe, expect, it } from 'vitest';

import { type StoredVerification, type VerificationSnapshot } from './verification';
import { KYB_CASE_STATUS_SETS } from './verification-status';
import { type SnapshotInput, decide } from './verification-transition';

// One case per rule in `decide`'s comment. The module's own tests drive the
// same rules end to end; these are the readable spec.

const T0 = new Date('2026-10-30T10:00:00.000Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

const record = (overrides: Partial<StoredVerification> = {}): StoredVerification => ({
  userId: 'u-1',
  status: 'pending_review',
  personaInquiryId: 'inq_1',
  personaAccountId: 'act_1',
  personaCaseId: 'case_1',
  personaCaseStatus: 'Open',
  sourceAt: T0,
  statusChangedAt: T0,
  lastSyncedAt: T0,
  accountType: 'organization',
  version: 3,
  ...overrides
});

const caseSnapshot = (
  status: string,
  mapped: VerificationSnapshot['status'],
  caseId = 'case_1'
): VerificationSnapshot => ({
  status: mapped,
  inquiryId: 'inq_1',
  accountId: null,
  case: { id: caseId, status }
});

const input = (overrides: Partial<SnapshotInput>): SnapshotInput => ({
  userId: 'u-1',
  path: 'organization',
  snapshot: caseSnapshot('Approved', 'approved'),
  sourceAt: at(5),
  source: 'event',
  now: at(6),
  ...overrides
});

const run = (stored: StoredVerification | null, overrides: Partial<SnapshotInput>) =>
  decide({ record: stored, input: input(overrides), caseStatuses: KYB_CASE_STATUS_SETS });

describe('decide', () => {
  it('1. changes nothing, and confirms nothing, for a read of an inquiry the record no longer follows', () => {
    expect(run(record(), { source: 'fetch', fetchedFor: 'inq_0' })).toMatchObject({ next: null, confirm: false });
  });

  it("2. keeps a Human-owned status, records the case move, and gives way only to a resync's release", () => {
    const owned = record({ status: 'revoked', personaCaseStatus: 'Approved' });
    expect(run(owned, { snapshot: caseSnapshot('Open', 'pending_review') }).next).toMatchObject({
      status: 'revoked',
      personaCaseStatus: 'Open'
    });
    expect(run(owned, { source: 'fetch', release: true, sourceAt: T0 }).next).toMatchObject({ status: 'approved' });
  });

  it('3. supersedes an event for an inquiry the record has replaced, where a read adopts the newest', () => {
    const replaced = { snapshot: { ...caseSnapshot('Approved', 'approved', 'case_2'), inquiryId: 'inq_0' } };
    expect(run(record(), replaced)).toMatchObject({ outcome: 'superseded', next: null });
    expect(run(record({ status: 'submitted' }), { ...replaced, source: 'fetch' }).next).toMatchObject({
      personaInquiryId: 'inq_0'
    });
  });

  it('4. refuses a snapshot not newer than the newest the record took; an inquiry read at whole seconds', () => {
    expect(run(record(), { sourceAt: T0 }).next).toBeNull();
    const individual = record({ personaCaseId: null, personaCaseStatus: null, sourceAt: new Date(T0.getTime() + 500) });
    const read = {
      snapshot: { status: 'approved', inquiryId: 'inq_1', accountId: null, case: null },
      source: 'fetch'
    } as const;
    // Same second as the record's millisecond stamp: newer as far as the read can tell.
    expect(run(individual, { ...read, sourceAt: T0 }).next).toMatchObject({ status: 'approved' });
    expect(run(individual, { ...read, sourceAt: at(-1) }).next).toBeNull();
  });

  it('5. keeps a Decision against anything but a reopen of its own case into a known review status', () => {
    const decided = record({ status: 'approved', personaCaseStatus: 'Approved' });
    expect(run(decided, { snapshot: caseSnapshot('Open', 'pending_review') })).toMatchObject({
      outcome: 'changed',
      next: { status: 'pending_review' },
      notifications: [
        { kind: 'status_email', previousDecision: 'approved' },
        { kind: 'operator_message', previousDecision: 'approved' }
      ]
    });
    // A status the configuration does not know keeps the Decision, and the feed hears the move.
    expect(run(decided, { snapshot: caseSnapshot('Needs more information', 'pending_review') })).toMatchObject({
      outcome: 'unchanged',
      next: { status: 'approved', personaCaseStatus: 'Needs more information' },
      caseMove: { kind: 'case_status', caseStatus: 'Needs more information' }
    });
  });

  it("6. stamps a transition strictly after the last one, and announces a case move unless it is the owners' turn", () => {
    const transition = run(record({ statusChangedAt: at(5) }), {});
    expect(transition.next?.statusChangedAt).toEqual(new Date(at(5).getTime() + 1));
    expect(transition.notifications.map((job) => job.kind)).toEqual(['status_email', 'operator_message']);

    expect(run(record(), { snapshot: caseSnapshot('Ready for Review', 'pending_review') })).toMatchObject({
      outcome: 'unchanged',
      next: { statusChangedAt: T0, sourceAt: at(5) },
      caseMove: { caseStatus: 'Ready for Review' }
    });
    expect(run(record(), { snapshot: caseSnapshot('Waiting on UBOs', 'pending_review') }).caseMove).toBeNull();
  });

  it('writes a newer case snapshot or Decision read that moves nothing for its stamp alone, and any other inquiry read not at all', () => {
    const declined = record({ status: 'declined', personaCaseStatus: 'Declined' });
    expect(run(declined, { snapshot: caseSnapshot('Declined', 'declined') }).next).toMatchObject({ sourceAt: at(5) });

    const individual = (status: 'submitted' | 'approved') =>
      record({ status, personaCaseId: null, personaCaseStatus: null, accountType: 'individual' });
    const read = (status: 'submitted' | 'approved') =>
      ({ status, inquiryId: 'inq_1', accountId: null, case: null }) as const;
    expect(run(individual('submitted'), { snapshot: read('submitted'), source: 'fetch' })).toMatchObject({
      next: null,
      confirm: true
    });
    const confirmed = run(individual('approved'), { path: 'individual', snapshot: read('approved'), source: 'fetch' });
    expect(confirmed).toMatchObject({
      outcome: 'unchanged',
      next: { status: 'approved', sourceAt: at(5), statusChangedAt: T0 },
      notifications: []
    });
  });

  it('names the Decision a reversal takes back, and none on a first decision', () => {
    const individual = { path: 'individual', source: 'event' } as const;
    const inquiry = (status: 'approved' | 'declined') =>
      ({ status, inquiryId: 'inq_1', accountId: null, case: null }) as const;
    const from = (status: 'submitted' | 'approved' | 'declined', to: 'approved' | 'declined') =>
      run(record({ status, personaCaseId: null, personaCaseStatus: null, accountType: 'individual' }), {
        ...individual,
        snapshot: inquiry(to)
      }).notifications;

    expect(from('approved', 'declined')).toEqual([
      expect.objectContaining({ kind: 'status_email', status: 'declined', previousDecision: 'approved' }),
      expect.objectContaining({ kind: 'operator_message', status: 'declined', previousDecision: 'approved' })
    ]);
    expect(
      from('declined', 'approved').map((job) => (job.kind === 'case_status' ? undefined : job.previousDecision))
    ).toEqual(['declined', 'declined']);
    expect(from('submitted', 'declined').every((job) => !('previousDecision' in job))).toBe(true);
    // A resync handing an operator's approval to Persona's decline takes an approval back.
    const released = run(
      record({ status: 'manually_approved', personaCaseId: null, personaCaseStatus: null, accountType: 'individual' }),
      { ...individual, source: 'fetch', release: true, snapshot: inquiry('declined') }
    );
    expect(
      released.notifications.map((job) => (job.kind === 'case_status' ? undefined : job.previousDecision))
    ).toEqual(['approved', 'approved']);
    // An organization's case moving straight from one Decision to the other is a reversal too.
    expect(
      run(record({ status: 'approved', personaCaseStatus: 'Approved' }), {
        snapshot: caseSnapshot('Declined', 'declined')
      }).notifications.map((job) => (job.kind === 'case_status' ? undefined : job.previousDecision))
    ).toEqual(['approved', 'approved']);
  });
});
