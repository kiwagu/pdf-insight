/** Rate-limit key: the first address of X-Forwarded-For, which the platform's gateway sets. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first && first.length > 0 ? first : (request.headers.get('cf-connecting-ip') ?? 'unknown');
}
