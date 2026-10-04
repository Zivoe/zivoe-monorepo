import { err, ok } from '@/lib/result';

import { isHumanOwned } from './kyc-status';
import {
  type Clock,
  type KycNotification,
  type KycProfile,
  type KycStore,
  type KycVerificationRecord,
  type OperatorMessenger,
  type Outbox,
  type ParsedPersonaInquiry,
  type PersonaApi,
  type PersonaApiError,
  type PersonaInquiry,
  type PersonaWebhookConfig,
  type StatusEmailSender
} from './kyc-verification';

// ---------------------------------------------------------------------------
// In-memory adapters for the module's ports. TEST-ONLY: nothing on a
// production code path imports this file — tests drive the module through
// its interface and assert on the state these adapters expose.
// ---------------------------------------------------------------------------

export function createInMemoryKycStore() {
  const records = new Map<string, KycVerificationRecord>();
  const events = new Map<string, Date>();
  const profiles = new Map<string, KycProfile>();
  /** Armed to make the next store call (or the next call of one method) reject, to exercise `store_failure`. */
  let nextFailure: { error: Error; method?: keyof KycStore } | null = null;

  const failIfArmed = (method: keyof KycStore) => {
    if (!nextFailure || (nextFailure.method && nextFailure.method !== method)) return;
    const { error } = nextFailure;
    nextFailure = null;
    throw error;
  };

  const store: KycStore = {
    async get({ userId }) {
      failIfArmed('get');
      return records.get(userId) ?? null;
    },
    async upsert(record, { overrideHumanOwned = false, expectInquiryId }) {
      failIfArmed('upsert');
      const stored = records.get(record.userId);
      if (stored && record.statusChangedAt < stored.statusChangedAt) return false;
      if (stored && isHumanOwned(stored.status) && !overrideHumanOwned) return false;
      if (stored && stored.personaInquiryId !== expectInquiryId) return false;
      records.set(record.userId, { ...record });
      return true;
    },
    async markSynced({ userId, syncedAt }) {
      failIfArmed('markSynced');
      const stored = records.get(userId);
      if (stored) records.set(userId, { ...stored, lastSyncedAt: syncedAt });
    },
    async recordEventIfAbsent({ eventId, receivedAt }) {
      failIfArmed('recordEventIfAbsent');
      if (events.has(eventId)) return false;
      events.set(eventId, receivedAt);
      return true;
    },
    async deleteEventsBefore({ receivedBefore }) {
      failIfArmed('deleteEventsBefore');
      let deleted = 0;
      for (const [eventId, receivedAt] of events) {
        if (receivedAt < receivedBefore) {
          events.delete(eventId);
          deleted += 1;
        }
      }
      return deleted;
    },
    async list({ statuses, syncedBefore, changedBefore, changedAfter, limit }) {
      failIfArmed('list');
      return [...records.values()]
        .filter(
          (record) =>
            statuses.includes(record.status) &&
            (!syncedBefore || record.lastSyncedAt < syncedBefore) &&
            (!changedBefore || record.statusChangedAt < changedBefore) &&
            (!changedAfter || record.statusChangedAt > changedAfter)
        )
        .sort((a, b) => a.lastSyncedAt.getTime() - b.lastSyncedAt.getTime())
        .slice(0, limit);
    },
    async count({ statuses, changedBefore }) {
      failIfArmed('count');
      return [...records.values()].filter(
        (record) => statuses.includes(record.status) && record.statusChangedAt < changedBefore
      ).length;
    },
    async getProfile({ userId }) {
      failIfArmed('getProfile');
      return profiles.get(userId) ?? null;
    }
  };

  return {
    store,
    records,
    events,
    profiles,
    failNextCall(error: Error, method?: keyof KycStore) {
      nextFailure = { error, method };
    }
  };
}

/**
 * Stands in for Persona: inquiries live in a map, the dashboard's webhooks
 * and template versions in plain collections, every call is logged, and a
 * failure can be armed for the next call (or the next call of one method).
 * `sessionToken`s are derived from the inquiry id and a counter so a resume
 * visibly issues a fresh one.
 */
/** The template version the fake creates inquiries on; tests pin the module to the same one. */
export const FAKE_TEMPLATE_VERSION_ID = 'itmplv_fake';
export const FAKE_TEMPLATE_ID = 'itmpl_fake';

