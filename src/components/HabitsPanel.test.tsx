import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll } from '@/lib/repo';
import { HabitsPanel } from './HabitsPanel';

beforeEach(async () => { await clearAll(); });

describe('HabitsPanel (spec R3)', () => {
  it('shows Loading… on first paint — never an empty list mid-load', () => {
    render(<HabitsPanel />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByTestId(/^habit-row-/)).not.toBeInTheDocument();
  });

  it('shows the empty state once loaded with no habits', async () => {
    render(<HabitsPanel />);
    expect(await screen.findByText('No habits yet — create one.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new habit/i })).toBeInTheDocument();
  });
});
