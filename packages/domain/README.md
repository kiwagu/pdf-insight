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
- **Errors**: `AnalysisError` (`code`, `message`, `retryable`; codes are the API error codes plus
  `invalid_file`, `too_large`, `extraction_failed`, `network`, `invalid_response`), type
  `AnalysisErrorCode`, `ModelOutputInvalidError` (always retryable) and `ModelUpstreamError`.
- **Pure functions**:
  - `isScannedPage(text)`: fewer than 20 non-whitespace characters.
  - `chunkPages(pageTexts, { maxChars })`: labels each page as `[page N]`, splits only between
    pages and keeps every chunk, separators included, within `maxChars` unless a single page is
    longer on its own, in which case that page becomes its own chunk.
  - `mergeAnalyses(partials)`: first summary, first non-null title and date, case-insensitive
    dedupe, at most 7 key points.
  - `numericTokens(text)`: exactly one value per written number. It reads an optional sign, digit
    groups of three separated by a space, no-break space, line break, dot or comma, and a decimal
    part of one or two digits, so table columns printed side by side stay separate amounts.
  - `groundAmounts(analysis, fullText, scannedPages)`: keeps an amount whose value is among those
    numbers; one that is not is kept only when its `page` is a scanned page, or when it names no
    page and the document has scanned pages, since the text layer cannot confirm what a page
    image shows.
  - `withOneRetry(fn, { delayMs })`: retries once when the error carries `retryable: true`.

## Scripts

- `bun run test`: Vitest over `src/**/*.spec.ts`.
- `bun run lint`, `bun run typecheck`: ESLint and `tsc` with the shared workspace configs.
