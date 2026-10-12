/**
 * The legal PDFs, committed to the landing site's `public/legal/<version>/` and served from www.zivoe.com.
 * A version is named for the date the set was published and is its folder; every folder holds the full set and is
 * never edited once published, since earlier acceptances point to it.
 *
 * `LATEST_LEGAL_DOCS_VERSION` is the version in force: the one every link opens and every user must have
 * accepted. To publish new terms, add the new folder and point this at it in the same PR; once deployed,
 * every user is sent back to the dapp's `/terms` on their next page load.
 */
export const LATEST_LEGAL_DOCS_VERSION = '2026-10-12';

const LEGAL_DOC_FILES = {
  termsOfUse: 'terms-of-use-privacy-policy.pdf',
  regSCompliance: 'reg-s-compliance.pdf'
} as const;

export type LegalDoc = keyof typeof LEGAL_DOC_FILES;

/**
 * The site-relative path, for the landing site itself. Leave `version` out for the one in force.
 */
export function legalDocPath({ doc, version = LATEST_LEGAL_DOCS_VERSION }: { doc: LegalDoc; version?: string }) {
  return `/legal/${version}/${LEGAL_DOC_FILES[doc]}`;
}

/** The same file on the production landing site, for the dapp. */
export function legalDocUrl(input: { doc: LegalDoc; version?: string }) {
  return `https://www.zivoe.com${legalDocPath(input)}`;
}
