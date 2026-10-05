import { describe, expect, it } from 'vitest';
import { chunkPages } from './chunk-pages.ts';

describe('chunkPages', () => {
  it('returns one chunk when everything fits', () => {
    const chunks = chunkPages(['a'.repeat(10), 'b'.repeat(10)], { maxChars: 100 });
    expect(chunks).toEqual([
      { index: 0, fromPage: 1, toPage: 2, text: expect.stringContaining('aaaaaaaaaa') as string },
    ]);
  });
  it('splits only on page boundaries', () => {
    const chunks = chunkPages(['a'.repeat(60), 'b'.repeat(60), 'c'.repeat(10)], { maxChars: 100 });
    expect(chunks.map((c) => [c.fromPage, c.toPage])).toEqual([
      [1, 1],
      [2, 3],
    ]);
  });
  it('keeps an oversized page as its own chunk instead of cutting it', () => {
    const chunks = chunkPages(['x'.repeat(500), 'y'], { maxChars: 100 });
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.text).toContain('x'.repeat(500));
  });
  it('labels each page inside the chunk text', () => {
    const [chunk] = chunkPages(['first', 'second'], { maxChars: 1000 });
    expect(chunk?.text).toMatch(/\[page 1\][\s\S]*first[\s\S]*\[page 2\][\s\S]*second/);
  });
});
