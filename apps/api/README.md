# api

The analyze function's handler: CORS, the body cap, request validation, the rate limit and the
Anthropic adapter. It is runtime-agnostic (a web-standard `Request -> Response` function) and is
tested in Node with Vitest; `supabase/functions/analyze/index.ts` is the Deno entry that wires it
to the environment and calls `Deno.serve`.

## Role in the architecture

The handler is the server half of the analysis. It accepts the page texts (and a few scanned
pages as JPEG images) that the browser extracted, checks them, and hands them to `analyzeText`
from `@pdf-insight/domain`, which chunks, calls the model, merges and validates. The model and
the rate limiter are ports (`ModelPort`, `RateLimiter`); the adapters behind them live in
`src/adapters`. Relative imports carry an explicit `.ts` extension because the same source runs
under Deno, where `supabase/functions/analyze/deno.json` maps the workspace packages by relative
path and `zod`, `entity-id` and `@anthropic-ai/sdk` as pinned `npm:` specifiers.

Request flow, in order:

1. CORS: the `Origin` header must match an entry of `ALLOWED_ORIGINS` exactly. Anything else,
   including a missing `Origin`, gets 403 `origin_forbidden` with no CORS headers. An allowed
   preflight gets 204.
2. `GET .../healthz` answers `{ "ok": true }` and consumes the rate-limit RPC under the key
   `healthz`, so a health check also keeps the database active.
3. Body cap: a declared `Content-Length` over `MAX_BODY_BYTES` is refused at once, and the body
   is read with the same cap whatever the header said (413 `payload_too_large`).
4. Validation: invalid JSON or a body that fails `analyzeRequestSchema` is 400
   `invalid_request`.
5. Rate limit: a fixed window per client address (first `X-Forwarded-For` entry) in Postgres;
   over the limit is 429 `rate_limited` with `Retry-After`. The limiter fails open, with one error
   log, when the RPC is unreachable, misses its 2 s deadline (request and body read together) or
   answers with a body that fails its schema.
6. Analysis: a model answer that fails the schema is retried once and then 502
   `analysis_failed`; an upstream failure is 503 `upstream_error`, retryable for rate limits,
   server errors and network failures.

Every response carries `x-request-id`.

## Key exports

- `createHandler(deps)` with `HandlerDeps { env, model, limiter, createRequestId,
createAnalysisId, now }`.
- `parseEnv(raw)` returning `ApiEnv`; it throws with the list of invalid variables.
- `createAnthropicModel({ apiKey, model, effort })`: a `ModelPort` over the Messages API with a
  structured-output format (the loose `llmOutputFormatSchema`), the stop reason checked before the
  answer is parsed, and the strict `llmAnalysisSchema` applied afterwards. A refusal is a
  non-retryable upstream error; a truncated, non-JSON or schema-violating answer is
  `ModelOutputInvalidError`. The SDK does no retries of its own.
  Each call runs against its own timer, derived from the deadline and kept active through body
  parsing (the request is aborted when it fires); the SDK's own timeout and that abort both
  become `AnalysisTimeoutError`. The handler bounds the body read, the rate-limit call and the
  analysis itself by the same 140 s deadline and answers 504 `analysis_timeout` (retryable) when
  it expires.
- `createPostgrestRateLimiter({ supabaseUrl, serviceRoleKey, limit, windowSeconds })`: calls the
  `consume_rate_limit` RPC from `supabase/migrations/20261005120000_rate_limits.sql`.
- `buildChunkMessages`, `buildReduceMessages`, `SYSTEM_PROMPT`: the prompt. The document text is
  wrapped in a `<document>` envelope and the system prompt tells the model never to follow
  instructions found inside it.

## Security

Before the document text and the partial answers go into their `<document>` and `<partial>`
envelopes, every literal opening or closing tag of those names in them has its `<` escaped as
`&lt;` (`escapeEnvelopeTags`), so the content can never close its envelope or open a forged one.

## Environment

| Variable                    | Default                    | Meaning                                                           |
| --------------------------- | -------------------------- | ----------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`         | (required)                 | Key for the Anthropic Messages API.                               |
| `ALLOWED_ORIGINS`           | `https://kiwagu.github.io` | Comma-separated exact origins allowed to call the API.            |
| `LLM_MODEL`                 | `claude-opus-5-5`          | Model id sent to the Messages API.                                |
| `LLM_EFFORT`                | `low`                      | Effort level: `low`, `medium` or `high`.                          |
| `MAX_BODY_BYTES`            | `6000000`                  | Largest accepted request body, in bytes.                          |
| `RATE_LIMIT_PER_MINUTE`     | `10`                       | Requests per client address per minute.                           |
| `SUPABASE_URL`              | (injected by the platform) | Base URL for the rate-limit RPC.                                  |
| `SUPABASE_SERVICE_ROLE_KEY` | (injected by the platform) | Key for the rate-limit RPC, which only the service role may call. |

The local template is `infra/dev/functions.env.example`; `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are injected by the Supabase runtime, locally and in the cloud.

## Commands

```bash
bun run test        # Vitest, Node
bun run lint
bun run typecheck
bun run serve       # the function on the local stack (see infra/dev/README.md)
```

## Deploy

`.github/workflows/deploy-api.yml` runs on pushes to `main` that touch the api, the packages or
`supabase/`: it runs the repository checks, sets the `ANTHROPIC_API_KEY` and `ALLOWED_ORIGINS`
secrets on the project and deploys the function with `supabase functions deploy analyze`. It
needs the repository secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID` and
`ANTHROPIC_API_KEY` and the variable `ALLOWED_ORIGINS`. The rate-limit migration is applied once
with `supabase db push`. `.github/workflows/keepalive.yml` calls `/healthz` every six hours (it
needs the variables `VITE_API_URL` and `ALLOWED_ORIGINS`), because a free project is paused after
a week without requests.
