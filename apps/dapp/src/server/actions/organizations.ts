'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { after } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { Ratelimit } from '@upstash/ratelimit';
import { createHash } from 'node:crypto';
import { z } from 'zod';

import { auth } from '@/server/auth';
import { redis } from '@/server/clients/redis';
import { getRequiredStep } from '@/server/data/auth';
import { organizations } from '@/server/organizations';
import {
  type AcceptError,
  type CreateOrganizationError,
  type DeleteOrganizationError,
  type InviteError,
  type LeaveError,
  type RemoveMemberError,
  type ResendError,
  type UpdateDetailsError,
  canonicalEmail
} from '@/server/organizations/organizations';
import { captureServerEvent } from '@/server/utils/analytics';
import { isKycEnabled, isKycEnabledForAddress } from '@/server/verification/kyc-flag';
import { whileNotStarting } from '@/server/verification/start-lock';

import { type AnalyticsEvent, type AnalyticsProperties } from '@/lib/analytics/events';
import {
  type OrganizationDetailsFormData,
  inviteMembersSchema,
  organizationDetailsSchema
} from '@/lib/schemas/organizations';

// The Organizations writes, in the shape of `wallet-link.ts`: session, the `kyc`
// flag, onboarding and terms, zod, the limits, then the module. Every answer is
// plain data the client maps to copy (`lib/organization-copy.ts`); a thrown
// failure is captured here and answered as `failed`.

export type OrganizationActionCode =
  | 'unauthorized'
  | 'invalid_input'
  | 'rate_limited'
  | 'failed'
  | 'being_verified'
  | 'not_available'
  | CreateOrganizationError['code']
  | UpdateDetailsError['code']
  | LeaveError['code']
  | RemoveMemberError['code']
  | DeleteOrganizationError['code']
  | InviteError['code']
  | ResendError['code']
  | AcceptError['code'];

export type OrganizationActionResult<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; error: { code: OrganizationActionCode } };

const limiter = (prefix: string, tokens: number, window: Parameters<typeof Ratelimit.fixedWindow>[1]) =>
  new Ratelimit({ redis, prefix: `organizations:${prefix}`, limiter: Ratelimit.fixedWindow(tokens, window) });

/**
 * A budget whose charges are given back when nothing is sent. Without Upstash's in-memory block cache: an
 * instance that saw a key over its limit would keep refusing it until the window ends (up to 30 days),
 * even once refunds elsewhere had brought it back under.
 */
const sendBudget = (prefix: string, tokens: number, window: Parameters<typeof Ratelimit.fixedWindow>[1]) =>
  new Ratelimit({
    redis,
    prefix: `organizations:${prefix}`,
    limiter: Ratelimit.fixedWindow(tokens, window),
    ephemeralCache: false
  });

// Sending invitations is what a spammer would want from this feature, so each
// email has to pass all of these: the person, the organization, the pair, the
// address across every organization, and everything at once.
const inviterBurstLimit = sendBudget('invite:inviter-burst', 10, '1 m');
const inviterLimit = sendBudget('invite:inviter-day', 100, '24 h');
const organizationLimit = sendBudget('invite:organization', 20, '24 h');
const pairLimit = sendBudget('invite:pair', 3, '30 d');
// The pair above belongs to one organization; this follows the person across the ones they make.
const inviterRecipientLimit = sendBudget('invite:inviter-recipient', 3, '30 d');
const recipientLimit = sendBudget('invite:recipient', 5, '24 h');
const globalLimit = sendBudget('invite:global', 200, '1 h');
const createLimit = limiter('create', 10, '24 h');
const writeLimit = limiter('write', 30, '10 m');
const acceptLimit = limiter('accept', 30, '10 m');
const declineLimit = limiter('decline', 20, '10 m');

/**
 * A limiter that cannot answer refuses: Upstash answers a timeout as a success with a reason. The
 * refusal reads as "Too many attempts" to the person, so it is reported: a Redis outage must not
 * pass for people spamming.
 */
async function charge(limit: Ratelimit, key: string) {
  const result = await limit.limit(key);
  if (result.reason === 'timeout') {
    Sentry.captureMessage('An organization rate limit timed out, so the action was refused', {
      level: 'warning',
      tags: { source: 'SERVER', flow: 'organization-rate-limit' }
    });
  }
  return {
    passed: result.success && result.reason !== 'timeout',
    // Redis counts a refused request too (the send budgets keep no in-memory block, so every try reaches it).
    // A timeout is taken as never reaching Redis, though it may have landed late: then it stays counted,
    // which fails closed.
    counted: result.reason !== 'timeout',
    /** When this window ends: a refund after that would come off the next window instead. */
    reset: result.reset
  };
}

