/**
 * The two documents the checklist before the Persona flow links for a U.S. investor's accreditation: public PDFs in
 * the dapp's `public/documents/`. Not versioned: nobody accepts them, so a changed one replaces its file. The
 * agreements are versioned (`@/lib/agreements`).
 */

/** The template a U.S. investor's attorney, CPA, broker-dealer or adviser signs to attest their accreditation. */
export const ATTESTATION_LETTER_HREF = '/documents/accreditation-letter.pdf';

/** The other documents that prove it, by category, for an investor proving it themselves. */
export const ACCREDITATION_DOCUMENTS_HREF = '/documents/accreditation-documents.pdf';
