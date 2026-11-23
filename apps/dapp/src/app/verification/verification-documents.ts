/**
 * The documents `/verification` links to. The PDFs live in `apps/dapp/documents/`, outside `public/`, and are
 * served only by `app/documents/[file]/route.ts` to a signed-in session the `kyc` flag is on for. Not
 * versioned like the terms: a changed document replaces its file. The titles are the documents' legal names.
 */

/** What the Agreements step asks a subject to read and accept, in this order. */
export const AGREEMENTS = [
  { title: 'Master Lending Agreement', href: '/documents/master-lending-agreement.pdf' },
  { title: 'Confidential Offering Memorandum', href: '/documents/confidential-offering-memorandum.pdf' },
  { title: 'Offering Supplement', href: '/documents/offering-supplement.pdf' }
] as const;

/** The template a U.S. investor's attorney, CPA, broker-dealer or adviser signs to attest their accreditation. */
export const ATTESTATION_LETTER_HREF = '/documents/accreditation-letter.pdf';

/** Every file the documents route serves, by name; anything else is a 404. */
export const DOCUMENT_FILES: ReadonlySet<string> = new Set(
  [...AGREEMENTS.map((agreement) => agreement.href), ATTESTATION_LETTER_HREF].map((href) =>
    href.slice('/documents/'.length)
  )
);
