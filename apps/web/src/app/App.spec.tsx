import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnalysisResult } from '@pdf-insight/contracts';
import {
  AnalysisError,
  type DocumentAnalyzer,
  type ExtractedDocument,
  type HistoryEntry,
  type TextExtractor,
} from '@pdf-insight/domain';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n';
import { shortResult as result } from '../test/fixtures';
import { App } from './App';
import type { Container } from './container';

const extracted: ExtractedDocument = {
  fileName: 'a.pdf',
  pages: 1,
  pageTexts: ['hello world, this document has a real text layer'],
  scannedPages: [],
};

const container = (
  analyze = vi.fn<DocumentAnalyzer['analyze']>().mockResolvedValue(result),
  entries: HistoryEntry[] = [],
  extract = vi.fn<TextExtractor['extract']>().mockResolvedValue(extracted),
): Container => ({
  extractor: { extract },
  analyzer: { analyze },
  history: {
    list: vi.fn<Container['history']['list']>().mockReturnValue(entries),
    save: vi.fn<Container['history']['save']>(),
    clear: vi.fn<Container['history']['clear']>(),
  },
});

const pdf = new File(['%PDF-1.4'], 'a.pdf', { type: 'application/pdf' });

const renderApp = (c: Container) =>
  render(
    <I18nProvider>
      <App container={c} />
    </I18nProvider>,
  );

describe('App', () => {
  it('goes from the drop zone to the result and offers a new analysis', async () => {
    const c = container();
    renderApp(c);
    await userEvent.upload(screen.getByTestId('file-input'), pdf);
    await waitFor(() => expect(screen.getByText('Krotki dokument.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Pobierz .json' })).toBeInTheDocument();
    expect(c.history.save).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Nowa analiza' }));
    expect(screen.getByTestId('file-input')).toBeInTheDocument();
    expect(screen.queryByText('Krotki dokument.')).not.toBeInTheDocument();
  });
  it('moves focus to the view that replaces the drop zone', async () => {
    renderApp(container());
    await userEvent.upload(screen.getByTestId('file-input'), pdf);
    await waitFor(() => expect(screen.getByText('Krotki dokument.')).toBeInTheDocument());
    const focused = document.activeElement;
    expect(focused).not.toBe(document.body);
    expect(focused).toContainElement(screen.getByRole('button', { name: 'Nowa analiza' }));
    expect(focused).toContainElement(screen.getByText('Krotki dokument.'));
  });
  it('announces the progress while the document is analyzed', async () => {
    let finish: (r: AnalysisResult) => void = () => undefined;
    const analyze = vi
      .fn<DocumentAnalyzer['analyze']>()
      .mockReturnValue(new Promise<AnalysisResult>((resolve) => (finish = resolve)));
    renderApp(container(analyze));
    await userEvent.upload(screen.getByTestId('file-input'), pdf);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Analizuję dokument'));
    expect(screen.getByRole('status')).toHaveTextContent('Stron: 1');
    finish(result);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.getByText('Krotki dokument.')).toBeInTheDocument();
  });
  it('shows a retryable error with a retry button and retries the same document', async () => {
    const analyze = vi
      .fn<DocumentAnalyzer['analyze']>()
      .mockRejectedValueOnce(new AnalysisError('rate_limited', 'slow', true))
      .mockResolvedValue(result);
    renderApp(container(analyze));
    await userEvent.upload(screen.getByTestId('file-input'), pdf);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Zbyt wiele żądań');
    await userEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    await waitFor(() => expect(screen.getByText('Krotki dokument.')).toBeInTheDocument());
    expect(analyze).toHaveBeenCalledTimes(2);
  });
  it('offers no retry for a final error and goes back to the start', async () => {
    const extract = vi
      .fn<TextExtractor['extract']>()
      .mockRejectedValue(new AnalysisError('extraction_failed', 'broken', false));
    renderApp(container(undefined, [], extract));
    await userEvent.upload(screen.getByTestId('file-input'), pdf);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Wróć do początku' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('file-input')).toBeInTheDocument();
  });
  it('rejects a non-PDF before calling the extractor', async () => {
    const c = container();
    renderApp(c);
    // The picker filters by type, but a drop or an "all files" choice does not.
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(
      screen.getByTestId('file-input'),
      new File(['nope'], 'x.txt', { type: 'text/plain' }),
    );
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('To nie jest prawidłowy plik PDF');
    expect(c.extractor.extract).not.toHaveBeenCalled();
  });
  it('stops a document whose request would exceed the API body limit', async () => {
    const huge: ExtractedDocument = { ...extracted, pageTexts: ['x'.repeat(6_000_001)] };
    const c = container(undefined, [], vi.fn<TextExtractor['extract']>().mockResolvedValue(huge));
    renderApp(c);
    await userEvent.upload(screen.getByTestId('file-input'), pdf);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('zbyt duży'));
    expect(c.analyzer.analyze).not.toHaveBeenCalled();
  });
  it('restores a result from the history and clears the history', async () => {
    const entry: HistoryEntry = {
      id: result.meta.id,
      fileName: result.document.fileName,
      analyzedAt: result.meta.analyzedAt,
      result,
    };
    const c = container(undefined, [entry]);
    renderApp(c);
    await userEvent.click(screen.getByRole('button', { name: /a\.pdf/ }));
    expect(screen.getByText('Krotki dokument.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Wyczyść historię' }));
    expect(c.history.clear).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Brak zapisanych analiz/)).toBeInTheDocument();
  });
  it('switches the interface to English', async () => {
    renderApp(container());
    await userEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByRole('button', { name: /PDF file/ })).toBeInTheDocument();
    expect(document.title).toBe('PDF Insight');
  });
});
