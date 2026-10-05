import type { AnalysisResult, ScannedPage } from '@pdf-insight/contracts';

export interface ExtractedDocument {
  fileName: string;
  pages: number;
  pageTexts: string[];
  scannedPages: ScannedPage[];
}

export interface Chunk {
  index: number;
  fromPage: number;
  toPage: number;
  text: string;
}

export interface HistoryEntry {
  id: string;
  fileName: string;
  analyzedAt: string;
  result: AnalysisResult;
}

export type Stage = 'extracting' | 'analyzing';

export const DEFAULT_MAX_CHUNK_CHARS = 60_000;
export const SCANNED_PAGE_MIN_CHARS = 20;
