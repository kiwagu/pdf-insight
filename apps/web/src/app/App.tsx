import { MAX_SCANNED_PAGES } from '@pdf-insight/contracts';
import { AnalysisError, analyzeDocument, type HistoryEntry } from '@pdf-insight/domain';
import { RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AnalysisProgress } from '../components/AnalysisProgress';
import { DropZone } from '../components/DropZone';
import { ErrorPanel } from '../components/ErrorPanel';
import { HistoryList } from '../components/HistoryList';
import { JsonPanel } from '../components/JsonPanel';
import { Layout } from '../components/Layout';
import { ResultView } from '../components/ResultView';
import { Button } from '../components/ui/button';
import { validatePdfFile } from '../lib/file-check';
import { useT } from '../lib/i18n';
import { exceedsPayloadCap } from '../lib/pdf/payload-guard';
import { createContainer, type Container } from './container';
import { initialState, reducer, type AppState } from './state';

const toAnalysisError = (error: unknown): AnalysisError =>
  error instanceof AnalysisError
    ? error
    : new AnalysisError('extraction_failed', String(error), false);

/** The view a state shows; focus moves to the new view only when this changes. */
const viewOf = (state: AppState) =>
  state.status === 'extracting' || state.status === 'analyzing' ? 'busy' : state.status;

export function App({ container }: { container?: Container }) {
  const t = useT();
  // Created once: the container holds the pdf.js extractor, the API client and the history.
  const [deps] = useState(() => container ?? createContainer());
  const [state, dispatch] = useReducer(reducer, initialState);
  const [history, setHistory] = useState<HistoryEntry[]>(() => deps.history.list());
  const lastFile = useRef<File | null>(null);
  // Taken synchronously before the first await: a second pick that lands while the first file is
  // still being checked is ignored instead of starting a parallel analysis.
  const inFlight = useRef(false);
  // Only the newest run may report; a completion from an older one is dropped.
  const currentRun = useRef(0);

  const run = useCallback(
    async (file: File) => {
      if (inFlight.current) return;
      inFlight.current = true;
      const id = ++currentRun.current;
      lastFile.current = file;
      try {
        const invalid = await validatePdfFile(file);
        if (invalid) throw invalid;
        dispatch({ type: 'start' });
        const result = await analyzeDocument(file, {
          extractor: {
            extract: async (blob, options) => {
              const doc = await deps.extractor.extract(blob, options);
              if (exceedsPayloadCap(doc)) {
                throw new AnalysisError('payload_too_large', 'Document too large to send.', false);
              }
              return doc;
            },
          },
          analyzer: deps.analyzer,
          history: deps.history,
          onStage: (stage, detail) => {
            if (id === currentRun.current) dispatch({ type: 'stage', stage, pages: detail?.pages });
          },
          maxScannedPages: MAX_SCANNED_PAGES,
        });
        // The use case has saved the entry already, so the list is refreshed either way.
        setHistory(deps.history.list());
        if (id === currentRun.current) dispatch({ type: 'done', result });
      } catch (error) {
        if (id === currentRun.current) dispatch({ type: 'fail', error: toAnalysisError(error) });
      } finally {
        inFlight.current = false;
      }
    },
    [deps],
  );
  // Leaving a view supersedes whatever run produced it.
  const reset = () => {
    currentRun.current += 1;
    dispatch({ type: 'reset' });
  };

  useEffect(() => {
    document.title = t('app.title');
  }, [t]);

  // A file dropped outside the drop zone would make the browser open it in place of the app and
  // lose the current result.
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    window.addEventListener('dragover', stop);
    window.addEventListener('drop', stop);
    return () => {
      window.removeEventListener('dragover', stop);
      window.removeEventListener('drop', stop);
    };
  }, []);

  // When the view changes (upload, progress, error, result), the element that had focus is gone;
  // focus moves to the new view so keyboard and screen reader users continue from there.
  const view = viewOf(state);
  const viewRef = useRef<HTMLDivElement>(null);
  const shownView = useRef(view);
  useEffect(() => {
    if (shownView.current === view) return;
    shownView.current = view;
    viewRef.current?.focus();
  }, [view]);

  const busy = view === 'busy';
  return (
    <Layout>
      <div ref={viewRef} tabIndex={-1} className="flex flex-col gap-6 outline-none">
        {state.status === 'idle' && <DropZone onFile={(file) => void run(file)} disabled={false} />}
        {(state.status === 'extracting' || state.status === 'analyzing') && (
          <AnalysisProgress
            stage={state.status}
            pages={state.status === 'analyzing' ? state.pages : undefined}
          />
        )}
        {state.status === 'error' && (
          <ErrorPanel
            code={state.code}
            retryable={state.retryable}
            onRetry={() => {
              if (lastFile.current) void run(lastFile.current);
            }}
            onReset={reset}
          />
        )}
        {state.status === 'done' && (
          <>
            <Button variant="outline" className="h-11 self-start px-4" onClick={reset}>
              <RotateCcw aria-hidden="true" />
              {t('result.newAnalysis')}
            </Button>
            <ResultView result={state.result} />
            <JsonPanel result={state.result} />
          </>
        )}
      </div>
      <HistoryList
        entries={history}
        disabled={busy}
        onRestore={(entry) => {
          currentRun.current += 1;
          dispatch({ type: 'restore', result: entry.result });
          // Also when a result was already shown: the view stays the same, its content does not.
          viewRef.current?.focus();
        }}
        onClear={() => {
          deps.history.clear();
          setHistory([]);
        }}
      />
    </Layout>
  );
}
