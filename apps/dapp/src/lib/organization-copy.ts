import { type OrganizationActionCode } from '@/server/actions/organizations';

/** What a refused organization action says. Every code the actions can answer, one sentence each. */
export const ORGANIZATION_ERROR_COPY: Record<OrganizationActionCode, string> = {
  unauthorized: 'Your session has changed. Reload the page and try again.',
  invalid_input: 'Please check the details and try again.',
  rate_limited: 'Too many attempts. Please try again later.',
  failed: 'Something went wrong. Please try again.',
  being_verified: 'This organization is being changed or verified right now. Try again in a moment.',
  too_many_organizations: 'You belong to the maximum number of organizations.',
  not_member: 'You are no longer a member of this organization.',
  locked: 'These details can no longer be changed: the organization has a verification.',
  last_member: 'You are the last member. Delete the organization instead.',
  already_removed: 'This person is no longer a member.',
  cannot_remove_self: 'To remove yourself, leave the organization instead.',
  not_last_member: 'Other members still belong to this organization.',
  unverified_email: 'Your sign-in address must be verified before you can invite anyone.',
  own_email: 'This is your email. Invite someone else.',
  not_available: "Organizations aren't open to this address yet.",
  already_member: 'Already a member.',
  already_invited: 'Already invited.',
  too_many_pending: 'Too many invitations are waiting. Cancel some first.',
  organization_full: 'This organization is full.',
  send_limit: 'This invitation has been sent the maximum number of times.',
  not_found: 'This invitation is no longer available.',
  too_soon: 'This invitation was just sent. You can send it again in a minute.'
};
