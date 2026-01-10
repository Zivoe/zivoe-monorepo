import { getCode, getData } from 'country-list';

function getFlagEmoji(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export const COUNTRIES = getData().map((c) => {
  const code = getCode(c.name) || '';
  return {
    value: c.name,
    label: c.name,
    code,
    flag: code ? getFlagEmoji(code) : ''
  };
});

export type Country = (typeof COUNTRIES)[number];
