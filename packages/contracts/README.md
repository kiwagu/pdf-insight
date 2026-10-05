# @pdf-insight/contracts

Zod schemas for the PDF Insight result JSON and the analyze HTTP API, plus the entity ids that
name an analysis and a request.

## Role in the architecture

This package is the single source of truth for the result JSON and the HTTP contract. Every other
workspace imports its types and schemas from here instead of declaring its own. The result is
validated twice: in the Edge Function after the model answers, and in the browser before it is
rendered. The package has no runtime dependencies beyond `zod` and `entity-id`, and relative
imports carry an explicit `.ts` extension, so the same source runs under Bun, Node (Vitest), Vite
and Deno.

## Key exports

- **Result**: `analysisResultSchema` (what the API returns: the model's analysis plus
  `document.fileName`, `document.pages` and a `meta` block), `analysisMetaSchema`, types
  `AnalysisResult`, `AnalysisMeta`, `DocumentType`, constant `DOCUMENT_TYPES`.
- **Model output**: `llmAnalysisSchema` (strict, validates the parsed model answer: a language
  from the ISO 639-1 list, an active or withdrawn ISO 4217 currency, `YYYY-MM-DD` dates that exist in the
  calendar, at most 7 key points) and
  `llmOutputFormatSchema` (the same shape without the date, code-list and length checks, handed
  to the model as its structured output format, since that accepts only a JSON Schema subset); type
  `LlmAnalysis`.
- **HTTP API**: `analyzeRequestSchema` (one text entry per page, at most `MAX_SCANNED_PAGES`
  scanned page images, each within the page range and at most `MAX_IMAGE_BASE64_LENGTH`
  characters of base64, page text capped at `MAX_PAGE_TEXT_LENGTH`), `scannedPageSchema`,
  `analyzeResponseSchema` (discriminated on `ok`), `apiErrorSchema`, constant `API_ERROR_CODES`;
  types `AnalyzeRequest`, `AnalyzeRequestInput`, `ScannedPage`, `AnalyzeResponse`, `ApiError`,
  `ApiErrorCode`.
- **ISO code lists**: `ISO_639_1_CODES` (all two-letter language codes, lowercase),
  `ISO_4217_CODES` (every active alphabetic currency code, uppercase, including funds, precious
  metals and the special X codes) and `ISO_4217_HISTORIC_CODES` (withdrawn codes such as `HRK`,
  `BGN`, `DEM` or `ZWL`), all sorted `as const` tuples behind the schema's enums. Currency
  validation accepts both active and withdrawn codes: an older contract or invoice carries real
  amounts in a currency that no longer exists, and that is not a model error, while an unknown code
  such as `ZZZ` still fails.
- **JSON Schema**: `analysisResultJsonSchema()` returns the result schema as JSON Schema, for
  documentation and for consumers outside TypeScript.
- **Ids**: `idRegistry` (prefixes `ana` for an analysis, `req` for a request),
  `createAnalysisId()`, `createRequestId()`, `isAnalysisId(value)`. `src/ids.ts` is the only
  module that imports `entity-id`; consumers receive plain functions. `meta.id` in the result is
  checked with a plain `ana_` pattern so that hand-written fixtures stay valid.

## Scripts

- `bun run test`: Vitest over `src/**/*.spec.ts`.
- `bun run lint`, `bun run typecheck`: ESLint and `tsc` with the shared workspace configs.
