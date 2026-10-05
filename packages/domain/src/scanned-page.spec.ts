import { describe, expect, it } from 'vitest';
import { isScannedPage } from './scanned-page.ts';

describe('isScannedPage', () => {
  it('treats an empty or whitespace-only page as scanned', () => {
    expect(isScannedPage('')).toBe(true);
    expect(isScannedPage('   \n\t ')).toBe(true);
  });
  it('treats a page with fewer than 20 non-whitespace characters as scanned', () => {
    expect(isScannedPage('Strona 11 z 12')).toBe(true);
  });
  it('treats a short but real page as text', () => {
    expect(isScannedPage('Podpisy Stron: Anna Kowalczyk, Prezes Zarzadu')).toBe(false);
  });
});
