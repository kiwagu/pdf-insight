import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HistoryEntry } from '@pdf-insight/domain';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n';
import { contractResult as result } from '../test/fixtures';
import { HistoryList } from './HistoryList';

const entry: HistoryEntry = {
  id: result.meta.id,
  fileName: result.document.fileName,
  analyzedAt: result.meta.analyzedAt,
  result,
};

describe('HistoryList', () => {
  it('shows the empty message when nothing is stored', () => {
    render(
      <I18nProvider>
        <HistoryList entries={[]} onRestore={vi.fn()} onClear={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByText(/Brak zapisanych analiz/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Wyczyść historię' })).not.toBeInTheDocument();
  });
  it('restores an entry and clears the list', async () => {
    const onRestore = vi.fn<(entry: HistoryEntry) => void>();
    const onClear = vi.fn<() => void>();
    render(
      <I18nProvider>
        <HistoryList entries={[entry]} onRestore={onRestore} onClear={onClear} />
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /umowa\.pdf/ }));
    expect(onRestore).toHaveBeenCalledWith(entry);
    await userEvent.click(screen.getByRole('button', { name: 'Wyczyść historię' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
  it('disables the entries while an analysis runs', () => {
    render(
      <I18nProvider>
        <HistoryList entries={[entry]} onRestore={vi.fn()} onClear={vi.fn()} disabled />
      </I18nProvider>,
    );
    expect(screen.getByRole('button', { name: /umowa\.pdf/ })).toBeDisabled();
  });
});
