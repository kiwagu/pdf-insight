export interface TextItemLike {
  str: string;
  transform: number[];
}

/** Rebuilds reading order from pdf.js text items: same baseline → one line, new baseline → newline. */
export function joinTextItems(items: TextItemLike[]): string {
  let out = '';
  let lastY: number | null = null;
  for (const item of items) {
    const y = Math.round(item.transform[5] ?? 0);
    if (lastY !== null && Math.abs(y - lastY) > 2) out += '\n';
    else if (out.length > 0 && !/\s$/.test(out) && item.str.length > 0) out += ' ';
    out += item.str;
    lastY = y;
  }
  return out
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}
