import { describe, expect, it } from 'vitest';
import { catalogs, missingKeys } from './index.ts';

describe('catalog parity', () => {
  it('en and pl carry exactly the same keys', () => {
    expect(missingKeys(catalogs.pl, catalogs.en)).toEqual([]);
    expect(missingKeys(catalogs.en, catalogs.pl)).toEqual([]);
  });
  it('reports the keys one catalog lacks', () => {
    expect(missingKeys({ a: '1', b: '2' }, { a: '1' })).toEqual(['b']);
  });
});
