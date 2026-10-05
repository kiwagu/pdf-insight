# Local development stack

A local Supabase stack (Postgres, PostgREST, the edge runtime and the rest of the Supabase
services) run by the Supabase CLI in Docker. It serves the `analyze` function and applies the
migrations in `supabase/migrations` on start. It is the place to try the function before anything
reaches the cloud project.

## Ports

The stack uses the 5535x block so it can run next to other Supabase stacks on the same host:

| Service             | Port  |
| ------------------- | ----- |
| API gateway         | 55351 |
| Postgres            | 55352 |
| Studio              | 55353 |
| Shadow DB (db diff) | 55350 |

The function answers at `http://127.0.0.1:55351/functions/v1/analyze`.

## Commands

```bash
bash infra/dev/stack.sh up       # start the stack (the first run pulls the images)
bash infra/dev/stack.sh status   # URLs and local keys
bash infra/dev/stack.sh reset    # recreate the database and re-apply the migrations
bash infra/dev/stack.sh down     # stop the stack

cp infra/dev/functions.env.example infra/dev/functions.env   # then put a real key in it
bunx supabase functions serve analyze --no-verify-jwt --env-file infra/dev/functions.env
curl -s -H 'origin: http://localhost:5173' http://127.0.0.1:55351/functions/v1/analyze/healthz
```

`infra/dev/functions.env` is ignored by git; never commit a key. `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are injected by the CLI.

The local gateway (Kong) adds its own CORS handling to `/functions/v1/`: it answers preflight
requests itself and sends `Access-Control-Allow-Origin: *` on every response. The function's
allow-list still refuses foreign origins (403), but its own CORS headers are only visible when the
edge runtime container is called directly on port 8081.

## Cloud

The cloud project does not read this file. Its function secrets are set with
`supabase secrets set` (the deploy workflow sets `ANTHROPIC_API_KEY` and `ALLOWED_ORIGINS`), and
the migration is applied with `supabase db push`.
