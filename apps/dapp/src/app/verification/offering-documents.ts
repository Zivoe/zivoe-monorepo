/**
 * The offering documents `/verification` links to, served from the dapp's `public/documents/` (behind
 * sign-in: `proxy.ts` sends a request without a session to `/sign-in`). Not versioned like the terms: a
 * changed document replaces its file.
 */

/** What the Agreements step asks a subject to read and accept, in this order. */
export const OFFERING_AGREEMENTS = [
  { title: 'Master Lending Agreement', href: '/documents/master-lending-agreement.pdf' },
  { title: 'Confidential Offering Memorandum', href: '/documents/confidential-offering-memorandum.pdf' },
  { title: 'Offering Supplement', href: '/documents/offering-supplement.pdf' }
] as const;

/** The template a U.S. investor's attorney, CPA, broker-dealer or adviser signs to attest their accreditation. */
export const ATTESTATION_LETTER_HREF = '/documents/accreditation-letter.pdf';
