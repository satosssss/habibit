import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession, signOut } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(async () => undefined),
}));
vi.mock('next-auth/react', () => ({ getSession, signOut }));

import { clearAll, saveProfile } from '@/lib/repo';
import { AccountPanel } from './AccountPanel';

beforeEach(async () => {
  await clearAll();
  signOut.mockClear();
  getSession.mockResolvedValue({
    user: { name: 'Ada Lovelace', email: 'ada@example.com', image: null },
  });
});

describe('AccountPanel (account spec R1 / D4)', () => {
  it('shows only name and email from the session', async () => {
    render(<AccountPanel />);
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.queryByText(/locale/i)).not.toBeInTheDocument();
  });

  it('warns when a different Google account signs in on this device', async () => {
    await saveProfile({ accountEmail: 'grace@example.com' }, 1_000);
    render(<AccountPanel />);
    expect(await screen.findByText(/grace@example.com/)).toBeInTheDocument();
    expect(screen.getAllByText(/ada@example.com/).length).toBeGreaterThan(0);
    expect(screen.getByText(/shares one set of data/i)).toBeInTheDocument();
  });

  it('stays quiet when the same account returns', async () => {
    await saveProfile({ accountEmail: 'ada@example.com' }, 1_000);
    render(<AccountPanel />);
    await screen.findByText('ada@example.com');
    expect(screen.queryByText(/shares one set of data/i)).not.toBeInTheDocument();
  });

  it('signs out back to /login and says the data stays', async () => {
    render(<AccountPanel />);
    const button = await screen.findByRole('button', { name: /sign out/i });
    fireEvent.click(button);
    await waitFor(() => expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login' }));
    expect(screen.getByText(/leaves your habits on this device/i)).toBeInTheDocument();
  });

  it('degrades to a note when the session cannot be read', async () => {
    getSession.mockResolvedValue(null);
    render(<AccountPanel />);
    expect(await screen.findByText(/unavailable offline/i)).toBeInTheDocument();
  });
});
