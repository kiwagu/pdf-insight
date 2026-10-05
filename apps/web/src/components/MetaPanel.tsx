import type { AnalysisMeta } from '@pdf-insight/contracts';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatSeconds } from '../lib/format';
import { useLocale, useT } from '../lib/i18n';
import { Card, CardContent } from './ui/card';

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

export function MetaPanel({ meta }: { meta: AnalysisMeta }) {
  const t = useT();
  const [locale] = useLocale();
  const none = t('result.none');
  return (
    <Card>
      <CardContent>
        <details className="group">
          <summary className="-mx-2 flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-2 font-medium outline-none select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden="true"
              className="size-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
            />
            {t('meta.title')}
          </summary>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Item label={t('meta.model')}>{meta.model}</Item>
            <Item label={t('meta.chunks')}>{meta.chunks}</Item>
            <Item label={t('meta.scannedPages')}>
              {meta.scannedPages.length > 0 ? meta.scannedPages.join(', ') : none}
            </Item>
            <Item label={t('meta.duration')}>{formatSeconds(meta.durationMs, locale)}</Item>
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">{t('meta.warnings')}</dt>
              <dd>
                {meta.warnings.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 break-words">
                    {meta.warnings.map((warning, i) => (
                      <li key={`${i}-${warning}`}>{warning}</li>
                    ))}
                  </ul>
                ) : (
                  none
                )}
              </dd>
            </div>
          </dl>
        </details>
      </CardContent>
    </Card>
  );
}
