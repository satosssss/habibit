import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '@/lib/repo';
import { blankHabit, HabitsPanel } from './HabitsPanel';

// data-next-link marks router-rendered anchors so tests can tell a real
// next/link apart from a hand-written <a> (both render <a> in jsdom).
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-next-link="" {...rest}>{children}</a>
  ),
}));

beforeEach(async () => { await clearAll(); });

describe('HabitsPanel (spec R3)', () => {
  it('shows Loading… on first paint — never an empty list mid-load', () => {
    render(<HabitsPanel />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByTestId(/^habit-row-/)).not.toBeInTheDocument();
  });

  it('constructs a blank habit with the add-habit detail defaults', () => {
    expect(blankHabit()).toMatchObject({ difficulty: 'medium', reminderTime: '' });
  });

  it('shows the empty state once loaded with no habits', async () => {
    render(<HabitsPanel />);
    const cta = await screen.findByRole('link', { name: 'No habits yet — create one.' });
    expect(cta).toHaveAttribute('href', '/add-habit');
    expect(cta).toHaveAttribute('data-next-link');
  });

  it('shimmers the loading line and prints New habit on the accent token (slice D)', async () => {
    render(<HabitsPanel />);   // habits undefined → the loading harness
    const loading = screen.getByText('Loading…');
    expect(loading.className).toContain('skeleton');
    const add = await screen.findByRole('link', { name: /new habit/i });
    expect(add.className).toContain('text-[var(--color-on-accent)]');
    expect(add.className).not.toContain('text-white');
  });
});
