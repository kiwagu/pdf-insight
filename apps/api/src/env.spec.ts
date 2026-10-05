import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.ts';

const base = {
  ANTHROPIC_API_KEY: 'k',
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 's',
};

describe('parseEnv', () => {
  it('applies defaults and splits origins', () => {
    const env = parseEnv({ ...base, ALLOWED_ORIGINS: 'https://a.example, https://b.example' });
    expect(env.ALLOWED_ORIGINS).toEqual(['https://a.example', 'https://b.example']);
    expect(env.LLM_MODEL).toBe('claude-opus-5-5');
    expect(env.LLM_EFFORT).toBe('low');
    expect(env.MAX_BODY_BYTES).toBe(6_000_000);
    expect(env.RATE_LIMIT_PER_MINUTE).toBe(10);
  });
  it('rejects a missing api key', () => {
    expect(() => parseEnv({ ...base, ANTHROPIC_API_KEY: undefined })).toThrow(/ANTHROPIC_API_KEY/);
  });
  it('rejects an unknown effort level', () => {
    expect(() => parseEnv({ ...base, LLM_EFFORT: 'max' })).toThrow();
  });
});
