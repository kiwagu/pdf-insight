import { useT } from '../lib/i18n';

/** Placeholder shell; the upload, progress, result and history views replace it. */
export function App() {
  const t = useT();
  return <h1>{t('app.title')}</h1>;
}
