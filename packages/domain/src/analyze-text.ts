import type { AnalyzeRequest, AnalysisResult, LlmAnalysis } from '@pdf-insight/contracts';
import { analysisResultSchema, llmAnalysisSchema } from '@pdf-insight/contracts';
import { chunkPages } from './chunk-pages.ts';
import { ModelOutputInvalidError } from './errors.ts';
import { groundAmounts } from './ground-amounts.ts';
import { mergeAnalyses } from './merge-analyses.ts';
import type { ModelPort } from './ports.ts';
import { withOneRetry } from './retry.ts';

export interface AnalyzeTextDeps {
  model: ModelPort;
  modelName: string;
  createId: () => string;
  now: () => Date;
  maxChunkChars: number;
  retryDelayMs: number;
}

const PARALLEL = 3;

async function mapLimited<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function validated(output: LlmAnalysis): LlmAnalysis {
  const parsed = llmAnalysisSchema.safeParse(output);
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
  const retry = <T>(fn: () => Promise<T>) => withOneRetry(fn, { delayMs: deps.retryDelayMs });

  const partials = await mapLimited(chunks, PARALLEL, (chunk) =>
    retry(async () =>
      validated(
        await deps.model.analyzeChunk({
          fileName: request.fileName,
          pages: request.pages,
          chunk,
          images: imagesFor(chunk.fromPage, chunk.toPage),
          isWhole: chunks.length === 1,
        }),
      ),
    ),
  );

  const consolidated =
    partials.length === 1
      ? (partials[0] as LlmAnalysis)
      : mergeAnalyses([
          await retry(async () =>
            validated(
              await deps.model.reduce({
                fileName: request.fileName,
                pages: request.pages,
                partials,
              }),
            ),
          ),
          ...partials,
        ]);

  const scannedPages = request.scannedPages.map((s) => s.page);
  const fullText = request.pageTexts.join('\n');
  const { analysis, dropped } = groundAmounts(consolidated, fullText, scannedPages);
  const warnings =
    dropped > 0 ? [`${dropped} amount(s) dropped: value not found in the document text`] : [];
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
