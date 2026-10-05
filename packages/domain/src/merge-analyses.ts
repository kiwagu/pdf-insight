import type { LlmAnalysis } from '@pdf-insight/contracts';

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

function dedupe<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

const trimAll = (xs: string[]): string[] => xs.map((x) => x.trim()).filter((x) => x.length > 0);

export function mergeAnalyses(partials: LlmAnalysis[]): LlmAnalysis {
  const first = partials[0];
  if (!first) throw new Error('mergeAnalyses needs at least one partial');
  const document = {
    language: first.document.language,
    type: first.document.type,
    title: partials.find((p) => p.document.title !== null)?.document.title ?? null,
    date: partials.find((p) => p.document.date !== null)?.document.date ?? null,
  };
  return {
    document,
    summary: first.summary,
    keyPoints: dedupe(trimAll(partials.flatMap((p) => p.keyPoints)), norm).slice(0, 7),
    entities: {
      organizations: dedupe(trimAll(partials.flatMap((p) => p.entities.organizations)), norm),
      people: dedupe(trimAll(partials.flatMap((p) => p.entities.people)), norm),
    },
    amounts: dedupe(
      partials.flatMap((p) => p.amounts),
      (a) => `${a.value}|${a.currency}|${norm(a.context)}`,
    ),
    dates: dedupe(
      partials.flatMap((p) => p.dates),
      (d) => `${d.date}|${norm(d.context)}`,
    ),
    keywords: dedupe(trimAll(partials.flatMap((p) => p.keywords)), norm),
  };
}
