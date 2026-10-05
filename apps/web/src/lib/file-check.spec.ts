import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, validatePdfFile } from './file-check';

const pdf = (bytes: string, name = 'a.pdf', type = 'application/pdf') =>
  new File([bytes], name, { type });

describe('validatePdfFile', () => {
  it('accepts a small file with the PDF magic bytes', async () => {
    expect(await validatePdfFile(pdf('%PDF-1.7 rest'))).toBeNull();
  });
  it('accepts a .pdf extension when the browser reports no mime type', async () => {
    expect(await validatePdfFile(pdf('%PDF-1.4', 'scan.pdf', ''))).toBeNull();
  });
  it('rejects a non-PDF by content even with a pdf name', async () => {
    expect((await validatePdfFile(pdf('hello', 'fake.pdf')))?.code).toBe('invalid_file');
  });
  it('rejects a file over 10 MB', async () => {
    const big = new File([new Uint8Array(MAX_FILE_BYTES + 1)], 'big.pdf', {
      type: 'application/pdf',
    });
    expect((await validatePdfFile(big))?.code).toBe('too_large');
  });
});
