import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { I18nProvider, useT } from '../lib/i18n';
import { LanguageToggle } from './LanguageToggle';

function Probe() {
  const t = useT();
  return <p>{t('upload.pick')}</p>;
}

describe('LanguageToggle', () => {
  it('switches every string and marks the active language', async () => {
    render(
      <I18nProvider>
        <LanguageToggle />
        <Probe />
      </I18nProvider>,
    );
    const pl = screen.getByRole('button', { name: 'PL' });
    const en = screen.getByRole('button', { name: 'EN' });
    expect(pl).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Wybierz plik')).toBeInTheDocument();
    await userEvent.click(en);
    expect(screen.getByText('Choose a file')).toBeInTheDocument();
    expect(en).toHaveAttribute('aria-pressed', 'true');
    expect(pl).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.lang).toBe('en');
  });
  it('keeps the active language when its own button is pressed again', async () => {
    render(
      <I18nProvider>
        <LanguageToggle />
        <Probe />
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'PL' }));
    expect(screen.getByRole('button', { name: 'PL' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Wybierz plik')).toBeInTheDocument();
  });
});
