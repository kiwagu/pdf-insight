// Deno entry of the analyze function. Everything else lives in apps/api (runtime-agnostic,
// tested in Node); deno.json maps the workspace packages and the npm dependencies.
import { createAnalysisId, createRequestId } from '@pdf-insight/contracts';
import {
  createAnthropicModel,
  createHandler,
  createPostgrestRateLimiter,
  parseEnv,
} from '../../../apps/api/src/index.ts';

const env = parseEnv(Deno.env.toObject());
const handler = createHandler({
  env,
  model: createAnthropicModel({
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.LLM_MODEL,
    effort: env.LLM_EFFORT,
  }),
  limiter: createPostgrestRateLimiter({
    supabaseUrl: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    limit: env.RATE_LIMIT_PER_MINUTE,
    windowSeconds: 60,
  }),
  createRequestId,
  createAnalysisId,
  now: () => new Date(),
});

Deno.serve(handler);