const passes = async (limit: Ratelimit, key: string) => (await charge(limit, key)).passed;

const hashed = (value: string) => createHash('sha256').update(value).digest('hex');

type Budget = readonly [Ratelimit, string];
const reportBudget = (error: unknown) =>
  Sentry.captureException(error, { tags: { source: 'SERVER', flow: 'organization-invite' } });

/**
 * Sends one invitation email within every budget, each charged in one atomic step before it, so
 * requests in parallel can't overshoot any of them, and all given back when nothing went out
 * ("Already a member", a limit reached, an error), so only real sends count and a refused one never
 * uses up a colleague's or a stranger's.
 */
async function sendWithinBudgets<R extends { ok: boolean }>(
  { userId, organizationId, email }: { userId: string; organizationId: string; email: string },
  send: () => Promise<R>
): Promise<{ limited: 'budget' | 'global' } | { limited: null; result: R }> {
  const recipient = hashed(canonicalEmail(email));
  // The person's first and everyone's last: an account past its own budget never reaches the global one.
  const budgets: Array<Budget> = [
    [inviterBurstLimit, userId],
    [inviterLimit, userId],
    [organizationLimit, organizationId],
    [pairLimit, `${organizationId}:${recipient}`],
    [inviterRecipientLimit, `${userId}:${recipient}`],
    [recipientLimit, recipient],
    [globalLimit, 'all']
  ];
  // What this send counted, refused tries included, so a send that doesn't go out leaves nothing behind;
  // each given back only within its own window, never off the next one.
  const charged: Array<{ limit: Ratelimit; key: string; reset: number }> = [];
  const refund = () =>
    Promise.all(
      charged.filter(({ reset }) => Date.now() < reset).map(({ limit, key }) => limit.limit(key, { rate: -1 }))
    ).catch(reportBudget);

  try {
    for (const [limit, key] of budgets) {
      const { passed, counted, reset } = await charge(limit, key);
      if (counted) charged.push({ limit, key, reset });
      if (!passed) {
        await refund();
        return { limited: limit === globalLimit ? 'global' : 'budget' };
      }
    }
    const result = await send();
    if (!result.ok) await refund();
    return { limited: null, result };
  } catch (error) {
    await refund();
    throw error;
  }
}

/** The person these actions may run for: signed in, the flag on, onboarded, on the current terms. */
async function authorizedUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;
  if (!(await isKycEnabled({ user: session.user }))) return null;
  if (await getRequiredStep(session.user.id)) return null;
  return session.user.id;
}

async function guarded<T>(
  flow: string,
  run: (userId: string) => Promise<OrganizationActionResult<T>>,
  { revalidate = true }: { revalidate?: boolean } = {}
): Promise<OrganizationActionResult<T>> {
  const userId = await authorizedUserId();
  if (!userId) return { ok: false, error: { code: 'unauthorized' } };
  try {
    const result = await run(userId);
    // Organizations and invitations show in the Settings layout and `/verification`, which the router
    // keeps for a while: a change drops every copy, and the page the action ran on renders again with it.
    if (result.ok && revalidate) revalidatePath('/', 'layout');
    return result;
  } catch (error) {
    Sentry.captureException(error, { tags: { source: 'SERVER', flow }, extra: { userId } });
    return { ok: false, error: { code: 'failed' } };
  }
}

const refused = (code: OrganizationActionCode) => ({ ok: false, error: { code } }) as const;

/** One PostHog event for what a person did, once the answer has gone: the invite → join funnel. */
const track = (userId: string, event: AnalyticsEvent, properties: AnalyticsProperties) =>
  after(() => captureServerEvent({ distinctId: userId, event, properties }));
const idSchema = z.string().uuid();

export async function createOrganization(
  data: OrganizationDetailsFormData
): Promise<OrganizationActionResult<{ organizationId: string }>> {
  const details = organizationDetailsSchema.safeParse(data);
  if (!details.success) return refused('invalid_input');

  return guarded('organization-create', async (userId) => {
    if (!(await passes(createLimit, userId))) return refused('rate_limited');
    const result = await organizations.create({ userId, details: details.data });
    if (!result.ok) return { ok: false, error: result.error };
    track(userId, 'organization:created', { organization_id: result.value.organizationId, source: 'settings' });
    return { ok: true, value: result.value };
  });
}

/**
 * Corrects the details while the organization has no inquiry. Holds the start's
 * lock, so a name cannot change between a start reading it and Persona holding it.
 */
