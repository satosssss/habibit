import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(<Sheet open={false} onClose={vi.fn()} title="Timer"><span>body</span></Sheet>);
    expect(screen.queryByText('body')).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="Timer"><span>body</span></Sheet>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the backdrop is clicked but not the panel', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Sheet open onClose={onClose} title="Timer"><span>body</span></Sheet>
    );
    fireEvent.click(screen.getByText('body'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('[data-sheet-backdrop]')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('centers as a dialog from md by default', () => {
    const { container } = render(
      <Sheet open onClose={vi.fn()} title="Timer"><span>body</span></Sheet>
    );
    const wrap = container.querySelector('[data-sheet-backdrop]')!.parentElement!;
    expect(wrap.className).toContain('md:items-center');
    expect(screen.getByRole('dialog').className).toContain('md:max-w-lg');
  });

  it('defers the centered dialog to lg when asked (timer breakpoint, spec §6)', () => {
    const { container } = render(
      <Sheet open onClose={vi.fn()} title="Timer" centerFrom="lg"><span>body</span></Sheet>
    );
    const wrap = container.querySelector('[data-sheet-backdrop]')!.parentElement!;
    expect(wrap.className).toContain('lg:items-center');
    expect(wrap.className).not.toContain('md:items-center');
    expect(screen.getByRole('dialog').className).toContain('lg:max-w-lg');
    expect(screen.getByRole('dialog').className).not.toContain('md:max-w-lg');
  });
});
