import { z } from 'zod';
import { analysisResultSchema } from './analysis-result.schema.ts';

export const MAX_SCANNED_PAGES = 5;
export const MAX_IMAGE_BASE64_LENGTH = 2_000_000;
export const MAX_PAGE_TEXT_LENGTH = 50_000;

/** Wall-clock budget of one analysis on the server, from the request's arrival to the answer,
 *  kept under the Edge Function's 150 s wall-clock limit. Every model call draws on it. */
export const ANALYSIS_BUDGET_MS = 140_000;
/** How long the browser waits for the answer: the server budget plus a margin for the transfer. */
export const CLIENT_TIMEOUT_MS = ANALYSIS_BUDGET_MS + 10_000;

export const scannedPageSchema = z.object({
  page: z.number().int().min(1),
  imageJpegBase64: z.string().min(1).max(MAX_IMAGE_BASE64_LENGTH),
});

export const analyzeRequestSchema = z
  .object({
    fileName: z.string().min(1).max(255),
    pages: z.number().int().min(1).max(2000),
    pageTexts: z.array(z.string().max(MAX_PAGE_TEXT_LENGTH)),
    scannedPages: z.array(scannedPageSchema).max(MAX_SCANNED_PAGES).default([]),
  })
  .refine((r) => r.pageTexts.length === r.pages, {
    message: 'pageTexts must have one entry per page',
    path: ['pageTexts'],
  })
  .refine((r) => r.scannedPages.every((s) => s.page <= r.pages), {
    message: 'scanned page outside the page range',
    path: ['scannedPages'],
  });

export const API_ERROR_CODES = [
  'invalid_request',
  'payload_too_large',
  'origin_forbidden',
  'rate_limited',
  'analysis_failed',
  'upstream_error',
  'analysis_timeout',
] as const;

export const apiErrorSchema = z.object({
  code: z.enum(API_ERROR_CODES),
  message: z.string(),
  retryable: z.boolean(),
});

export const analyzeResponseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), result: analysisResultSchema }),
  z.object({ ok: z.literal(false), error: apiErrorSchema }),
]);

export type ScannedPage = z.infer<typeof scannedPageSchema>;
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type AnalyzeRequestInput = z.input<typeof analyzeRequestSchema>;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
export type ApiError = z.infer<typeof apiErrorSchema>;
export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;
