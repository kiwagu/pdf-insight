/** Render scales tried in turn, largest first; the first one is the usual rendering. */
export const RENDER_SCALES = [1.5, 1, 0.75, 0.5, 0.25] as const;
/** JPEG qualities tried at each scale, best first. */
export const JPEG_QUALITIES = [0.8, 0.6, 0.4] as const;

/** Renders the page at `scale` and returns an encoder of that rendering as base64 JPEG. */
export type RenderAt = (scale: number) => Promise<(quality: number) => string>;

/**
 * Encodes a page image within `maxLength` base64 characters: the JPEG quality goes down first,
 * since re-encoding is cheap, and only then the render scale. Null when even the smallest
 * rendering is too big, which takes a page far larger than any real document page.
 */
export async function encodeWithinCap(render: RenderAt, maxLength: number): Promise<string | null> {
  for (const scale of RENDER_SCALES) {
    const encode = await render(scale);
    for (const quality of JPEG_QUALITIES) {
      const image = encode(quality);
      if (image.length <= maxLength) return image;
    }
  }
  return null;
}
