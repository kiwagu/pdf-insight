import { analysisResultSchema } from '@pdf-insight/contracts';
import type { AnalysisHistory, HistoryEntry } from '@pdf-insight/domain';
import { z } from 'zod';

const entrySchema = z.object({
  id: z.string(),
  fileName: z.string(),
  analyzedAt: z.string(),
  result: analysisResultSchema,
});

export function createLocalStorageHistory(
  storage: Storage | null,
  options: { key?: string; max?: number } = {},
): AnalysisHistory {
  const key = options.key ?? 'pdf-insight.history.v1';
  const max = options.max ?? 10;
  // Once a write to storage fails, this session keeps its history in memory only.
  let backend = storage;
  let memory: HistoryEntry[] = [];

  const read = (): HistoryEntry[] => {
    if (!backend) return memory;
    try {
      const raw = backend.getItem(key);
      if (!raw) return [];
      const parsed = z.array(entrySchema).safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  };
  const write = (entries: HistoryEntry[]): void => {
    memory = entries;
    if (!backend) return;
    try {
      backend.setItem(key, JSON.stringify(entries));
    } catch {
      // quota exceeded or private mode: the in-memory copy serves the rest of this session
      backend = null;
    }
  };
  const sorted = (entries: HistoryEntry[]) =>
    [...entries].sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt));

  return {
    list: () => sorted(read()),
    save: (entry) =>
      write(sorted([entry, ...read().filter((e) => e.id !== entry.id)]).slice(0, max)),
    clear: () => write([]),
  };
}
