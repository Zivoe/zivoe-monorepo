/**
 * The agreements a person accepts once their verification is approved: public PDFs in the dapp's
 * `public/documents/agreements/<version>/`, open to anyone (the proxy lets `/documents/` through without a session).
 * A version is named for the date the set was published and is its folder; every folder holds the full set and is
 * never edited once published, since earlier acceptances point to it.
 *
 * `LATEST_AGREEMENTS_VERSION` is the version in force: the one the documents open and the one anyone who acts for
 * an approved account must have accepted. To publish new agreements, add the new folder and point this at it in the
 * same PR; once deployed, everyone who acts for an approved account is sent to `/agreements` on their next page load.
 * The titles are the documents' legal names.
 */
export const LATEST_AGREEMENTS_VERSION = '2026-11-18';

const folder = `/documents/agreements/${LATEST_AGREEMENTS_VERSION}`;

/** What a person reads and accepts, in this order. */
export const AGREEMENTS = [
  { title: 'Master Lending Agreement', href: `${folder}/master-lending-agreement.pdf` },
  { title: 'Confidential Offering Memorandum', href: `${folder}/confidential-offering-memorandum.pdf` },
  { title: 'Offering Supplement', href: `${folder}/offering-supplement.pdf` }
] as const;
