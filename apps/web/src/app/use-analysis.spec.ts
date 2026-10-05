import { act, renderHook, waitFor } from '@testing-library/react';
import type { ExtractedDocument, TextExtractor } from '@pdf-insight/domain';
import { describe, expect, it, vi } from 'vitest';
import { entryOf, extracted, fakeContainer, pdfWithHeldCheck } from '../test/fake-container';
import { contractResult, shortResult } from '../test/fixtures';
import type { Container } from './container';
import { useAnalysis } from './use-analysis';

const track = (c: Container) => {
  const statuses: string[] = [];
  const hook = renderHook(() => {
    const analysis = useAnalysis(c);
    statuses.push(analysis.state.status);
    return analysis;
  });
  return { ...hook, statuses };
};

describe('useAnalysis', () => {
  it('reports a run as pending from the pick until it settles', async () => {
    const { result } = track(fakeContainer());
    const { file, release } = pdfWithHeldCheck();
    let running: Promise<void> = Promise.resolve();
    act(() => {
      running = result.current.run(file);
    });
    expect(result.current.pending).toBe(true);
    await act(async () => {
      release();
      await running;
    });
    expect(result.current.pending).toBe(false);
    expect(result.current.state).toEqual({ status: 'done', result: shortResult });
  });

  it('a run superseded by a history restore while its file is checked dispatches nothing', async () => {
    const c = fakeContainer();
    const { result, statuses } = track(c);
    const entry = entryOf(contractResult);
    const { file, release } = pdfWithHeldCheck();
    let running: Promise<void> = Promise.resolve();
    act(() => {
      running = result.current.run(file);
    });
    act(() => result.current.restore(entry));
    await act(async () => {
      release();
      await running;
    });
    expect(result.current.state).toEqual({ status: 'done', result: contractResult });
    expect(statuses).not.toContain('extracting');
    expect(c.extractor.extract).not.toHaveBeenCalled();
    expect(c.analyzer.analyze).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
  });

  it('accepts a new file once the superseded run has let go', async () => {
    const c = fakeContainer();
    const { result } = track(c);
    const held = pdfWithHeldCheck();
    let running: Promise<void> = Promise.resolve();
    act(() => {
      running = result.current.run(held.file);
    });
    act(() => result.current.reset());
    await act(async () => {
      held.release();
      await running;
    });
    expect(result.current.state).toEqual({ status: 'idle' });
    await act(() => result.current.run(new File(['%PDF-1.4'], 'next.pdf')));
    expect(result.current.state).toEqual({ status: 'done', result: shortResult });
    expect(c.analyzer.analyze).toHaveBeenCalledTimes(1);
  });

  it('a run superseded while the file is read never sends it for analysis', async () => {
    let finishReading: (doc: ExtractedDocument) => void = () => undefined;
    const extract = vi.fn<TextExtractor['extract']>(
      () => new Promise((resolve) => (finishReading = resolve)),
    );
    const c = fakeContainer(undefined, [], extract);
    const { result } = track(c);
    let running: Promise<void> = Promise.resolve();
    act(() => {
      running = result.current.run(new File(['%PDF-1.4'], 'a.pdf'));
    });
    await waitFor(() => expect(extract).toHaveBeenCalledTimes(1));
    expect(result.current.state).toEqual({ status: 'extracting' });
    act(() => result.current.reset());
    await act(async () => {
      finishReading(extracted);
      await running;
    });
    expect(c.analyzer.analyze).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ status: 'idle' });
    expect(result.current.pending).toBe(false);
  });
});
