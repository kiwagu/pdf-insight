import { describe, expect, it } from 'vitest';
import { createTranslator, SUPPORTED_LOCALES } from './index.ts';

describe('createTranslator', () => {
  it('returns the Polish string by default and substitutes params', () => {
    const t = createTranslator('pl');
    expect(t('progress.pages', { pages: 12 })).toBe('Stron: 12');
  });
  it('returns the English string for en', () => {
    expect(createTranslator('en')('json.copy')).toBe('Copy');
  });
  it('returns the key itself when a string is missing, so a gap is visible', () => {
    const t = createTranslator('pl');
    expect(t('does.not.exist' as never)).toBe('does.not.exist');
  });
  it('supports exactly pl and en', () => {
    expect(SUPPORTED_LOCALES).toEqual(['pl', 'en']);
  });
});
