import { getData } from 'country-list';

function getFlagEmoji(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// ISO 3166-1 alpha-2 codes for sanctioned countries
const SANCTIONED_COUNTRY_CODES = new Set([
  'AF', // Afghanistan
  'BY', // Belarus
  'MM', // Burma (Myanmar)
  'CF', // Central African Republic
  'CU', // Cuba
  'CD', // Democratic Republic of the Congo
  'ET', // Ethiopia
  'IR', // Iran
  'IQ', // Iraq
  'LB', // Lebanon
  'LY', // Libya
  'ML', // Mali
  'NI', // Nicaragua
  'KP', // North Korea
  'RU', // Russia
  'SO', // Somalia
  'SS', // South Sudan
  'SD', // Sudan
  'SY', // Syria
  'VE', // Venezuela
  'YE' // Yemen
]);

// Everyday names a search should also find ("USA" for "United States").
const COUNTRY_ALIASES: Record<string, Array<string>> = {
  AE: ['UAE'],
  CI: ['Ivory Coast'],
  CZ: ['Czech Republic'],
  GB: ['UK', 'Britain', 'England', 'Scotland', 'Wales'],
  MO: ['Macau'],
  NL: ['Holland'],
  SZ: ['Swaziland'],
  TR: ['Turkey'],
  US: ['USA', 'America']
};

// Common English names ("United States") instead of official ISO names
// ("United States of America (the)"), so the list reads and sorts naturally.
const countryDisplayNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });

// The name of every country country-list knows, sanctioned ones included: a code stored
// before its country was sanctioned still has to read as a name in alerts and messages.
const COUNTRY_LABELS = new Map(getData().map((c) => [c.code, countryDisplayNames.of(c.code) ?? c.name]));

// value is the ISO 3166-1 alpha-2 code — that's what gets persisted. The ISO
// name stays searchable ("Saint Lucia" for "St. Lucia").
export const COUNTRIES = getData()
  .filter((c) => !SANCTIONED_COUNTRY_CODES.has(c.code))
  .map((c) => ({
    value: c.code,
    label: COUNTRY_LABELS.get(c.code) ?? c.name,
    flag: getFlagEmoji(c.code),
    aliases: [c.name, ...(COUNTRY_ALIASES[c.code] ?? [])]
  }))
  .sort((a, b) => a.label.localeCompare(b.label, 'en'));

export type Country = (typeof COUNTRIES)[number];

const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.value, c]));

export function isSupportedCountryCode(code: string): boolean {
  return COUNTRY_BY_CODE.has(code);
}

/** The country's name for a stored code; the value itself when it is not a country code. */
export function getCountryLabel(code: string): string {
  return COUNTRY_LABELS.get(code) ?? code;
}

/**
 * Lowercase letters and digits only: accents, punctuation and spaces stripped, so "Türkiye"
 * matches "turkiye", "St. Lucia" matches "st lucia" and "Guinea-Bissau" matches "guinea bissau".
 */
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase();

// Each country's searchable text, normalised once: its name, then its ISO name and aliases.
const SEARCH_INDEX = COUNTRIES.map((country) => ({
  country,
  code: country.value.toLowerCase(),
  label: normalize(country.label),
  names: [country.label, ...country.aliases].map(normalize)
}));

/**
 * The countries a search matches, best first: an exact ISO code, name or alias ("us",
 * "uk", "holland"), then names starting with the text, then aliases starting with it,
 * then any containing it. Ties keep the alphabetical order. An empty search returns
 * every country.
 */
export function searchCountries(query: string): Array<Country> {
  const q = normalize(query);
  if (!q) return COUNTRIES;

  const rank = ({ code, label, names }: (typeof SEARCH_INDEX)[number]) => {
    if (code === q || names.includes(q)) return 0;
    if (label.startsWith(q)) return 1;
    if (names.some((name) => name.startsWith(q))) return 2;
    if (names.some((name) => name.includes(q))) return 3;
    return null;
  };

  return SEARCH_INDEX.flatMap((entry) => {
    const r = rank(entry);
    return r === null ? [] : [{ country: entry.country, rank: r }];
  })
    .sort((a, b) => a.rank - b.rank)
    .map(({ country }) => country);
}
