import type { AnalysisErrorCode } from '@pdf-insight/domain';
import { CircleAlert } from 'lucide-react';
import { errorKeyFor } from '../app/state';
import { useT } from '../lib/i18n';
import { Alert, AlertTitle } from './ui/alert';
import { Button } from './ui/button';

export function ErrorPanel({
  code,
  retryable,
  onRetry,
  onReset,
}: {
  code: AnalysisErrorCode;
  retryable: boolean;
  onRetry: () => void;
  onReset: () => void;
}) {
  const t = useT();
  return (
    <Alert variant="destructive" className="border-destructive/40 px-5 py-4">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>
        <h2 className="text-base font-semibold">{t('error.title')}</h2>
      </AlertTitle>
      {/* Plain foreground text: the destructive tint is kept for the icon and the title. */}
      <p className="text-base text-foreground group-has-[>svg]/alert:col-start-2">
        {t(errorKeyFor(code))}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 group-has-[>svg]/alert:col-start-2">
        {retryable && (
          <Button className="h-11 px-4" onClick={onRetry}>
            {t('error.retry')}
          </Button>
        )}
        <Button variant="outline" className="h-11 px-4 text-foreground" onClick={onReset}>
          {t('error.back')}
        </Button>
      </div>
    </Alert>
  );
}
