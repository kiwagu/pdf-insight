import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoryEntry } from '@pdf-insight/domain';
import { createLocalStorageHistory } from './local-storage-history';

const entry = (id: string, analyzedAt: string): HistoryEntry => ({
  id,
  fileName: `${id}.pdf`,
  analyzedAt,
  result: {
    document: {
      fileName: `${id}.pdf`,
      pages: 1,
      language: 'pl',
      type: 'inne',
      title: null,
      date: null,
    },
    summary: 'Krotki wpis. Dotyczy testu. Trzy zdania.',
    keyPoints: [],
    entities: { organizations: [], people: [] },
    amounts: [],
    dates: [],
    keywords: [],
    meta: { id, model: 'm', chunks: 1, scannedPages: [], warnings: [], durationMs: 1, analyzedAt },
  },
});

describe('createLocalStorageHistory', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());
  it('lists newest first and survives a reload', () => {
    const h = createLocalStorageHistory(localStorage);
    h.save(entry('ana_1', '2026-10-05T10:00:00.000Z'));
    h.save(entry('ana_2', '2026-10-05T11:00:00.000Z'));
    expect(
      createLocalStorageHistory(localStorage)
        .list()
        .map((e) => e.id),
    ).toEqual(['ana_2', 'ana_1']);
  });
  it('keeps at most max entries and dedupes by id', () => {
    const h = createLocalStorageHistory(localStorage, { max: 2 });
    h.save(entry('ana_1', '2026-10-05T10:00:00.000Z'));
    h.save(entry('ana_2', '2026-10-05T11:00:00.000Z'));
    h.save(entry('ana_2', '2026-10-05T11:00:00.000Z'));
    h.save(entry('ana_3', '2026-10-05T12:00:00.000Z'));
    expect(h.list().map((e) => e.id)).toEqual(['ana_3', 'ana_2']);
  });
  it('drops a stored entry whose summary no longer meets the result schema', () => {
    const history = createLocalStorageHistory(localStorage);
    history.save(entry('ana_1', '2026-10-05T10:00:00.000Z'));
    const stale = entry('ana_2', '2026-10-05T11:00:00.000Z');
    history.save({ ...stale, result: { ...stale.result, summary: 'Jedno zdanie.' } });
    expect(
      createLocalStorageHistory(localStorage)
        .list()
        .map((e) => e.id),
    ).toEqual(['ana_1']);
  });
  it('ignores corrupt storage content and works in memory when storage is unavailable', () => {
    localStorage.setItem('pdf-insight.history.v1', '{broken');
    expect(createLocalStorageHistory(localStorage).list()).toEqual([]);
    const memory = createLocalStorageHistory(null);
    memory.save(entry('ana_9', '2026-10-05T10:00:00.000Z'));
    expect(memory.list()).toHaveLength(1);
  });
  it('keeps the session view after a quota failure and still clears what was persisted', () => {
    const h = createLocalStorageHistory(localStorage);
    h.save(entry('ana_1', '2026-10-05T10:00:00.000Z'));
    // Spy on the prototype: assigning to a Storage instance would store an item instead.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });
    h.save(entry('ana_2', '2026-10-05T11:00:00.000Z'));
    expect(h.list().map((e) => e.id)).toEqual(['ana_2', 'ana_1']);
    expect(
      createLocalStorageHistory(localStorage)
        .list()
        .map((e) => e.id),
    ).toEqual(['ana_1']);
    h.clear();
    expect(h.list()).toEqual([]);
    expect(createLocalStorageHistory(localStorage).list()).toEqual([]);
  });
});
