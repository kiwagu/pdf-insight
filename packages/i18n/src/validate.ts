import { catalogs, missingKeys } from './translator.ts';

// The shared base config declares no host globals, so the one console method this script calls
// under Bun is declared here instead of widening the whole package's type environment. Success is
// silent; a mismatch prints the gaps and throws, which makes Bun exit with code 1.
declare const console: { error(message: string): void };

const gaps = [
  ...missingKeys(catalogs.pl, catalogs.en).map((k) => `en lacks ${k}`),
  ...missingKeys(catalogs.en, catalogs.pl).map((k) => `pl lacks ${k}`),
];
if (gaps.length > 0) {
  console.error(`i18n catalogs out of sync:\n${gaps.join('\n')}`);
  throw new Error('i18n catalogs out of sync');
}
