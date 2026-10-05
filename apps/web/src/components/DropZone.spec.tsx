import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n';
import { DropZone } from './DropZone';

const wrap = (ui: ReactElement) => render(<I18nProvider>{ui}</I18nProvider>);
const pdf = () => new File(['%PDF-1.4'], 'a.pdf', { type: 'application/pdf' });

describe('DropZone', () => {
  it('is keyboard reachable and opens the picker on Enter', async () => {
    const onFile = vi.fn<(file: File) => void>();
    wrap(<DropZone onFile={onFile} disabled={false} />);
    const zone = screen.getByRole('button', { name: /PDF/ });
    const input = screen.getByTestId<HTMLInputElement>('file-input');
    const click = vi.spyOn(input, 'click');
    await userEvent.tab();
    expect(zone).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(click).toHaveBeenCalledTimes(1);
  });
  it('opens the picker on Space too', async () => {
    wrap(<DropZone onFile={vi.fn()} disabled={false} />);
    const zone = screen.getByRole('button', { name: /PDF/ });
    const click = vi.spyOn(screen.getByTestId<HTMLInputElement>('file-input'), 'click');
    zone.focus();
    await userEvent.keyboard(' ');
    expect(click).toHaveBeenCalledTimes(1);
  });
  it('shows the privacy notice and the constraints', () => {
    wrap(<DropZone onFile={vi.fn()} disabled={false} />);
    expect(screen.getByText(/API AI/)).toBeInTheDocument();
    expect(screen.getByText(/10 MB/)).toBeInTheDocument();
  });
  it('hands a picked file to onFile', async () => {
    const onFile = vi.fn<(file: File) => void>();
    wrap(<DropZone onFile={onFile} disabled={false} />);
    const file = pdf();
    await userEvent.upload(screen.getByTestId('file-input'), file);
    expect(onFile).toHaveBeenCalledWith(file);
  });
  it('hands a dropped file to onFile', () => {
    const onFile = vi.fn<(file: File) => void>();
    wrap(<DropZone onFile={onFile} disabled={false} />);
    const file = pdf();
    fireEvent.drop(screen.getByRole('button', { name: /PDF/ }), {
      dataTransfer: { files: [file], types: ['Files'] },
    });
    expect(onFile).toHaveBeenCalledWith(file);
  });
  it('ignores drops and keys while disabled', async () => {
    const onFile = vi.fn<(file: File) => void>();
    wrap(<DropZone onFile={onFile} disabled />);
    const zone = screen.getByRole('button', { name: /PDF/ });
    const click = vi.spyOn(screen.getByTestId<HTMLInputElement>('file-input'), 'click');
    expect(zone).toHaveAttribute('aria-disabled', 'true');
    fireEvent.drop(zone, { dataTransfer: { files: [pdf()], types: ['Files'] } });
    zone.focus();
    await userEvent.keyboard('{Enter}');
    expect(onFile).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });
});
