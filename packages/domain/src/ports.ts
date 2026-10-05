import type { LlmAnalysis, AnalysisResult, ScannedPage } from '@pdf-insight/contracts';
import type { Chunk, ExtractedDocument, HistoryEntry } from './document.ts';

// Port members are function-typed properties rather than method signatures: they are checked
// with strict parameter variance, and a mocked member such as `history.save` can be handed to
// `expect()` without tripping the unbound-method lint rule.

export interface TextExtractor {
  extract: (file: Blob, options: { maxScannedPages: number }) => Promise<ExtractedDocument>;
}

export interface DocumentAnalyzer {
  analyze: (doc: ExtractedDocument) => Promise<AnalysisResult>;
}

export interface AnalysisHistory {
  list: () => HistoryEntry[];
  save: (entry: HistoryEntry) => void;
  clear: () => void;
}

export interface ChunkInput {
  fileName: string;
  pages: number;
  chunk: Chunk;
  images: ScannedPage[];
  isWhole: boolean;
}

export interface ReduceInput {
  fileName: string;
  pages: number;
  partials: LlmAnalysis[];
}

export interface ModelPort {
  analyzeChunk: (input: ChunkInput) => Promise<LlmAnalysis>;
  reduce: (input: ReduceInput) => Promise<LlmAnalysis>;
}
