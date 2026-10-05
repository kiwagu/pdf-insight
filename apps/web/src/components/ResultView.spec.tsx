import { render, screen, within } from '@testing-library/react';
import type { AnalysisResult } from '@pdf-insight/contracts';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../lib/i18n';
import { contractResult as result } from '../test/fixtures';
import { ResultView } from './ResultView';

const show = (r: AnalysisResult) =>
  render(
    <I18nProvider>
      <ResultView result={r} />
    </I18nProvider>,
  );

describe('ResultView', () => {
  it('renders summary, key points, entities, amounts, dates, keywords and meta', () => {
    show(result);
    expect(screen.getByText('Umowa dotyczy wdrozenia CRM.')).toBeInTheDocument();
    expect(screen.getByText('Okres 24 miesiace')).toBeInTheDocument();
    expect(screen.getByText('Nordwave Logistics sp. z o.o.')).toBeInTheDocument();
    expect(screen.getByText('Anna Kowalczyk')).toBeInTheDocument();
    expect(screen.getByText('184 500,00')).toBeInTheDocument();
    expect(screen.getByText('PLN')).toBeInTheDocument();
    expect(screen.getByText('2026-10-12')).toBeInTheDocument();
    expect(screen.getByText('CRM')).toBeInTheDocument();
    expect(screen.getByText(/11/)).toBeInTheDocument();
    expect(screen.getByText(result.meta.warnings[0] ?? '')).toBeInTheDocument();
    expect(screen.getByText('9,0 s')).toBeInTheDocument();
  });
  it('renders the document card with the localized type', () => {
    show(result);
    expect(screen.getByText('umowa.pdf')).toBeInTheDocument();
    expect(screen.getByText('Umowa ramowa nr 14/2026')).toBeInTheDocument();
    expect(screen.getByText('umowa')).toBeInTheDocument();
    expect(screen.getByText('2026-03-12')).toBeInTheDocument();
  });
  it('shows the source page of every amount and date', () => {
    show(result);
    const [amounts, dates] = screen.getAllByRole('table');
    expect(
      within(amounts as HTMLElement).getByRole('columnheader', { name: 'Strona' }),
    ).toBeVisible();
    expect(within(amounts as HTMLElement).getByRole('cell', { name: '5' })).toBeInTheDocument();
    expect(within(dates as HTMLElement).getByRole('cell', { name: '3' })).toBeInTheDocument();
  });
  it('labels every table cell for the stacked mobile layout', () => {
    show(result);
    for (const cell of screen.getAllByRole('cell')) {
      expect(cell).toHaveAttribute('data-label');
    }
  });
  it('renders the localized placeholder for empty lists', () => {
    show({ ...result, keyPoints: [], amounts: [] });
    expect(screen.getAllByText('brak').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole('table')).toHaveLength(1);
  });
  it('renders the placeholder for an unknown source page', () => {
    const amount: AnalysisResult['amounts'][number] = {
      value: 13100,
      currency: 'PLN',
      context: 'aneks',
      page: null,
    };
    show({ ...result, amounts: [amount], dates: [] });
    const [amounts] = screen.getAllByRole('table');
    expect(within(amounts as HTMLElement).getByRole('cell', { name: 'brak' })).toBeInTheDocument();
  });
});
