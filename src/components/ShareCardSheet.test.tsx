import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderShareCard, shareCardBlob } from '@/lib/shareCardCanvas';
import { ShareCardSheet } from './ShareCardSheet';

const { badgeRows } = vi.hoisted(() => ({ badgeRows: [] as { id: string; earnedAt: number }[] }));

// Stable identity: a fresh [] every render would rebuild the model and re-run
// the generation effect forever.
vi.mock('@/lib/useLiveQuery', () => ({ useLiveQuery: () => badgeRows }));
vi.mock('@/lib/shareCardCanvas', () => ({
  renderShareCard: vi.fn(async () => ({ width: 1080, height: 1350 })),
  shareCardBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));

const props = {
  onClose: vi.fn(),
  habits: [],
  entries: [],
  year: 2026,
  today: '2026-11-04',
};

const setShare = (share: (data?: ShareData) => Promise<void>) => {
  Object.defineProperty(navigator, 'share', { configurable: true, value: share });
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:card'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'canShare');
  Reflect.deleteProperty(navigator, 'share');
});

describe('ShareCardSheet (R3)', () => {
  it('renders the preview and the aggregate summary', async () => {
    render(<ShareCardSheet {...props} open />);
    const image = await screen.findByRole('img', { name: /your 2026 habibit year in review/i });
    expect(image).toHaveAttribute('src', 'blob:card');
    expect(screen.getByText(/0 active days/)).toBeInTheDocument();
    expect(vi.mocked(renderShareCard)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(shareCardBlob)).toHaveBeenCalledTimes(1);
  });

  it('downloads the PNG with a year-stamped filename', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createElement = vi.spyOn(document, 'createElement');

    render(<ShareCardSheet {...props} open />);
    const button = await screen.findByRole('button', { name: /download png/i });
    expect(button.className).toContain('py-2.5');   // ≥40px action
    fireEvent.click(button);

    const anchor = createElement.mock.results
      .map((result) => result.value)
      .find((el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement);
    expect(anchor).toBeDefined();
    expect(anchor!.download).toBe('habibit-2026.png');
    expect(anchor!.getAttribute('href')).toBe('blob:card');
    expect(await screen.findByRole('status')).toHaveTextContent('Card downloaded.');
    click.mockRestore();
    createElement.mockRestore();
  });

  it('uses the native share sheet when the browser supports files', async () => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn(() => true) });
    const share = vi.fn<(data?: ShareData) => Promise<void>>(async () => {});
    setShare(share);

    render(<ShareCardSheet {...props} open />);
    const button = await screen.findByRole('button', { name: /^share$/i });
    fireEvent.click(button);

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const data = share.mock.calls[0]?.[0];
    expect(data?.files?.[0].name).toBe('habibit-2026.png');
    expect(await screen.findByRole('status')).toHaveTextContent('Card shared.');
  });

  it('stays quiet when the user cancels the share sheet', async () => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn(() => true) });
    const cancel = new Error('cancelled');
    cancel.name = 'AbortError';
    const share = vi.fn(async () => { throw cancel; });
    setShare(share);

    render(<ShareCardSheet {...props} open />);
    fireEvent.click(await screen.findByRole('button', { name: /^share$/i }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('explains a generation failure and disables the actions', async () => {
    vi.mocked(renderShareCard).mockRejectedValueOnce(new Error('no canvas'));

    render(<ShareCardSheet {...props} open />);
    expect(await screen.findByRole('alert'))
      .toHaveTextContent("Couldn't create the card. Try again.");
    expect(screen.getByRole('button', { name: /download png/i })).toBeDisabled();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('revokes the preview URL when the sheet closes', async () => {
    const { rerender } = render(<ShareCardSheet {...props} open />);
    await screen.findByRole('img', { name: /year in review/i });

    rerender(<ShareCardSheet {...props} open={false} />);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:card');
  });
});
