import { describe, expect, it } from 'vitest';
import { formatAmount, formatDateTime, formatSeconds, languageName } from './format';

describe('formatAmount', () => {
  it('groups thousands with a plain space and keeps two decimals in Polish', () => {
    expect(formatAmount(184500, 'pl')).toBe('184 500,00');
    expect(formatAmount(12300.5, 'pl')).toBe('12 300,50');
  });
  it('uses the English separators in English', () => {
    expect(formatAmount(184500, 'en')).toBe('184,500.00');
  });
});

describe('formatSeconds', () => {
  it('shows milliseconds as seconds with one decimal in the locale', () => {
    expect(formatSeconds(9000, 'pl')).toBe('9,0 s');
    expect(formatSeconds(18309, 'en')).toBe('18.3 s');
  });
});

describe('formatDateTime', () => {
  it('formats a timestamp with date and time in the locale', () => {
    const iso = '2026-10-05T12:00:00.000Z';
    const local = new Date(iso);
    const text = formatDateTime(iso, 'pl');
    expect(text).toContain(String(local.getFullYear()));
    expect(text).toContain(String(local.getMinutes()).padStart(2, '0'));
  });
  it('returns the raw value when it is not a date', () => {
    expect(formatDateTime('not a date', 'pl')).toBe('not a date');
  });
});

describe('languageName', () => {
  it('names an ISO 639-1 code in the interface language', () => {
    expect(languageName('pl', 'pl')).toBe('polski');
    expect(languageName('pl', 'en')).toBe('Polish');
  });
  it('falls back to the code when it cannot be named', () => {
    expect(languageName('', 'en')).toBe('');
  });
});
