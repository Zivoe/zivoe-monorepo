/** Caps the database holds, under the organization's row lock. */
export const MAX_ORGANIZATIONS_PER_USER = 10;
export const MAX_MEMBERS_PER_ORGANIZATION = 50;
export const MAX_PENDING_INVITATIONS_PER_ORGANIZATION = 20;

/** Invitations end on their own after a week; a resend starts the week over. */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60_000;
/** Long enough to stop a double click sending twice, short enough for "I didn't get it". */
export const RESEND_AFTER_MS = 60_000;
/** The first send and two resends: nobody keeps being asked. */
export const MAX_INVITATION_SENDS = 3;
