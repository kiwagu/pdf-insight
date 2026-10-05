import type { Locale } from '@pdf-insight/i18n';

// Several locales group digits with a no-break space (U+00A0) or a narrow one (U+202F). A plain
// space reads the same, matches how documents print amounts and keeps copied values searchable;
// the cells that show amounts do not wrap, so the number never breaks across lines.
const GROUP_SPACES = /[\u00a0\u202f]/g;

export function formatAmount(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(value)
    .replace(GROUP_SPACES, ' ');
}

export function formatSeconds(ms: number, locale: Locale): string {
  const seconds = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(ms / 1000);
  return `${seconds} s`;
}

/** Date and time of an ISO timestamp in the reader's time zone; an unparseable value as is. */
export function formatDateTime(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

/** The name of an ISO 639-1 language in the interface language, or the code itself. */
export function languageName(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}
