import { describe, expect, it, vi } from 'vitest';
import { encodeWithinCap, JPEG_QUALITIES, RENDER_SCALES } from './fit-image';

/** A fake page whose encoded size grows with the scale and the JPEG quality. */
function fakePage(sizeAt: (scale: number, quality: number) => number) {
  const encodes: [number, number][] = [];
  const render = vi.fn(async (scale: number) => {
    await Promise.resolve();
    return (quality: number) => {
      encodes.push([scale, quality]);
      return 'x'.repeat(sizeAt(scale, quality));
    };
  });
  return { render, encodes };
}

describe('encodeWithinCap', () => {
  it('keeps the first rendering when it already fits', async () => {
    const { render, encodes } = fakePage(() => 10);
    await expect(encodeWithinCap(render, 100)).resolves.toBe('x'.repeat(10));
    expect(encodes).toEqual([[RENDER_SCALES[0], JPEG_QUALITIES[0]]]);
    expect(render).toHaveBeenCalledTimes(1);
  });
  it('lowers the JPEG quality before the scale', async () => {
    const { render, encodes } = fakePage((scale, quality) => Math.round(scale * quality * 100));
    // 1.5 x 0.8 = 120 and 1.5 x 0.6 = 90 are too big; 1.5 x 0.4 = 60 fits.
    await expect(encodeWithinCap(render, 70)).resolves.toHaveLength(60);
    expect(encodes).toEqual([
      [1.5, 0.8],
      [1.5, 0.6],
      [1.5, 0.4],
    ]);
    expect(render).toHaveBeenCalledTimes(1);
  });
  it('renders smaller once the lowest quality is still too big, starting again from the best quality', async () => {
    const { render, encodes } = fakePage((scale, quality) => Math.round(scale * quality * 100));
    // At scale 1: 80 and 60 are too big, 40 fits.
    await expect(encodeWithinCap(render, 50)).resolves.toHaveLength(40);
    expect(encodes.slice(3)).toEqual([
      [1, 0.8],
      [1, 0.6],
      [1, 0.4],
    ]);
    expect(render.mock.calls.map(([scale]) => scale)).toEqual([1.5, 1]);
  });
  it('gives up with null when even the smallest rendering is too big', async () => {
    const { render } = fakePage(() => 1_000);
    await expect(encodeWithinCap(render, 100)).resolves.toBeNull();
    expect(render.mock.calls.map(([scale]) => scale)).toEqual([...RENDER_SCALES]);
  });
});
