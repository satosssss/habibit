import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsScreen } from './SettingsScreen';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe('SettingsScreen (slice E R3)', () => {
  it('keeps Settings without the habits panel', () => {
    render(<SettingsScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Habits' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /new habit/i })).not.toBeInTheDocument();
    expect(screen.queryByText('No habits yet — create one.')).not.toBeInTheDocument();
  });
});
