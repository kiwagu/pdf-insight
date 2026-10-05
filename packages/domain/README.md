# @pdf-insight/domain

The pure domain of PDF Insight: ports, chunking, merging, amount grounding, a one-retry helper and
the two analyze use cases. No IO, no framework.

## Role in the architecture

This package holds the rules of an analysis and nothing that touches the outside world. Every
side effect sits behind a port that the browser app or the serverless function implements: PDF
text extraction, the HTTP call, the history store and the language model. The use cases receive
their dependencies as arguments, including the id factory and the clock, so they run unchanged
in Vitest, in the browser and under Deno. The only runtime dependencies are
`@pdf-insight/contracts`, whose schemas validate every model answer and every result, and `zod`.
Relative imports carry an explicit `.ts` extension for Deno. The package is type-checked against
the web-standard globals (`Blob`, `setTimeout`) that both the browser and Deno provide.

## Key exports

- **Use cases**: `analyzeText(request, deps)` runs on the server side: it splits the page texts
  into chunks, analyzes them with at most three model calls in flight (after a chunk fails for
  good, no further chunk is started and the first error is rethrown), reduces several partial
  answers into one, merges the list fields, drops amounts that are neither found in the text nor
  attributable to a scanned page (with a `meta.warnings` entry) and returns a schema-checked
  `AnalysisResult`; deps `AnalyzeTextDeps { model, modelName, createId, now, maxChunkChars,
retryDelayMs }`. `analyzeDocument(file, deps)` runs in the browser: it reports the `extracting`
  and `analyzing` stages, rejects a PDF with neither readable text nor scanned pages as
  `invalid_file`, validates the analyzer's answer (`invalid_response` otherwise) and saves it to
  the history; deps `AnalyzeDocumentDeps { extractor, analyzer, history, onStage,
maxScannedPages }`.
- **Ports**: `TextExtractor`, `DocumentAnalyzer`, `AnalysisHistory`, `ModelPort` with its inputs
  `ChunkInput` and `ReduceInput`.
- **Values**: `ExtractedDocument`, `Chunk`, `HistoryEntry`, `Stage`, constants
  `DEFAULT_MAX_CHUNK_CHARS` (60 000) and `SCANNED_PAGE_MIN_CHARS` (20).
- **Errors**: `AnalysisError` (`code`, `message`, `retryable`, optional `params` for the localized
  message; codes are the API error codes plus `invalid_file`, `too_large`, `page_too_large`,
  `ocr_limit`, `extraction_failed`, `network`, `invalid_response`), type `AnalysisErrorCode`,
  `ModelOutputInvalidError` (always retryable), `ModelUpstreamError` and `AnalysisTimeoutError`.
- **Deadline**: `Deadline`, `createDeadline(budgetMs, clock)` (the clock returns epoch milliseconds), `NO_DEADLINE`, `MODEL_CALL_TIMEOUT_MS`
  (60 000) and `MIN_RETRY_BUDGET_MS` (20 000). `ModelPort` calls take `(input, { timeoutMs })`,
  `withOneRetry` takes `{ deadline }` and `analyzeText` deps take `deadline`, so every model call,
  the retry and the reduce share one budget; `withinDeadline(work, deadline, onExpire?)` bounds
  any other await (the API uses it for the body read and the rate-limit call).
- **Pure functions**:
  - `isScannedPage(text)`: fewer than 20 non-whitespace characters.
  - `chunkPages(pageTexts, { maxChars })`: labels each page as `[page N]`, splits only between
    pages and keeps every chunk, separators included, within `maxChars` unless a single page is
    longer on its own, in which case that page becomes its own chunk.
  - `mergeAnalyses(partials)`: first summary, first non-null title and date, case-insensitive
    dedupe, at most 7 key points.
  - `numericTokens(text)`: the values of the numbers written in the text. A number has an
    optional sign, digit groups of three separated by any Unicode whitespace run, a dot or a
    comma, and a decimal part of one or two digits; a group followed by `%` or a per mille sign,
    after any whitespace run, is not taken. A decimal amount gives exactly one value, so table
    columns printed side by side stay separate amounts and the groups inside an amount are never
    read on their own. An integer run grouped by whitespace also gives its shorter prefixes
    (`3 400 100` gives 3400100, 3400 and 3), because such a run may be two adjacent integers.
  - `groundAmounts(analysis, fullText, scannedPages)`: keeps an amount whose value is among those
    numbers; one that is not is kept only when its `page` is a scanned page, or when it names no
    page and the document has scanned pages, since the text layer cannot confirm what a page
    image shows.
  - `withOneRetry(fn, { delayMs })`: retries once when the error carries `retryable: true`.

## Scripts

- `bun run test`: Vitest over `src/**/*.spec.ts`.
- `bun run lint`, `bun run typecheck`: ESLint and `tsc` with the shared workspace configs.
