import type { AnalysisResult } from '@pdf-insight/contracts';
import { Check, Copy, Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { downloadJson } from '../lib/download';
import { useT } from '../lib/i18n';
import { Section } from './Section';
import { Button } from './ui/button';

const COPIED_MS = 1500;

export function JsonPanel({ result }: { result: AnalysisResult }) {
  const t = useT();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const text = JSON.stringify(result, null, 2);
  const fileName = `${result.document.fileName.replace(/\.pdf$/i, '')}.insight.json`;
  const copy = async () => {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
      timer.current = setTimeout(() => setCopyState('idle'), COPIED_MS);
    } catch {
      // No clipboard (an insecure context) or a denied permission: say so, and the text stays
      // selectable in the block below.
      setCopyState('failed');
    }
  };
  const copied = copyState === 'copied';

  return (
    <Section
      title={t('json.title')}
      action={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" className="h-11 px-3" onClick={() => void copy()}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? t('json.copied') : t('json.copy')}
          </Button>
          <Button className="h-11 px-3" onClick={() => downloadJson(fileName, result)}>
            <Download aria-hidden="true" />
            {t('json.download')}
          </Button>
        </div>
      }
    >
      <div>
        {/* Present while empty, so screen readers announce the message when it appears. */}
        <p role="status" className="text-sm text-destructive not-empty:mb-3">
          {copyState === 'failed' ? t('json.copyFailed') : null}
        </p>
        {/* Focusable so the scrollable block can be scrolled with the keyboard. */}
        <pre
          tabIndex={0}
          className="max-h-96 overflow-auto rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {text}
        </pre>
      </div>
    </Section>
  );
}
