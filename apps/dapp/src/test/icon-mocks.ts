/**
 * Stands in for the whole `@zivoe/ui/icons` barrel in vitest suites (raw UI
 * TSX does not transform in this environment, so every suite whose graph
 * reaches the barrel must mock it). One shared allowlist, so a new icon —
 * notably a new Offering's logo — is a one-line change here instead of an
 * edit in every suite that mocks the barrel.
 */
export const BankIcon = () => null;
export const ChartIcon = () => null;
export const InfoIcon = () => null;
export const MoneyIcon = () => null;
export const TrendingIcon = () => null;
export const UsdcIcon = () => null;

// One line per Offering logo:
export const ZAltLogo = () => null;
export const ZMcaLogo = () => null;
