import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { clearAll, saveProfile } from '@/lib/repo';
import { ProfilePanel } from './ProfilePanel';

beforeEach(async () => { await clearAll(); });

describe('ProfilePanel (account spec R2)', () => {
  it('offers setup when the device has no profile', async () => {
    render(<ProfilePanel />);
    expect(await screen.findByText(/no profile on this device yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /set up your profile/i })).toHaveAttribute('href', '/onboarding');
  });

  it('shows the saved answers and an edit link', async () => {
    await saveProfile({
      goals: { items: ['Sleep better', 'Move daily'] },
      lifestyle: { wakeTime: '06:30', sleepTime: '22:00', schedule: 'Office', activityLevel: 'high' },
      challenges: 'No time',
      preferences: { tone: 'direct', reminderTime: '08:00' },
    }, 1_000);

    render(<ProfilePanel />);
    expect(await screen.findByText('Goals: Sleep better, Move daily')).toBeInTheDocument();
    expect(screen.getByText(/06:30–22:00/)).toBeInTheDocument();
    expect(screen.getByText(/Hard before: No time/)).toBeInTheDocument();
    expect(screen.getByText(/Coaching: direct/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /edit profile/i })).toHaveAttribute('href', '/onboarding');
  });

  it('nudges a skipped profile to add goals', async () => {
    await saveProfile({ skipped: true }, 1_000);
    render(<ProfilePanel />);
    expect(await screen.findByText(/you skipped setup/i)).toBeInTheDocument();
  });
});
