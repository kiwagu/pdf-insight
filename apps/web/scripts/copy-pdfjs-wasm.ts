// Copies the pdf.js decoder assets (wasm decoders for JBIG2 and JPEG 2000 images, the colour
// management module and the ICC profiles they use) into public/, so Vite serves them under the
// app base and pdf.js can fetch them through `wasmUrl` and `iccUrl`. Runs before dev and build;
// the copy is generated and ignored by git.
import { cpSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
const target = path.resolve(import.meta.dirname, '..', 'public', 'pdfjs');

rmSync(target, { recursive: true, force: true });
for (const dir of ['wasm', 'iccs']) {
  cpSync(path.join(pdfjsRoot, dir), path.join(target, dir), { recursive: true });
}
