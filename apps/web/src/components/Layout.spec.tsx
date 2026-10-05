import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n';
import { Layout } from './Layout';

const show = () =>
  render(
    <I18nProvider>
      <Layout>
        <p>content</p>
      </Layout>
    </I18nProvider>,
  );

describe('Layout', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('links the repository configured at build time', () => {
    vi.stubEnv('VITE_REPOSITORY_URL', 'https://github.com/octo/pdf-insight');
    show();
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/octo/pdf-insight',
    );
  });
  it('omits the link when no repository is configured', () => {
    vi.stubEnv('VITE_REPOSITORY_URL', '');
    show();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'Dokumenty są przetwarzane przez zewnętrzne API AI',
    );
  });
});
