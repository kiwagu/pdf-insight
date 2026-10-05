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
  let memory: HistoryEntry[] = [];
  // After a failed write the stored copy is stale, so this session reads from memory until a
  // write succeeds again. Every write still goes to storage, so a clear is never lost.
  let memoryOnly = storage === null;

  const read = (): HistoryEntry[] => {
    if (!storage || memoryOnly) return memory;
    try {
      const raw = storage.getItem(key);
      if (!raw) return [];
      const list = z.array(z.unknown()).safeParse(JSON.parse(raw));
      if (!list.success) return [];
      // Entry by entry: one stale or damaged entry must not take the whole history with it.
      return list.data.flatMap((item) => {
        const entry = entrySchema.safeParse(item);
        return entry.success ? [entry.data] : [];
      });
    } catch {
      return [];
    }
  };
  const write = (entries: HistoryEntry[]): void => {
    memory = entries;
    if (!storage) return;
    try {
      if (entries.length === 0) storage.removeItem(key);
      else storage.setItem(key, JSON.stringify(entries));
      memoryOnly = false;
    } catch {
      // quota exceeded or private mode: the in-memory copy serves the rest of this session
      memoryOnly = true;
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