export function createFakePersonaApi({ clock }: { clock: Clock }) {
  /** May hold a null status, the way Persona can list an inquiry in a state the mapping does not know. */
  const inquiries = new Map<string, ParsedPersonaInquiry>();
  /** What the dashboard shows: the registered webhooks, and each template's latest published version. */
  const webhooks: Array<PersonaWebhookConfig> = [];
  const latestVersions = new Map<string, string | null>();
  const calls: Array<{ method: keyof PersonaApi; input: unknown }> = [];
  let nextFailure: { error: PersonaApiError; method?: keyof PersonaApi } | null = null;
  let sequence = 0;

  const takeFailure = (method: keyof PersonaApi) => {
    if (!nextFailure || (nextFailure.method && nextFailure.method !== method)) return null;
    const { error } = nextFailure;
    nextFailure = null;
    return error;
  };

  const persona: PersonaApi = {
    async createInquiry(input) {
      calls.push({ method: 'createInquiry', input });
      const failure = takeFailure('createInquiry');
      if (failure) return err(failure);

      sequence += 1;
      const now = clock.now();
      const inquiry: PersonaInquiry = {
        id: `inq_${sequence}`,
        status: 'created',
        referenceId: input.referenceId,
        accountId: `act_${input.referenceId}`,
        templateId: FAKE_TEMPLATE_ID,
        templateVersionId: FAKE_TEMPLATE_VERSION_ID,
        createdAt: now,
        updatedAt: now
      };
      inquiries.set(inquiry.id, inquiry);
      return ok({ inquiry, sessionToken: `session_${inquiry.id}_${sequence}` });
    },

    async resumeInquiry({ inquiryId }) {
      calls.push({ method: 'resumeInquiry', input: { inquiryId } });
      const failure = takeFailure('resumeInquiry');
      if (failure) return err(failure);

      const existing = inquiries.get(inquiryId);
      if (!existing) return err({ reason: 'http', message: 'Inquiry not found', httpStatus: 404 });
      if (existing.redacted)
        return err({ reason: 'http', message: `Inquiry ${inquiryId} is redacted`, httpStatus: 400 });
      // Persona resumes only an inquiry still in the flow; anything decided or finished is a 409.
      if (existing.status !== 'created' && existing.status !== 'pending' && existing.status !== 'expired') {
        return err({ reason: 'http', message: `Inquiry ${inquiryId} is ${existing.status}`, httpStatus: 409 });
      }

      sequence += 1;
      const inquiry: PersonaInquiry = {
        ...existing,
        status: existing.status === 'expired' ? 'pending' : existing.status,
        updatedAt: clock.now()
      };
      inquiries.set(inquiry.id, inquiry);
      return ok({ inquiry, sessionToken: `session_${inquiry.id}_${sequence}` });
    },

    async listInquiries({ referenceId }) {
      calls.push({ method: 'listInquiries', input: { referenceId } });
      const failure = takeFailure('listInquiries');
      if (failure) return err(failure);

      return ok(
        [...inquiries.values()]
          .filter((inquiry) => inquiry.referenceId === referenceId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      );
    },

    async listWebhooks() {
      calls.push({ method: 'listWebhooks', input: undefined });
      const failure = takeFailure('listWebhooks');
      if (failure) return err(failure);

      return ok(
        webhooks.map((webhook) => ({
          ...webhook,
          enabledEvents: [...webhook.enabledEvents],
          attributeBlocklist: [...webhook.attributeBlocklist]
        }))
      );
    },

    async latestPublishedVersion({ templateId }) {
      calls.push({ method: 'latestPublishedVersion', input: { templateId } });
      const failure = takeFailure('latestPublishedVersion');
      if (failure) return err(failure);

      return ok(latestVersions.get(templateId) ?? null);
    }
  };

  return {
    persona,
    inquiries,
    webhooks,
    latestVersions,
    calls,
    failNextCall(error: PersonaApiError, method?: keyof PersonaApi) {
      nextFailure = { error, method };
    },
    /** What the dashboard or a webhook would reflect: the inquiry moved on Persona's side. */
    setInquiryStatus({
      inquiryId,
      status,
      at
    }: {
      inquiryId: string;
      status: ParsedPersonaInquiry['status'];
      at?: Date;
    }) {
      const existing = inquiries.get(inquiryId);
      if (!existing) throw new Error(`No fake inquiry ${inquiryId}`);
      inquiries.set(inquiryId, { ...existing, status, updatedAt: at ?? clock.now() });
    }
  };
}

export function createInMemoryOutbox() {
  const notifications: Array<KycNotification> = [];
  let nextFailure: Error | null = null;

  const outbox: Outbox = {
    async enqueue(notification) {
      if (nextFailure) {
        const failure = nextFailure;
        nextFailure = null;
        throw failure;
      }
      notifications.push(notification);
    }
  };

  return {
    outbox,
    notifications,
    failNextCall(error: Error) {
      nextFailure = error;
    }
  };
}

export function createManualClock(start: Date) {
  let current = new Date(start);

  const clock: Clock = { now: () => new Date(current) };

  return {
    clock,
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
    set(date: Date) {
      current = new Date(date);
    }
  };
}

export function createInMemoryStatusEmailSender() {
  const sent: Array<Parameters<StatusEmailSender['send']>[0]> = [];
  let nextFailure: Error | null = null;

  const sender: StatusEmailSender = {
    async send(input) {
      if (nextFailure) {
        const failure = nextFailure;
        nextFailure = null;
        throw failure;
      }
      sent.push(input);
    }
  };

  return {
    sender,
    sent,
    failNextCall(error: Error) {
      nextFailure = error;
    }
  };
}

export function createInMemoryOperatorMessenger() {
  const sent: Array<Parameters<OperatorMessenger['send']>[0]> = [];
  let nextFailure: Error | null = null;

  const messenger: OperatorMessenger = {
    async send(input) {
      if (nextFailure) {
        const failure = nextFailure;
        nextFailure = null;
        throw failure;
      }
      sent.push(input);
    }
  };

  return {
    messenger,
    sent,
    failNextCall(error: Error) {
      nextFailure = error;
    }
  };
}
