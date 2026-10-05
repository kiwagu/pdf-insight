import { catalogs, missingKeys } from './translator.ts';

// The shared base config declares no host globals, so the two console methods this script
// calls under Bun are declared here instead of widening the whole package's type environment.
declare const console: { error(message: string): void; warn(message: string): void };

const gaps = [
  ...missingKeys(catalogs.pl, catalogs.en).map((k) => `en lacks ${k}`),
  ...missingKeys(catalogs.en, catalogs.pl).map((k) => `pl lacks ${k}`),
];
if (gaps.length > 0) {
  console.error(`i18n catalogs out of sync:\n${gaps.join('\n')}`);
  throw new Error('i18n catalogs out of sync');
}
console.warn('i18n catalogs in sync');
