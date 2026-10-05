import type { ReactNode } from 'react';
import { useT } from '../lib/i18n';
import { repositoryUrl } from '../lib/repository-url';
import { LanguageToggle } from './LanguageToggle';
import { Separator } from './ui/separator';

export function Layout({ children }: { children: ReactNode }) {
  const t = useT();
  const repo = repositoryUrl(window.location);
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-4xl flex-col px-4 sm:px-6">
      <header className="flex items-start justify-between gap-4 py-6">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{t('app.title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('app.tagline')}</p>
        </div>
        <LanguageToggle />
      </header>
      <Separator />
      <main className="flex flex-1 flex-col gap-6 py-6">{children}</main>
      <Separator />
      <footer className="flex flex-col gap-2 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>{t('footer.note')}</p>
        {repo && (
          <a
            href={repo}
            className="inline-flex min-h-11 items-center self-start rounded-md font-medium text-foreground underline underline-offset-4 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50 sm:self-auto"
          >
            GitHub
          </a>
        )}
      </footer>
    </div>
  );
}
