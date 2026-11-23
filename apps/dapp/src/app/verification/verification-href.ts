import { type SubjectOption } from './account-switcher';

/** Plain `/verification` is the person themselves, so their own pages have one URL; an organization adds `?subject=`. */
export const verificationHref = ({
  organizationId,
  step
}: {
  organizationId?: string | null;
  step?: 'details' | 'agreements' | 'identity';
}) => {
  const params = new URLSearchParams();
  if (organizationId) params.set('subject', organizationId);
  if (step) params.set('step', step);
  const query = params.toString();
  return query ? `/verification?${query}` : '/verification';
};

/** The organization's id, or null for the person themselves: what `verificationHref` takes. */
export const organizationIdOf = (subject: SubjectOption) => (subject.organization ? subject.id : null);
