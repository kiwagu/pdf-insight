import type { HistoryEntry } from '@pdf-insight/domain';
import { FileText, Trash2 } from 'lucide-react';
import { formatDateTime } from '../lib/format';
import { useLocale, useT } from '../lib/i18n';
import { Section } from './Section';
import { Button } from './ui/button';

export function HistoryList({
  entries,
  onRestore,
  onClear,
  disabled = false,
}: {
  entries: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const t = useT();
  const [locale] = useLocale();
  return (
    <Section
      title={t('history.title')}
      action={
        entries.length > 0 && (
          <Button variant="ghost" className="h-11 px-3" disabled={disabled} onClick={onClear}>
            <Trash2 aria-hidden="true" />
            {t('history.clear')}
          </Button>
        )
      }
    >
      {entries.length === 0 ? (
        <p className="text-muted-foreground">{t('history.empty')}</p>
      ) : (
        <ul className="-mx-2 flex flex-col gap-1">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Button
                variant="ghost"
                className="h-auto min-h-11 w-full justify-start gap-3 px-2 py-2 text-left whitespace-normal"
                disabled={disabled}
                onClick={() => onRestore(entry)}
              >
                <FileText aria-hidden="true" className="text-muted-foreground" />
                <span className="min-w-0 flex-1 break-all">{entry.fileName}</span>
                <span className="shrink-0 text-xs font-normal text-muted-foreground">
                  <span className="sr-only">, </span>
                  {formatDateTime(entry.analyzedAt, locale)}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
