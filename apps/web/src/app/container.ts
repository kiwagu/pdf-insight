import type { AnalysisHistory, DocumentAnalyzer, TextExtractor } from '@pdf-insight/domain';
import { createHttpAnalyzer } from '../api/analyze-client';
import { createLocalStorageHistory } from '../lib/history/local-storage-history';
import { createPdfJsExtractor } from '../lib/pdf/pdfjs-extractor';

export interface Container {
  extractor: TextExtractor;
  analyzer: DocumentAnalyzer;
  history: AnalysisHistory;
}

export function createContainer(): Container {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) throw new Error('VITE_API_URL is not set');
  let storage: Storage | null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  return {
    extractor: createPdfJsExtractor(),
    analyzer: createHttpAnalyzer(apiUrl),
    history: createLocalStorageHistory(storage),
  };
}
