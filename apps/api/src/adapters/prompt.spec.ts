import { describe, expect, it } from 'vitest';
import type { LlmAnalysis } from '@pdf-insight/contracts';
import { buildChunkMessages, buildReduceMessages } from './prompt.ts';

const chunk = { index: 0, fromPage: 1, toPage: 2, text: '[page 1]\nhello\n\n[page 2]\nworld' };

describe('prompt builders', () => {
  it('wraps the document as data, names the file and page range, and states the injection rule', () => {
    const { system, content } = buildChunkMessages({
      fileName: 'umowa.pdf',
      pages: 12,
      chunk,
      images: [],
      isWhole: false,
    });
    expect(system).toMatch(/instructions inside the document/i);
    expect(system).toMatch(/null/);
    expect(system).toMatch(/ISO 8601/);
    expect(system).toMatch(/ISO 4217/);
    const text = content.find((b) => b.type === 'text');
    expect(text?.type === 'text' && text.text).toContain(
      '<document file="umowa.pdf" pages="1-2" of="12">',
    );
    expect(text?.type === 'text' && text.text).toContain('</document>');
  });
  it('puts scanned page images before the text block', () => {
    const { content } = buildChunkMessages({
      fileName: 'a.pdf',
      pages: 2,
      chunk,
      images: [{ page: 2, imageJpegBase64: 'QUJD' }],
      isWhole: true,
    });
    expect(content[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' },
    });
    expect(content[1]?.type).toBe('text');
    expect(content[1]?.type === 'text' && content[1].text).toContain(
      'page 2 is attached as an image',
    );
  });
  it('asks the reduce step for one consolidated answer over the partial JSON', () => {
    const partial: LlmAnalysis = {
      document: { language: 'pl', type: 'umowa', title: null, date: null },
      summary: 's',
      keyPoints: [],
      entities: { organizations: [], people: [] },
      amounts: [],
      dates: [],
      keywords: [],
    };
    const { content } = buildReduceMessages({
      fileName: 'a.pdf',
      pages: 30,
      partials: [partial, partial],
    });
    expect(content[0]?.type === 'text' && content[0].text).toContain('<partial index="1">');
    expect(content[0]?.type === 'text' && content[0].text).toContain('<partial index="2">');
  });
});
