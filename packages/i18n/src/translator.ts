import en from './catalogs/en.json';
import pl from './catalogs/pl.json';

export const SUPPORTED_LOCALES = ['pl', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'pl';

export type Catalog = Record<string, string>;
export type MessageKey = keyof typeof pl;

export const catalogs: Record<Locale, Catalog> = { pl, en };

export function isLocale(value: string | null | undefined): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value ?? '');
}

export function createTranslator(locale: Locale) {
  const catalog = catalogs[locale];
  // Own-property checks only: a key or placeholder named like an inherited object member
  // (`constructor`, `toString`, `__proto__`) must not resolve to the prototype.
  return (key: MessageKey, params: Record<string, string | number> = {}): string => {
    const template = (Object.hasOwn(catalog, key) ? catalog[key] : undefined) ?? key;
    return template.replace(/\{(\w+)\}/g, (_, name: string) => {
      const value = Object.hasOwn(params, name) ? params[name] : undefined;
      return value === undefined ? `{${name}}` : String(value);
    });
  };
}

export function missingKeys(reference: Catalog, candidate: Catalog): string[] {
  return Object.keys(reference)
    .filter((k) => !Object.hasOwn(candidate, k))
    .sort();
}
