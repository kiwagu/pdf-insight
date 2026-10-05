import { LoaderCircle } from 'lucide-react';
import { useT } from '../lib/i18n';
import { Card, CardContent } from './ui/card';

export function AnalysisProgress({
  stage,
  pages,
}: {
  stage: 'extracting' | 'analyzing';
  pages: number | undefined;
}) {
  const t = useT();
  return (
    <Card>
      <CardContent
        role="status"
        aria-live="polite"
        className="flex min-h-56 flex-col items-center justify-center gap-3 text-center"
      >
        <LoaderCircle
          aria-hidden="true"
          className="size-10 animate-spin text-muted-foreground motion-reduce:animate-none"
        />
        <p className="text-base font-medium">
          {t(stage === 'extracting' ? 'progress.extracting' : 'progress.analyzing')}
        </p>
        {pages !== undefined && (
          <p className="text-muted-foreground">{t('progress.pages', { pages })}</p>
        )}
        <p className="text-sm text-muted-foreground">{t('progress.hint')}</p>
      </CardContent>
    </Card>
  );
}
