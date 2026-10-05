import { AnalysisError } from '@pdf-insight/domain';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function validatePdfFile(file: File): Promise<AnalysisError | null> {
  if (file.size > MAX_FILE_BYTES) {
    return new AnalysisError('too_large', 'File exceeds 10 MB.', false);
  }
  const looksPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!looksPdf) return new AnalysisError('invalid_file', 'Not a PDF file.', false);
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const magic = String.fromCharCode(...head);
  if (magic !== '%PDF-') return new AnalysisError('invalid_file', 'Not a PDF file.', false);
  return null;
}
