/**
 * The documents `/verification` links to: public PDFs in the dapp's `public/documents/`, open to anyone (the
 * proxy lets `/documents/` through without a session). Not versioned like the terms: a changed document
 * replaces its file. The titles are the documents' legal names.
 */

/** What the Agreements step asks a subject to read and accept, in this order. */
export const AGREEMENTS = [
  { title: 'Master Lending Agreement', href: '/documents/master-lending-agreement.pdf' },
  { title: 'Confidential Offering Memorandum', href: '/documents/confidential-offering-memorandum.pdf' },
  { title: 'Offering Supplement', href: '/documents/offering-supplement.pdf' }
] as const;

/** The template a U.S. investor's attorney, CPA, broker-dealer or adviser signs to attest their accreditation. */
export const ATTESTATION_LETTER_HREF = '/documents/accreditation-letter.pdf';