export async function updateOrganization(input: {
  organizationId: string;
  details: OrganizationDetailsFormData;
}): Promise<OrganizationActionResult> {
  const organizationId = idSchema.safeParse(input.organizationId);
  const details = organizationDetailsSchema.safeParse(input.details);
  if (!organizationId.success || !details.success) return refused('invalid_input');

  return guarded('organization-update', async (userId) => {
    if (!(await passes(writeLimit, userId))) return refused('rate_limited');

    const result = await whileNotStarting(organizationId.data, () =>
      organizations.updateDetails({ organizationId: organizationId.data, userId, details: details.data })
    );
    if (!result) return refused('being_verified');
    return result.ok ? { ok: true, value: undefined } : { ok: false, error: result.error };
  });
}

export async function leaveOrganization(input: { organizationId: string }): Promise<OrganizationActionResult> {
  const organizationId = idSchema.safeParse(input.organizationId);
  if (!organizationId.success) return refused('invalid_input');

  return guarded('organization-leave', async (userId) => {
    if (!(await passes(writeLimit, userId))) return refused('rate_limited');
    const result = await whileNotStarting(organizationId.data, () =>
      organizations.leave({ organizationId: organizationId.data, userId })
    );
    if (!result) return refused('being_verified');
    if (!result.ok) return { ok: false, error: result.error };
    track(userId, 'organization:left', { organization_id: organizationId.data });
    return { ok: true, value: undefined };
  });
}

/** Takes another member out. Holds the start's lock, like leaving: a start must not record them as starter after. */
export async function removeMember(input: {
  organizationId: string;
  userId: string;
}): Promise<OrganizationActionResult> {
  const organizationId = idSchema.safeParse(input.organizationId);
  const userId = idSchema.safeParse(input.userId);
  if (!organizationId.success || !userId.success) return refused('invalid_input');

  return guarded('organization-remove-member', async (actorUserId) => {
    if (!(await passes(writeLimit, actorUserId))) return refused('rate_limited');
    const result = await whileNotStarting(organizationId.data, () =>
      organizations.removeMember({ organizationId: organizationId.data, actorUserId, userId: userId.data })
    );
    if (!result) return refused('being_verified');
    if (!result.ok) return { ok: false, error: result.error };
    track(actorUserId, 'organization:member_removed', { organization_id: organizationId.data });
    return { ok: true, value: undefined };
  });
}

export async function deleteOrganization(input: { organizationId: string }): Promise<OrganizationActionResult> {
  const organizationId = idSchema.safeParse(input.organizationId);
  if (!organizationId.success) return refused('invalid_input');

  return guarded('organization-delete', async (userId) => {
    if (!(await passes(writeLimit, userId))) return refused('rate_limited');
    const result = await whileNotStarting(organizationId.data, () =>
      organizations.softDelete({ organizationId: organizationId.data, userId })
    );
    if (!result) return refused('being_verified');
    if (!result.ok) return { ok: false, error: result.error };
    track(userId, 'organization:deleted', { organization_id: organizationId.data });
    return { ok: true, value: undefined };
  });
}

export type InviteResult = { email: string; error: OrganizationActionCode | null };

/** Invites a few addresses at once. The answer for each says nothing of whether it has an account. */
export async function inviteMembers(input: {
  organizationId: string;
  emails: Array<string>;
}): Promise<OrganizationActionResult<{ results: Array<InviteResult> }>> {
  const parsed = inviteMembersSchema.safeParse(input);
  if (!parsed.success) return refused('invalid_input');
  const { organizationId } = parsed.data;
  const emails = [...new Set(parsed.data.emails)];

  return guarded(
    'organization-invite',
    async (userId) => {
      // Before the limits: nobody outside an organization gets to spend its budget.
      if (!(await organizations.canActForSubject({ userId, subjectId: organizationId }))) return refused('not_member');
      // Each try, whatever it sends: the send budgets give back what refused addresses counted, so this is
      // what stops a loop of refused invites costing Redis and the organization's lock for nothing.
      if (!(await passes(writeLimit, userId))) return refused('rate_limited');

      let hitGlobalLimit = false;
      const results: Array<InviteResult> = [];
      for (const email of emails) {
        // One address failing (a queue blip rolls its invitation back) answers for that address only: the
        // ones already sent stay reported as sent, so a retry doesn't read them as "Already invited".
        try {
          // While organizations are behind the `kyc` flag, an address outside it would follow the email to a
          // page it can't open. Matched on the address, as the flag's list is. Goes with the flag at launch.
          if (!(await isKycEnabledForAddress(email))) {
            results.push({ email, error: 'not_available' });
            continue;
          }
          const sent = await sendWithinBudgets({ userId, organizationId, email }, () =>
            organizations.invite({ organizationId, inviterUserId: userId, email })
          );
          if (sent.limited === 'global') hitGlobalLimit = true;
          results.push({
            email,
            error: sent.limited ? 'rate_limited' : sent.result.ok ? null : sent.result.error.code
          });
        } catch (error) {
          Sentry.captureException(error, {
            tags: { source: 'SERVER', flow: 'organization-invite' },
            extra: { userId, organizationId }
          });
          results.push({ email, error: 'failed' });
        }
      }

      if (hitGlobalLimit) {
        // Who and where, so whoever is alerted can tell a spam run from a busy hour.
        Sentry.captureMessage('Organization invitations hit the global limit', {
          level: 'error',
          tags: { source: 'SERVER', flow: 'organization-invite' },
          extra: { userId, organizationId, addresses: emails.length }
        });
      }
      const sent = results.filter((row) => row.error === null).length;
      if (sent > 0) {
        track(userId, 'organization:members_invited', {
          organization_id: organizationId,
          sent,
          refused: results.length - sent
        });
      }
      return { ok: true, value: { results } };
      // Nothing the inviter's cached pages show changes (Members refreshes itself), and rendering the page
      // again would move onboarding's invite step on before it shows the addresses that were refused.
    },
    { revalidate: false }
  );
}

