import { isLocale, type Locale, type MessageKey } from '@pdf-insight/i18n';
import { useLocale, useT } from '../lib/i18n';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

const LANGUAGES: { locale: Locale; short: string; name: MessageKey }[] = [
  { locale: 'pl', short: 'PL', name: 'lang.pl' },
  { locale: 'en', short: 'EN', name: 'lang.en' },
];

export function LanguageToggle() {
  const t = useT();
  const [locale, setLocale] = useLocale();
  return (
    <ToggleGroup
      aria-label={t('result.language')}
      variant="outline"
      spacing={0}
      value={[locale]}
      // Single selection: pressing the active language again would empty the group, so only a
      // change to the other language is applied.
      onValueChange={(value) => {
        const next = value[0];
        if (isLocale(next)) setLocale(next);
      }}
    >
      {LANGUAGES.map((language) => (
        <ToggleGroupItem
          key={language.locale}
          value={language.locale}
          lang={language.locale}
          title={t(language.name)}
          className="h-11 min-w-11 px-3 aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90"
        >
          {language.short}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
