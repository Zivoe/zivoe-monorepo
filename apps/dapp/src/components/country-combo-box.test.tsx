// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { COUNTRIES } from '@/types/countries';

import { CountryComboBox } from './country-combo-box';

// Real @zivoe/ui primitives; only the icon barrel is mocked (raw UI TSX icons do not transform here).
vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);

// jsdom ships no CSS.escape; react-aria's collections call it when keying items.
if (typeof globalThis.CSS === 'undefined') globalThis.CSS = { escape: (value: string) => value } as typeof CSS;

afterEach(cleanup);

function renderField(value = '') {
  const onChange = vi.fn();
  render(<CountryComboBox label="Country Of Residence" value={value} onChange={onChange} />);
  return { input: screen.getByRole('combobox', { name: 'Country Of Residence' }), onChange };
}

const type = (input: HTMLElement, text: string) => {
  act(() => input.focus());
  fireEvent.change(input, { target: { value: text } });
};

describe('CountryComboBox', () => {
  it('shows the picked country by name', () => {
    expect(renderField('GB').input).toHaveProperty('value', 'United Kingdom');
  });

  it.each([
    ['an accent-free spelling', 'turkiye', 'Türkiye'],
    ['an everyday alias', 'USA', 'United States'],
    ['its ISO name', 'saint lucia', 'St. Lucia'],
    ['a spelling without punctuation', 'st kitts', 'St. Kitts & Nevis'],
    ['an ISO code', 'gb', 'United Kingdom']
  ])('finds a country by %s', (_, query, country) => {
    const { input } = renderField();
    type(input, query);

    expect(screen.getByRole('option', { name: country })).toBeTruthy();
  });

  it('lists the country whose code or alias the text is first', () => {
    const { input } = renderField();
    type(input, 'us');

    expect(screen.getAllByRole('option')[0]).toHaveProperty('textContent', '🇺🇸United States');
  });

  it('shows the whole list, alphabetical, when opened from the chevron with a country picked', () => {
    renderField('GB');
    fireEvent.click(screen.getByRole('button', { name: /show suggestions/i }));

    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options.length).toBe(COUNTRIES.length);
    expect(options[0]).toBe('🇦🇽Åland Islands');
  });

  it('filters to the picked country when its name is typed out again', () => {
    const { input } = renderField('RO');
    type(input, 'Romani');
    type(input, 'Romania');

    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['🇷🇴Romania']);
  });

  it('shows the picked country again after Escape', () => {
    const { input } = renderField('RO');
    type(input, 'ger');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(input).toHaveProperty('value', 'Romania');
  });

  it('never lists a sanctioned country', () => {
    const { input } = renderField();
    type(input, 'iran');

    // The list stays open on its empty state rather than closing silently.
    expect(screen.getByText('No country matches')).toBeTruthy();
    expect(screen.queryByRole('option', { name: /iran/i })).toBeNull();
  });

  it('reports the picked country by its ISO code', () => {
    const { input, onChange } = renderField();
    type(input, 'roman');
    fireEvent.click(screen.getByRole('option', { name: 'Romania' }));

    expect(onChange).toHaveBeenCalledWith('RO');
  });

  it('picks the first match with ArrowDown and Enter', () => {
    const { input, onChange } = renderField();
    type(input, 'us');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('US');
  });

  it('reports no country when the field is cleared', () => {
    const { input, onChange } = renderField('RO');
    type(input, '');

    expect(onChange).toHaveBeenCalledWith('');
  });
});
