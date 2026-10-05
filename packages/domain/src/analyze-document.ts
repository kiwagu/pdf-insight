import type { AnalysisResult } from '@pdf-insight/contracts';
import { analysisResultSchema } from '@pdf-insight/contracts';
import type { Stage } from './document.ts';
import { AnalysisError } from './errors.ts';
import type { AnalysisHistory, DocumentAnalyzer, TextExtractor } from './ports.ts';
import { isScannedPage } from './scanned-page.ts';

export interface AnalyzeDocumentDeps {
  extractor: TextExtractor;
  analyzer: DocumentAnalyzer;
  history: AnalysisHistory;
  onStage: (stage: Stage, detail?: { pages?: number }) => void;
  maxScannedPages: number;
}

export async function analyzeDocument(
  file: Blob,
  deps: AnalyzeDocumentDeps,
): Promise<AnalysisResult> {
  deps.onStage('extracting');
  const doc = await deps.extractor.extract(file, { maxScannedPages: deps.maxScannedPages });
  const hasText = doc.pageTexts.some((t) => !isScannedPage(t));
  if (!hasText && doc.scannedPages.length === 0) {
    throw new AnalysisError(
      'invalid_file',
      'The PDF contains no readable text and no renderable pages.',
      false,
    );
  }
  // A fully scanned document longer than the image cap would be analysed only in part, so it is
  // refused. A document with some text keeps its partial analysis and a skipped-pages warning.
  const textless = doc.pageTexts.filter(isScannedPage).length;
  if (!hasText && textless > deps.maxScannedPages) {
    throw new AnalysisError(
      'ocr_limit',
      `The document has ${textless} pages without a text layer; at most ${deps.maxScannedPages} can be read as images.`,
      false,
      { pages: textless, max: deps.maxScannedPages },
    );
  }
  deps.onStage('analyzing', { pages: doc.pages });
  const raw = await deps.analyzer.analyze(doc);
  const parsed = analysisResultSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AnalysisError(
      'invalid_response',
      'The analysis response did not match the schema.',
      true,
    );
  }
  const result = parsed.data;
  deps.history.save({
    id: result.meta.id,
    fileName: result.document.fileName,
    analyzedAt: result.meta.analyzedAt,
    result,
  });
  return result;
}
