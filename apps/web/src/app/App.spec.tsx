import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MAX_PAGE_TEXT_LENGTH, type AnalysisResult } from '@pdf-insight/contracts';
import {
  AnalysisError,
  type DocumentAnalyzer,
  type ExtractedDocument,
  type HistoryEntry,
  type TextExtractor,
} from '@pdf-insight/domain';
import { describe, expect, it, vi } from 'vitest';
import { createHttpAnalyzer } from '../api/analyze-client';
import { I18nProvider } from '../lib/i18n';
import { entryOf, extracted, fakeContainer, pdfWithHeldCheck } from '../test/fake-container';
import { contractResult, shortResult as result } from '../test/fixtures';
import { App } from './App';
import type { Container } from './container';

const container = fakeContainer;

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
    await waitFor(() =>
      expect(
        screen.getByText('Krotki dokument. Dotyczy wsparcia. Oplata jest stala.'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Pobierz .json' })).toBeInTheDocument();
    expect(c.history.save).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Nowa analiza' }));
    expect(screen.getByTestId('file-input')).toBeInTheDocument();
    expect(
      screen.queryByText('Krotki dokument. Dotyczy wsparcia. Oplata jest stala.'),
    ).not.toBeInTheDocument();
  });
  it('moves focus to the view that replaces the drop zone', async () => {
    renderApp(container());
    await userEvent.upload(screen.getByTestId('file-input'), pdf);
    await waitFor(() =>
      expect(
        screen.getByText('Krotki dokument. Dotyczy wsparcia. Oplata jest stala.'),
      ).toBeInTheDocument(),
    );
    const focused = document.activeElement;
    expect(focused).not.toBe(document.body);
    expect(focused).toContainElement(screen.getByRole('button', { name: 'Nowa analiza' }));
    expect(focused).toContainElement(
      screen.getByText('Krotki dokument. Dotyczy wsparcia. Oplata jest stala.'),
    );
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
    await waitFor(() =>
      expect(
        screen.getByText('Krotki dokument. Dotyczy wsparcia. Oplata jest stala.'),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Analizuję dokument/)).not.toBeInTheDocument();
  });
  it('ignores a second file picked while the first is still being checked', async () => {
    const deferred = new Map<string, (r: AnalysisResult) => void>();
    const analyze = vi.fn<DocumentAnalyzer['analyze']>(
      (doc) => new Promise((resolve) => deferred.set(doc.fileName, resolve)),
    );
    const extract = vi.fn<TextExtractor['extract']>((file) =>
      Promise.resolve({ ...extracted, fileName: (file as File).name }),
    );
    renderApp(container(analyze, [], extract));
    const input = screen.getByTestId('file-input');
    const a = new File(['%PDF-1.4'], 'first.pdf', { type: 'application/pdf' });
    const b = new File(['%PDF-1.4'], 'second.pdf', { type: 'application/pdf' });
    // Both picks land before the first file's async check has finished.
    fireEvent.change(input, { target: { files: [a] } });
    fireEvent.change(input, { target: { files: [b] } });
    await waitFor(() => expect(deferred.size).toBeGreaterThan(0));
    // Settle in the worst order: the later document first, the earlier one last.
    const done = (name: string) => ({
      ...result,
      summary: `Wynik ${name}. Dokument odczytany. Analiza gotowa.`,
      document: { ...result.document, fileName: name },
    });
    deferred.get('second.pdf')?.(done('second.pdf'));
    await act(() => Promise.resolve());
    deferred.get('first.pdf')?.(done('first.pdf'));
    await act(() => Promise.resolve());
    await waitFor(() =>
      expect(
        screen.getByText('Wynik first.pdf. Dokument odczytany. Analiza gotowa.'),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByText('Wynik second.pdf. Dokument odczytany. Analiza gotowa.'),
    ).not.toBeInTheDocument();
    expect(extract).toHaveBeenCalledTimes(1);
    expect(analyze).toHaveBeenCalledTimes(1);
  });
  it('disables the drop zone and the history while a picked file is checked', async () => {
    const c = container(undefined, [entryOf(contractResult)]);
    renderApp(c);
    const { file, release } = pdfWithHeldCheck();
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [file] } });
    expect(screen.getByRole('button', { name: /PDF/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /umowa\.pdf/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Wyczyść historię' })).toBeDisabled();
    release();
    await waitFor(() =>
      expect(
        screen.getByText('Krotki dokument. Dotyczy wsparcia. Oplata jest stala.'),
      ).toBeInTheDocument(),
    );
    expect(c.analyzer.analyze).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /umowa\.pdf/ })).toBeEnabled();
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
    await waitFor(() =>
      expect(
        screen.getByText('Krotki dokument. Dotyczy wsparcia. Oplata jest stala.'),
      ).toBeInTheDocument(),
    );
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
  it('explains a page with too much text, naming the page and the limit, and offers no retry', async () => {
    const long: ExtractedDocument = {
      ...extracted,
      pages: 3,
      pageTexts: [...extracted.pageTexts, 'x'.repeat(MAX_PAGE_TEXT_LENGTH + 1), ''],
    };
    const fetchImpl = vi.fn<typeof fetch>();
    const c: Container = {
      ...container(undefined, [], vi.fn<TextExtractor['extract']>().mockResolvedValue(long)),
      analyzer: createHttpAnalyzer('https://api.example/analyze', { fetchImpl }),
    };
    renderApp(c);
    await userEvent.upload(screen.getByTestId('file-input'), pdf);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Strona 2'));
    expect(screen.getByRole('alert')).toHaveTextContent(String(MAX_PAGE_TEXT_LENGTH));
    expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).not.toBeInTheDocument();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('refuses a long fully scanned document, naming its page count and the limit', async () => {
    const scanned: ExtractedDocument = {
      fileName: 'scan.pdf',
      pages: 8,
      pageTexts: Array.from({ length: 8 }, () => ''),
      scannedPages: [1, 2, 3, 4, 5].map((page) => ({ page, imageJpegBase64: 'AAAA' })),
    };
    const c = container(
      undefined,
      [],
      vi.fn<TextExtractor['extract']>().mockResolvedValue(scanned),
    );
    renderApp(c);
    await userEvent.upload(screen.getByTestId('file-input'), pdf);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Liczba stron: 8'));
    expect(screen.getByRole('alert')).toHaveTextContent('najwyżej 5');
    expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).not.toBeInTheDocument();
    expect(c.analyzer.analyze).not.toHaveBeenCalled();
    expect(c.history.save).not.toHaveBeenCalled();
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
    expect(
      screen.getByText('Krotki dokument. Dotyczy wsparcia. Oplata jest stala.'),
    ).toBeInTheDocument();
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
