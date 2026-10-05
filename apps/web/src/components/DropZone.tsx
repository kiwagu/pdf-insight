import { FileUp, Info } from 'lucide-react';
import { useId, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { useT } from '../lib/i18n';
import { buttonVariants } from './ui/button';
import { Card, CardContent } from './ui/card';

/**
 * The upload target: drop a file on it, or reach it with Tab and press Enter or Space to open the
 * file picker. The picker input itself is hidden and out of the tab order, so the zone is the one
 * control for both ways; the visible "choose a file" label is styled like a button but is part
 * of the zone, which avoids a button nested inside a button.
 */
export function DropZone({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled: boolean;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const hintId = useId();
  const noticeId = useId();

  const open = () => {
    if (!disabled) inputRef.current?.click();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (!e.repeat) open();
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setOver(true);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // Moving across the zone's own children fires dragleave too; only leaving the zone counts.
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
    setOver(false);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files[0];
    if (file && !disabled) onFile(file);
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label={t('upload.dropHint')}
          aria-describedby={`${hintId} ${noticeId}`}
          data-over={over || undefined}
          className="flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border px-4 py-8 text-center transition-colors outline-none hover:border-ring hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 data-over:border-primary data-over:bg-muted motion-reduce:transition-none"
          onClick={open}
          onKeyDown={onKeyDown}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <FileUp aria-hidden="true" className="size-10 text-muted-foreground" />
          <p className="text-base font-medium">{t('upload.dropHint')}</p>
          <p className="text-muted-foreground">{t('upload.or')}</p>
          <span className={buttonVariants({ className: 'h-11 px-4' })}>{t('upload.pick')}</span>
        </div>
        <input
          ref={inputRef}
          data-testid="file-input"
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          tabIndex={-1}
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Cleared so that picking the same file again still fires a change.
            e.target.value = '';
            if (file) onFile(file);
          }}
        />
        <p id={hintId} className="text-center text-sm text-muted-foreground">
          {t('upload.constraints')}
        </p>
        <p id={noticeId} className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{t('upload.privacyNotice')}</span>
        </p>
      </CardContent>
    </Card>
  );
}
