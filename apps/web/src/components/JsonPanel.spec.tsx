import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadJson } from '../lib/download';
import { I18nProvider } from '../lib/i18n';
import { contractResult as result } from '../test/fixtures';
import { JsonPanel } from './JsonPanel';

vi.mock('../lib/download', () => ({ downloadJson: vi.fn() }));

describe('JsonPanel', () => {
  beforeEach(() => vi.mocked(downloadJson).mockClear());

  it('shows the result as formatted JSON', () => {
    render(
      <I18nProvider>
        <JsonPanel result={result} />
      </I18nProvider>,
    );
    expect(screen.getByText(/"fileName": "umowa.pdf"/)).toBeInTheDocument();
  });
  it('downloads the result as <name>.insight.json', async () => {
    render(
      <I18nProvider>
        <JsonPanel result={result} />
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Pobierz .json' }));
    expect(downloadJson).toHaveBeenCalledWith('umowa.insight.json', result);
  });
  it('copies the JSON and confirms it', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <JsonPanel result={result} />
      </I18nProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Kopiuj' }));
    expect(await navigator.clipboard.readText()).toBe(JSON.stringify(result, null, 2));
    expect(screen.getByRole('button', { name: 'Skopiowano' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
  it('says so when the clipboard refuses the text', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));
    render(
      <I18nProvider>
        <JsonPanel result={result} />
      </I18nProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Kopiuj' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Nie udało się skopiować. Zaznacz tekst i skopiuj ręcznie.',
    );
    expect(screen.getByRole('button', { name: 'Kopiuj' })).toBeInTheDocument();
  });
});
