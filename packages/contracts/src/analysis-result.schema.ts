import { z } from 'zod';
import { ISO_4217_CODES, ISO_4217_HISTORIC_CODES, ISO_639_1_CODES } from './iso-codes.ts';

export const DOCUMENT_TYPES = ['faktura', 'umowa', 'oferta', 'raport', 'inne'] as const;

const isoDate = z.iso.date({ message: 'expected a valid YYYY-MM-DD date' });
const iso639 = z.enum(ISO_639_1_CODES, { message: 'expected an ISO 639-1 language code' });
// Withdrawn codes are accepted too: an older document can carry real amounts in HRK or DEM.
const iso4217 = z.enum([...ISO_4217_CODES, ...ISO_4217_HISTORIC_CODES], {
  message: 'expected an ISO 4217 currency code',
});

/** 1-based page an amount or date was read from; null when the model cannot tell. */
const sourcePage = z.number().int().min(1).nullable();

const llmDocumentSchema = z.object({
  language: iso639,
  type: z.enum(DOCUMENT_TYPES),
  title: z.string().min(1).nullable(),
  date: isoDate.nullable(),
});

/** What the model is asked to return. Code adds fileName, pages and meta afterwards. */
export const llmAnalysisSchema = z.object({
  document: llmDocumentSchema,
  summary: z.string().min(1).max(1500),
  keyPoints: z.array(z.string().min(1)).max(7),
  entities: z.object({
    organizations: z.array(z.string().min(1)),
    people: z.array(z.string().min(1)),
  }),
  amounts: z.array(
    z.object({ value: z.number(), currency: iso4217, context: z.string(), page: sourcePage }),
  ),
  dates: z.array(z.object({ date: isoDate, context: z.string(), page: sourcePage })),
  keywords: z.array(z.string().min(1)),
});

/** Loose twin of llmAnalysisSchema for the model's output format: structured outputs
 *  accept only a JSON Schema subset, so the date, code-list and length checks live in the
 *  strict schema that validates the parsed answer afterwards. */
export const llmOutputFormatSchema = z.object({
  document: z.object({
    language: z.string(),
    type: z.enum(DOCUMENT_TYPES),
    title: z.string().nullable(),
    date: z.string().nullable(),
  }),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  entities: z.object({ organizations: z.array(z.string()), people: z.array(z.string()) }),
  amounts: z.array(
    z.object({
      value: z.number(),
      currency: z.string(),
      context: z.string(),
      page: z.number().nullable(),
    }),
  ),
  dates: z.array(z.object({ date: z.string(), context: z.string(), page: z.number().nullable() })),
  keywords: z.array(z.string()),
});

export const analysisMetaSchema = z.object({
  id: z.string().regex(/^ana_[A-Za-z0-9.]+$/, 'expected an analysis id'),
  model: z.string(),
  chunks: z.number().int().min(1),
  scannedPages: z.array(z.number().int().min(1)),
  warnings: z.array(z.string()),
  durationMs: z.number().int().min(0),
  analyzedAt: z.string(),
});

/** The result shape: the document fields, the analysis and the additive `meta` block. */
export const analysisResultSchema = llmAnalysisSchema.extend({
  document: llmDocumentSchema.extend({
    fileName: z.string().min(1),
    pages: z.number().int().min(1),
  }),
  meta: analysisMetaSchema,
});

export type LlmAnalysis = z.infer<typeof llmAnalysisSchema>;
export type AnalysisMeta = z.infer<typeof analysisMetaSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
