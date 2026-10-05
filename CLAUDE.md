# Working on PDF Insight

PDF Insight turns a PDF into a short summary and a validated structured JSON result. The React
app in `apps/web` extracts the text in the browser and calls the Supabase Edge Function
`supabase/functions/analyze`, whose handler lives in `apps/api` and asks a language model for the
analysis. Runtime-independent code lives in `packages/`: `contracts` (Zod schemas), `domain` (pure
rules and use cases), `i18n` (pl and en catalogs) and the shared TypeScript and ESLint configs.
Bun workspaces and Turborepo run everything. The gates are `bun run check` (Prettier, lint with
the i18n parity check, typecheck, Vitest, hygiene) and `bun run build`; CI runs both on every push.

## Rules

@.cursor/rules/hexagonal-boundaries.mdc
@.cursor/rules/zod-schema-first-contracts.mdc
@.cursor/rules/explicit-ts-extensions.mdc
@.cursor/rules/tests-first.mdc
@.cursor/rules/commit-and-branch-flow.mdc
@.cursor/rules/security-and-secrets.mdc
@.cursor/rules/i18n-literal-keys.mdc
@.cursor/rules/reuse-first.mdc
@.cursor/rules/use-bun.mdc

## Skills

- `pdf-insight-dev`: install, gates, the local Supabase stack, the function and the web app.
- `pdf-insight-review`: the review rubric applied to every slice before it lands.
- `pdf-insight-release`: landing a reviewed slice on `main`, its AI_LOG commit, and publishing.

The skills live in `.claude/skills/<name>/SKILL.md`.
