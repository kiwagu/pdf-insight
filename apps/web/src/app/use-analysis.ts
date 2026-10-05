import { MAX_SCANNED_PAGES } from '@pdf-insight/contracts';
import { AnalysisError, analyzeDocument, type HistoryEntry } from '@pdf-insight/domain';
import { useCallback, useReducer, useRef, useState } from 'react';
import { validatePdfFile } from '../lib/file-check';
import { exceedsPayloadCap } from '../lib/pdf/payload-guard';
import type { Container } from './container';
import { initialState, reducer } from './state';

const toAnalysisError = (error: unknown): AnalysisError =>
  error instanceof AnalysisError
    ? error
    : new AnalysisError('extraction_failed', String(error), false);

/** Thrown inside a run that a newer action replaced, to stop it before the analysis request. */
class Superseded extends Error {}

/** The analysis flow behind the app: the state machine, the history and the runs that drive them. */
export function useAnalysis(deps: Container) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [history, setHistory] = useState<HistoryEntry[]>(() => deps.history.list());
  const lastFile = useRef<File | null>(null);
  // Taken synchronously before the first await: a second pick that lands while the first file is
  // still being checked is ignored instead of starting a parallel analysis. `pending` mirrors it
  // for rendering, so the drop zone and the history are disabled for the whole run.
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  // Every run, reset and restore takes a new number. A run whose number is no longer the current
  // one has been replaced by a newer action and dispatches nothing at all.
  const currentRun = useRef(0);

  const run = useCallback(
    async (file: File) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setPending(true);
      const id = ++currentRun.current;
      const isCurrent = () => id === currentRun.current;
      lastFile.current = file;
      try {
        const invalid = await validatePdfFile(file);
        if (!isCurrent()) return;
        if (invalid) throw invalid;
        dispatch({ type: 'start' });
        const result = await analyzeDocument(file, {
          extractor: {
            extract: async (blob, options) => {
              const doc = await deps.extractor.extract(blob, options);
              // Replaced while reading the file: stop before the request to the analysis API.
              if (!isCurrent()) throw new Superseded();
              if (exceedsPayloadCap(doc)) {
                throw new AnalysisError('payload_too_large', 'Document too large to send.', false);
              }
              return doc;
            },
          },
          analyzer: deps.analyzer,
          history: deps.history,
          onStage: (stage, detail) => {
            if (isCurrent()) dispatch({ type: 'stage', stage, pages: detail?.pages });
          },
          maxScannedPages: MAX_SCANNED_PAGES,
        });
        // The use case has saved the entry already, so the list is refreshed either way.
        setHistory(deps.history.list());
        if (isCurrent()) dispatch({ type: 'done', result });
      } catch (error) {
        if (isCurrent()) dispatch({ type: 'fail', error: toAnalysisError(error) });
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [deps],
  );
  const retry = useCallback(() => {
    if (lastFile.current) void run(lastFile.current);
  }, [run]);
  // Leaving a view supersedes whatever run produced it.
  const reset = useCallback(() => {
    currentRun.current += 1;
    dispatch({ type: 'reset' });
  }, []);
  const restore = useCallback((entry: HistoryEntry) => {
    currentRun.current += 1;
    dispatch({ type: 'restore', result: entry.result });
  }, []);
  const clearHistory = useCallback(() => {
    deps.history.clear();
    setHistory([]);
  }, [deps]);

  return { state, history, pending, run, retry, reset, restore, clearHistory };
}
