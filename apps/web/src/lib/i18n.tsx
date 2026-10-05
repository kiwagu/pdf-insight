import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createTranslator,
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
  type MessageKey,
} from '@pdf-insight/i18n';

type T = (key: MessageKey, params?: Record<string, string | number>) => string;
const LOCALE_KEY = 'pdf-insight.locale';

const Ctx = createContext<{ locale: Locale; setLocale: (l: Locale) => void; t: T } | null>(null);

function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(LOCALE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(LOCALE_KEY, l);
    } catch {
      // ignore: the choice just will not persist
    }
  }, []);
  // Keeps <html lang> in step with the active locale, including a locale restored on load.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const value = useMemo(
    () => ({ locale, setLocale, t: createTranslator(locale) }),
    [locale, setLocale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('I18nProvider is missing');
  return ctx;
}

export const useT = (): T => useI18n().t;
export const useLocale = (): [Locale, (l: Locale) => void] => {
  const { locale, setLocale } = useI18n();
  return [locale, setLocale];
};
