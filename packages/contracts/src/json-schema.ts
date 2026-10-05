import { z } from 'zod';
import { analysisResultSchema } from './analysis-result.schema.ts';

/** JSON Schema of the result, for the README and for consumers outside TypeScript. */
export function analysisResultJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(analysisResultSchema);
}
