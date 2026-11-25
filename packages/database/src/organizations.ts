/**
 * Who a Verification is about: a person (KYC) or an organization (KYB). The
 * kind picks the flow; nothing else does.
 */
export const subjectKindValues = ['individual', 'organization'] as const;
export type SubjectKind = (typeof subjectKindValues)[number];

/**
 * An invitation's stored state. Expired is not one: it is `pending` past
 * `expires_at`, computed at read, so nothing has to sweep it.
 */
export const organizationInvitationStatusValues = ['pending', 'accepted', 'declined', 'cancelled'] as const;
export type OrganizationInvitationStatus = (typeof organizationInvitationStatusValues)[number];

export const organizationInvitationCancelReasonValues = ['member', 'inviter_removed', 'organization_deleted'] as const;
export type OrganizationInvitationCancelReason = (typeof organizationInvitationCancelReasonValues)[number];
