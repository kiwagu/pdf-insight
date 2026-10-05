import { RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AnalysisProgress } from '../components/AnalysisProgress';
import { DropZone } from '../components/DropZone';
import { ErrorPanel } from '../components/ErrorPanel';
import { HistoryList } from '../components/HistoryList';
import { JsonPanel } from '../components/JsonPanel';
import { Layout } from '../components/Layout';
import { ResultView } from '../components/ResultView';
import { Button } from '../components/ui/button';
import { useT } from '../lib/i18n';
import { createContainer, type Container } from './container';
import type { AppState } from './state';
import { useAnalysis } from './use-analysis';

/** The view a state shows; focus moves to the new view only when this changes. */
const viewOf = (state: AppState) =>
  state.status === 'extracting' || state.status === 'analyzing' ? 'busy' : state.status;

export function App({ container }: { container?: Container }) {
  const t = useT();
  // Created once: the container holds the pdf.js extractor, the API client and the history.
  const [deps] = useState(() => container ?? createContainer());
  const { state, history, pending, run, retry, reset, restore, clearHistory } = useAnalysis(deps);

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

  return (
    <Layout>
      <div ref={viewRef} tabIndex={-1} className="flex flex-col gap-6 outline-none">
        {state.status === 'idle' && (
          <DropZone onFile={(file) => void run(file)} disabled={pending} />
        )}
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
            onRetry={retry}
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
        disabled={pending}
        onRestore={(entry) => {
          restore(entry);
          // Also when a result was already shown: the view stays the same, its content does not.
          viewRef.current?.focus();
        }}
        onClear={clearHistory}
      />
    </Layout>
  );
}
