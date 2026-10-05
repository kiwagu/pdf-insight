---
name: pdf-insight-dev
description: Use when setting up, running, testing or building PDF Insight locally - install, the check gate, the local Supabase stack, serving the analyze function and running the web app against it.
---

# PDF Insight: local development

## Prerequisites

- Bun 1.3.14, the version pinned in `package.json` and used by CI.
- Docker, only for the local Supabase stack and the function.
- An Anthropic API key, only to run the function against the real model.

## Install, gates, build

```bash
bun install          # workspaces and lockfile
bun run check        # Prettier check, lint (+ i18n parity), typecheck, Vitest, hygiene
bun run build        # turbo build; the web build needs VITE_API_URL
bun run format       # apply Prettier formatting
```

The root scripts are `dev`, `build`, `lint`, `typecheck`, `test`, `format`, `format:check`,
`hygiene` and `check`. CI runs `bun install --frozen-lockfile`, `bun run check`, then
`bun run build` with `VITE_API_URL=https://example.invalid`. To reproduce the build locally:

```bash
VITE_API_URL=https://example.invalid bun run build
```

One workspace: `bunx turbo run test --filter=@pdf-insight/domain`. One spec file, from inside the
workspace: `bunx vitest run src/chunk-pages.spec.ts`.

## Environment templates

- `.env.example`: the browser build's variables, `VITE_API_URL` (required, the analyze endpoint)
  and `VITE_REPOSITORY_URL` (optional, the source link in the footer).
- `infra/dev/functions.env.example`: the local function's settings (`ANTHROPIC_API_KEY`,
  `ALLOWED_ORIGINS`, `LLM_MODEL`, `LLM_EFFORT`, `MAX_BODY_BYTES`, `RATE_LIMIT_PER_MINUTE`).
  Copy it to `infra/dev/functions.env` (gitignored) and put the real key there.

Never commit a filled copy; `bun run hygiene` fails on tracked env files. The cloud function's
values are set with `supabase secrets set` by the deploy workflow, not from these files.

## Local Supabase stack and the analyze function

The stack uses the 5535x ports (API gateway 55351, Postgres 55352, Studio 55353), so it runs
next to other local Supabase stacks; `infra/dev/README.md` has the details.

```bash
bash infra/dev/stack.sh up       # start the stack (the first run pulls the images)
bash infra/dev/stack.sh status   # URLs and local keys
bash infra/dev/stack.sh reset    # recreate the database and re-apply supabase/migrations
bash infra/dev/stack.sh down     # stop the stack

cp infra/dev/functions.env.example infra/dev/functions.env    # once; then set the key
bunx supabase functions serve analyze --no-verify-jwt --env-file infra/dev/functions.env
curl -s -H 'origin: http://localhost:5173' http://127.0.0.1:55351/functions/v1/analyze/healthz
```

`bun run --cwd apps/api serve` runs the same serve command. The health check answers
`{"ok":true}`. The local gateway adds its own permissive CORS headers to `/functions/v1/`, but
the function itself still answers 403 to a foreign or missing `Origin`.

## Web app

```bash
VITE_API_URL=http://127.0.0.1:55351/functions/v1/analyze bun run --cwd apps/web dev
```

Vite serves the app at `http://localhost:5173/pdf-insight/` (the base path of the GitHub Pages
site); its origin, `http://localhost:5173`, is the one that `functions.env.example` allows.
`predev` and `prebuild` run `apps/web/scripts/copy-pdfjs-wasm.ts`, which copies the pdf.js
decoder modules into `apps/web/public/pdfjs/` (generated, gitignored).
`bun run --cwd apps/web preview` serves a finished build.

## Deploy

Deploys run from GitHub Actions on pushes to `main`, which only the owner makes.

- `deploy-web.yml`: runs `bun run check`, builds `apps/web` with the repository variable
  `VITE_API_URL` and `VITE_REPOSITORY_URL` from the GitHub context, and publishes
  `apps/web/dist` to GitHub Pages.
- `deploy-api.yml` (on changes under `apps/api`, `packages`, `supabase` or the workflow itself):
  runs `bun run check`, then `supabase secrets set` (`ANTHROPIC_API_KEY` from the repository
  secrets, `ALLOWED_ORIGINS` from the variables) and `supabase functions deploy analyze`. It
  needs the secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID` and `ANTHROPIC_API_KEY`.
- `keepalive.yml`: every six hours, calls `/healthz` with the first allowed origin (variables
  `VITE_API_URL`, `ALLOWED_ORIGINS`), so the project sees regular activity.

The rate-limit migration is applied to the cloud project with `supabase db push`, not by a
workflow.
