import type { AnalysisResult, DocumentType } from '@pdf-insight/contracts';
import type { MessageKey } from '@pdf-insight/i18n';
import { useId, type ReactNode } from 'react';
import { formatAmount, languageName } from '../lib/format';
import { useLocale, useT } from '../lib/i18n';
import { DataTable } from './DataTable';
import { MetaPanel } from './MetaPanel';
import { Section } from './Section';
import { Badge } from './ui/badge';

// Literal keys, one per type: a new document type without a catalog label fails to compile here.
const DOCUMENT_TYPE_KEYS: Record<DocumentType, MessageKey> = {
  faktura: 'type.invoice',
  umowa: 'type.contract',
  oferta: 'type.offer',
  raport: 'type.report',
  inne: 'type.other',
};

function None() {
  const t = useT();
  return <p className="text-muted-foreground">{t('result.none')}</p>;
}

function TextList({ items }: { items: string[] }) {
  if (items.length === 0) return <None />;
  return (
    <ul className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
      {items.map((item, i) => (
        <li key={`${i}-${item}`}>{item}</li>
      ))}
    </ul>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

export function ResultView({ result }: { result: AnalysisResult }) {
  const t = useT();
  const [locale] = useLocale();
  const amountsId = useId();
  const datesId = useId();
  const { document: doc, entities } = result;
  const none = t('result.none');
  const page = (value: number | null) => (value === null ? none : String(value));
  const pageColumn = { label: t('result.page'), className: 'sm:text-right' };
  const contextColumn = (label: string) => ({
    label,
    className: 'whitespace-normal sm:min-w-48',
  });

  return (
    <div className="flex flex-col gap-6">
      <Section title={t('result.summary')}>
        <p className="text-base leading-relaxed">{result.summary}</p>
      </Section>

      <Section title={t('result.keyPoints')}>
        <TextList items={result.keyPoints} />
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title={t('result.document')}>
          <dl className="grid gap-3">
            <Field label={t('result.fileName')}>{doc.fileName}</Field>
            <Field label={t('result.pages')}>{doc.pages}</Field>
            <Field label={t('result.language')}>
              {languageName(doc.language, locale)} ({doc.language})
            </Field>
            <Field label={t('result.type')}>
              <Badge variant="secondary">{t(DOCUMENT_TYPE_KEYS[doc.type])}</Badge>
            </Field>
            <Field label={t('result.title')}>{doc.title ?? none}</Field>
            <Field label={t('result.date')}>{doc.date ?? none}</Field>
          </dl>
        </Section>

        <Section title={t('result.entities')}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <h3 className="font-medium">{t('result.organizations')}</h3>
              <TextList items={entities.organizations} />
            </div>
            <div className="grid gap-2">
              <h3 className="font-medium">{t('result.people')}</h3>
              <TextList items={entities.people} />
            </div>
          </div>
        </Section>
      </div>

      <Section title={t('result.amounts')} headingId={amountsId}>
        {result.amounts.length === 0 ? (
          <None />
        ) : (
          <DataTable
            labelledBy={amountsId}
            columns={[
              { label: t('result.amount.value'), className: 'sm:text-right' },
              { label: t('result.amount.currency') },
              contextColumn(t('result.amount.context')),
              pageColumn,
            ]}
            rows={result.amounts.map((amount, i) => ({
              key: String(i),
              cells: [
                <span className="whitespace-nowrap tabular-nums">
                  {formatAmount(amount.value, locale)}
                </span>,
                amount.currency,
                amount.context,
                page(amount.page),
              ],
            }))}
          />
        )}
      </Section>

      <Section title={t('result.dates')} headingId={datesId}>
        {result.dates.length === 0 ? (
          <None />
        ) : (
          <DataTable
            labelledBy={datesId}
            columns={[
              { label: t('result.date.date') },
              contextColumn(t('result.date.context')),
              pageColumn,
            ]}
            rows={result.dates.map((date, i) => ({
              key: String(i),
              cells: [
                <span className="whitespace-nowrap tabular-nums">{date.date}</span>,
                date.context,
                page(date.page),
              ],
            }))}
          />
        )}
      </Section>

      <Section title={t('result.keywords')}>
        {result.keywords.length === 0 ? (
          <None />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {result.keywords.map((keyword, i) => (
              <li key={`${i}-${keyword}`}>
                <Badge variant="outline" className="h-auto min-h-6 px-2.5 whitespace-normal">
                  {keyword}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <MetaPanel meta={result.meta} />
    </div>
  );
}
