import { getCode, getData } from 'country-list';

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

export const COUNTRIES = getData()
  .map((c) => {
    const code = getCode(c.name) || '';
    return {
      value: c.name,
      label: c.name,
      code,
      flag: code ? getFlagEmoji(code) : ''
    };
  })
  .filter((c) => !SANCTIONED_COUNTRY_CODES.has(c.code));

export type Country = (typeof COUNTRIES)[number];
