import { describe, expect, it } from 'vitest';
import { analysisResultSchema } from './analysis-result.schema.ts';
import { createAnalysisId, createRequestId, idRegistry, isAnalysisId } from './ids.ts';

describe('ids', () => {
  it('mints analysis ids with the ana prefix that the result schema accepts', () => {
    const id = createAnalysisId();
    expect(id.startsWith('ana_')).toBe(true);
    expect(isAnalysisId(id)).toBe(true);
    expect(idRegistry.kindOf(id)).toBe('analysis');
    expect(analysisResultSchema.shape.meta.shape.id.safeParse(id).success).toBe(true);
  });
  it('mints request ids with the req prefix, distinct from analysis ids', () => {
    const id = createRequestId();
    expect(id.startsWith('req_')).toBe(true);
    expect(isAnalysisId(id)).toBe(false);
  });
});
