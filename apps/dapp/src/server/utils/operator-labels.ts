import { type VerificationStatus } from '@zivoe/database/kyc';

import { escapeHtml } from '@/lib/utils';

/**
 * An organization as every operator message names it: "Acme LLC (id)", and "(deleted)" once it is.
 * The id is what `pnpm kyc:operator` and the database take; the name is what ops recognises. Escaped.
 */
export const organizationLabel = ({ name, id, deleted = false }: { name: string; id: string; deleted?: boolean }) =>
  `${escapeHtml(name)} (${escapeHtml(id)})${deleted ? ' (deleted)' : ''}`;

/** A verification status as ops reads it: `pending_review` is "pending review". */
export const statusLabel = (status: VerificationStatus) => status.replaceAll('_', ' ');
