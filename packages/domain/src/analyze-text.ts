import type { AnalyzeRequest, AnalysisResult, LlmAnalysis } from '@pdf-insight/contracts';
import {
  analysisResultSchema,
  llmAnalysisSchema,
  llmFinalAnalysisSchema,
} from '@pdf-insight/contracts';
import { chunkPages } from './chunk-pages.ts';
import type { Deadline } from './deadline.ts';
import { ModelOutputInvalidError } from './errors.ts';
import { groundAmounts } from './ground-amounts.ts';
import { mergeAnalyses } from './merge-analyses.ts';
import type { ModelCallOptions, ModelPort } from './ports.ts';
import { withOneRetry } from './retry.ts';
import { isScannedPage } from './scanned-page.ts';

export interface AnalyzeTextDeps {
  model: ModelPort;
  modelName: string;
  createId: () => string;
  now: () => Date;
  maxChunkChars: number;
  retryDelayMs: number;
  /** The budget every model call of this analysis draws on, chunks and reduce alike. */
  deadline?: Deadline;
}

const PARALLEL = 3;
const MAX_LISTED_SKIPPED_PAGES = 10;

/**
 * The 1-based numbers of the pages without a text layer that reached the model neither as text
 * nor as a scanned page image (the client renders only a capped number of them), ascending.
 */
function skippedTextlessPages(request: AnalyzeRequest): number[] {
  const imaged = new Set(request.scannedPages.map((s) => s.page));
  return request.pageTexts
    .map((text, i) => (isScannedPage(text) && !imaged.has(i + 1) ? i + 1 : null))
    .filter((page): page is number => page !== null);
}

function skippedPagesWarning(skipped: number[]): string {
  const listed = skipped.slice(0, MAX_LISTED_SKIPPED_PAGES).join(', ');
  const more = skipped.length > MAX_LISTED_SKIPPED_PAGES ? '...' : '';
  return `${skipped.length} page(s) without a text layer were not analysed: ${listed}${more}`;
}

/**
 * Runs `fn` over `items` with at most `limit` calls in flight, keeping the input order. After the
 * first rejection no worker starts another item and the returned promise rejects at once with
 * that error; calls already in flight finish on their own and their results are discarded.
 */
async function mapLimited<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const worker = async (): Promise<void> => {
    while (!failed && next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i] as T);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Checks a model answer inside the retry, so a failure triggers the one retry. The answer for the
 * whole document (the single chunk, or the reduce step) carries the summary the user reads and is
 * held to 3 to 5 sentences; a part's summary only feeds the reduce step and is not counted.
 */
function validated(output: LlmAnalysis, whole: boolean): LlmAnalysis {
  const parsed = whole
    ? llmFinalAnalysisSchema.safeParse(output)
    : llmAnalysisSchema.safeParse(output);
  if (!parsed.success) throw new ModelOutputInvalidError(parsed.error.message);
  return parsed.data;
}

export async function analyzeText(
  request: AnalyzeRequest,
  deps: AnalyzeTextDeps,
): Promise<AnalysisResult> {
  const started = deps.now();
  const chunks = chunkPages(request.pageTexts, { maxChars: deps.maxChunkChars });
  const imagesFor = (fromPage: number, toPage: number) =>
    request.scannedPages.filter((s) => s.page >= fromPage && s.page <= toPage);
  const retry = <T>(fn: (options: ModelCallOptions) => Promise<T>) =>
    withOneRetry(fn, { delayMs: deps.retryDelayMs, deadline: deps.deadline });

  const partials = await mapLimited(chunks, PARALLEL, (chunk) =>
    retry(async (options) =>
      validated(
        await deps.model.analyzeChunk(
          {
            fileName: request.fileName,
            pages: request.pages,
            chunk,
            images: imagesFor(chunk.fromPage, chunk.toPage),
            isWhole: chunks.length === 1,
          },
          options,
        ),
        chunks.length === 1,
      ),
    ),
  );

  const consolidated =
    partials.length === 1
      ? (partials[0] as LlmAnalysis)
      : mergeAnalyses([
          await retry(async (options) =>
            validated(
              await deps.model.reduce(
                { fileName: request.fileName, pages: request.pages, partials },
                options,
              ),
              true,
            ),
          ),
          ...partials,
        ]);

  const scannedPages = request.scannedPages.map((s) => s.page);
  const fullText = request.pageTexts.join('\n');
  const { analysis, dropped } = groundAmounts(consolidated, fullText, scannedPages);
  const skipped = skippedTextlessPages(request);
  const warnings = [
    ...(dropped > 0 ? [`${dropped} amount(s) dropped: value not found in the document text`] : []),
    ...(skipped.length > 0 ? [skippedPagesWarning(skipped)] : []),
  ];
  const finished = deps.now();

  return analysisResultSchema.parse({
    ...analysis,
    document: { ...analysis.document, fileName: request.fileName, pages: request.pages },
    meta: {
      id: deps.createId(),
      model: deps.modelName,
      chunks: chunks.length,
      scannedPages,
      warnings,
      durationMs: Math.max(0, finished.getTime() - started.getTime()),
      analyzedAt: finished.toISOString(),
    },
  });
}
