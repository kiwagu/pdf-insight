import { describe, expect, it } from 'vitest';
import { resolveCors } from './cors.ts';

const allowed = ['https://kiwagu.github.io'];

describe('resolveCors', () => {
  it('allows an exact origin and returns the CORS headers', () => {
    const r = resolveCors('https://kiwagu.github.io', allowed);
    expect(r.allowed).toBe(true);
    expect(r.headers['access-control-allow-origin']).toBe('https://kiwagu.github.io');
    expect(r.headers['vary']).toBe('Origin');
  });
  it('rejects a foreign origin, a subdomain and a missing origin without CORS headers', () => {
    expect(resolveCors('https://evil.example', allowed)).toEqual({ allowed: false, headers: {} });
    expect(resolveCors('https://kiwagu.github.io.evil.example', allowed).allowed).toBe(false);
    expect(resolveCors(null, allowed).allowed).toBe(false);
  });
});
