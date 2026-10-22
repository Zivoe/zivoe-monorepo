import { describe, expect, it } from 'vitest';

import { COUNTRIES, getCountryLabel, isSupportedCountryCode, searchCountries } from './countries';

const labels = (query: string) => searchCountries(query).map((c) => c.label);

// The country field filters react-aria's list by label, so two countries must never share one.
it('gives every country a distinct name', () => {
  expect(new Set(COUNTRIES.map((c) => c.label)).size).toBe(COUNTRIES.length);
});

describe('searchCountries', () => {
  it.each([
    ['a hyphen typed as a space', 'guinea bissau', 'Guinea-Bissau'],
    ['an ampersand typed as a space', 'trinidad tobago', 'Trinidad & Tobago'],
    ['an apostrophe typed as a space', 'cote d ivoire', 'Côte d’Ivoire'],
    ['no spaces at all', 'unitedstates', 'United States'],
    ['an ISO name with "and"', 'bosnia and herzegovina', 'Bosnia & Herzegovina']
  ])('matches %s', (_, query, label) => {
    expect(labels(query)).toContain(label);
  });

  it('returns every country for an empty or blank search', () => {
    expect(searchCountries('')).toBe(COUNTRIES);
    expect(searchCountries('  ')).toBe(COUNTRIES);
  });

  it.each([
    ['an ISO code', 'us', 'United States'],
    ['an alias', 'uk', 'United Kingdom'],
    ['a full name', 'niger', 'Niger']
  ])('puts an exact match on %s first', (_, query, label) => {
    expect(labels(query)[0]).toBe(label);
    expect(labels(query).length).toBeGreaterThan(1);
  });

  it('puts names starting with the text before names containing it', () => {
    const found = labels('ind');

    expect(found.slice(0, 2)).toEqual(['India', 'Indonesia']);
    expect(found).toContain('British Indian Ocean Territory');
  });

  it('keeps the alphabetical order within a rank', () => {
    expect(labels('united').slice(0, 3)).toEqual(['United Arab Emirates', 'United Kingdom', 'United States']);
  });

  it('puts names starting with the text before aliases starting with it', () => {
    // U.S. Outlying Islands matches through its ISO name, "United States Minor Outlying Islands".
    expect(labels('united')[3]).toBe('U.S. Outlying Islands');
    expect(labels('holl')[0]).toBe('Netherlands');
  });

  it('finds nothing for a sanctioned country', () => {
    expect(labels('iran')).toEqual([]);
  });
});

describe('getCountryLabel', () => {
  it('names a sanctioned country too, for alerts about codes stored earlier', () => {
    expect(getCountryLabel('RU')).toBe('Russia');
    expect(isSupportedCountryCode('RU')).toBe(false);
  });

  it('returns anything that is not a country code as is', () => {
    expect(getCountryLabel('XX')).toBe('XX');
    expect(getCountryLabel('')).toBe('');
  });
});
