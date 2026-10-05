import { SCANNED_PAGE_MIN_CHARS } from './document.ts';

export function isScannedPage(text: string): boolean {
  return text.replace(/\s+/g, '').length < SCANNED_PAGE_MIN_CHARS;
}
