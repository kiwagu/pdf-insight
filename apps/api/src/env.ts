import { z } from 'zod';

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  ALLOWED_ORIGINS: z
    .string()
    .default('https://kiwagu.github.io')
    .transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0),
    ),
  LLM_MODEL: z.string().default('claude-opus-5-5'),
  LLM_EFFORT: z.enum(['low', 'medium', 'high']).default('low'),
  MAX_BODY_BYTES: z.coerce.number().int().positive().default(6_000_000),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type ApiEnv = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, string | undefined>): ApiEnv {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`invalid environment: ${issues}`);
  }
  return parsed.data;
}