export async function resendInvitation(input: { invitationId: string }): Promise<OrganizationActionResult> {
  const invitationId = idSchema.safeParse(input.invitationId);
  if (!invitationId.success) return refused('invalid_input');

  return guarded('organization-resend', async (userId) => {
    // A resend is an email like the first: the same budgets, so it can't get around the recipient's.
    if (!(await passes(writeLimit, userId))) return refused('rate_limited');
    const recipient = await organizations.recipientOf({ invitationId: invitationId.data, userId });
    if (!recipient) return refused('not_found');
    // As for a first send: no email to an address the `kyc` flag keeps out. Goes with the flag at launch.
    if (!(await isKycEnabledForAddress(recipient.email))) {
      return refused('not_available');
    }
    const sent = await sendWithinBudgets({ userId, ...recipient }, () =>
      organizations.resend({ invitationId: invitationId.data, userId })
    );
    if (sent.limited) return refused('rate_limited');
    if (!sent.result.ok) return { ok: false, error: sent.result.error };
    track(userId, 'organization:invitation_resent', { organization_id: recipient.organizationId });
    return { ok: true, value: undefined };
  });
}

export async function cancelInvitation(input: { invitationId: string }): Promise<OrganizationActionResult> {
  const invitationId = idSchema.safeParse(input.invitationId);
  if (!invitationId.success) return refused('invalid_input');

  return guarded('organization-cancel', async (userId) => {
    if (!(await passes(writeLimit, userId))) return refused('rate_limited');
    const result = await organizations.cancel({ invitationId: invitationId.data, userId });
    if (!result.ok) return refused('not_found');
    track(userId, 'organization:invitation_cancelled', {
      organization_id: result.value.organizationId,
      invitation_id: invitationId.data
    });
    return { ok: true, value: undefined };
  });
}

export async function acceptInvitation(input: {
  invitationId: string;
}): Promise<OrganizationActionResult<{ organizationId: string }>> {
  const invitationId = idSchema.safeParse(input.invitationId);
  if (!invitationId.success) return refused('not_found');

  return guarded('organization-accept', async (userId) => {
    if (!(await passes(acceptLimit, userId))) return refused('rate_limited');
    const result = await organizations.accept({ invitationId: invitationId.data, userId });
    if (!result.ok) return { ok: false, error: result.error };
    track(userId, 'organization:invitation_accepted', { organization_id: result.value.organizationId });
    return { ok: true, value: result.value };
  });
}

/** Turning an invitation down: only its invited address's owner, signed in, as for accepting. */
export async function declineInvitation(input: { invitationId: string }): Promise<OrganizationActionResult> {
  const invitationId = idSchema.safeParse(input.invitationId);
  if (!invitationId.success) return refused('not_found');

  return guarded('organization-decline', async (userId) => {
    if (!(await passes(declineLimit, userId))) return refused('rate_limited');
    const result = await organizations.decline({ invitationId: invitationId.data, userId });
    if (!result.ok) return { ok: false, error: result.error };
    track(userId, 'organization:invitation_declined', {
      organization_id: result.value.organizationId,
      invitation_id: invitationId.data
    });
    return { ok: true, value: undefined };
  });
}
