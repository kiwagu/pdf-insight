// Port members are function-typed properties, like the domain ports: a mocked `consume` can be
// handed to `expect()` without tripping the unbound-method lint rule.
export interface RateLimiter {
  consume: (key: string) => Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}
