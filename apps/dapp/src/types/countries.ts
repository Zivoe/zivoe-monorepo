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

// Common English names ("United States") instead of official ISO names
// ("United States of America (the)"), so the list reads and sorts naturally.
const countryDisplayNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });

// value is the ISO 3166-1 alpha-2 code — that's what gets persisted.
export const COUNTRIES = getData()
  .filter((c) => !SANCTIONED_COUNTRY_CODES.has(c.code))
  .map((c) => ({
    value: c.code,
    label: countryDisplayNames.of(c.code) ?? c.name,
    flag: getFlagEmoji(c.code)
  }))
  .sort((a, b) => a.label.localeCompare(b.label, 'en'));

export type Country = (typeof COUNTRIES)[number];

const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.value));

export function isSupportedCountryCode(code: string): boolean {
  return COUNTRY_CODES.has(code);
}
