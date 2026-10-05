import { describe, expect, it } from 'vitest';
import { joinTextItems } from './page-text';

const item = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y] });

describe('joinTextItems', () => {
  it('joins items on one line with a space and starts a new line when y changes', () => {
    expect(
      joinTextItems([item('Umowa', 10, 700), item('ramowa', 60, 700), item('nr 14/2026', 10, 680)]),
    ).toBe('Umowa ramowa\nnr 14/2026');
  });
  it('does not double spaces around items that already end with whitespace', () => {
    expect(joinTextItems([item('a ', 0, 10), item('b', 5, 10)])).toBe('a b');
  });
  it('collapses runs of blank lines', () => {
    expect(
      joinTextItems([item('a', 0, 100), item('', 0, 80), item('', 0, 60), item('b', 0, 40)]),
    ).toBe('a\nb');
  });
});
