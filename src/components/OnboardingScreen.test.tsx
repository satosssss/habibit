import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('next-auth/react', () => ({ getSession }));

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { clearAll, getProfile, saveProfile } from '@/lib/repo';
import { OnboardingScreen } from './OnboardingScreen';

beforeEach(async () => {
  await clearAll();
  replace.mockClear();
  getSession.mockResolvedValue({ user: { email: 'me@example.com' } });
});

/** Clicks Next and waits for the progress bar to reach `expected`. */
const nextStep = async (expected: number) => {
  fireEvent.click(screen.getByRole('button', { name: /^next/i }));
  await waitFor(() => {
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(expected));
  });
};

describe('OnboardingScreen (account spec R3)', () => {
  it('starts on step 1 of 4 with a text progress indicator', async () => {
    render(<OnboardingScreen />);
    expect(await screen.findByText(/Step 1 of 4 · Lifestyle/)).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    expect(bar).toHaveAttribute('aria-valuemax', '4');
  });

  it('walks forward and back through the four groups', async () => {
    render(<OnboardingScreen />);
    await screen.findByText(/Step 1 of 4/);
    await nextStep(2);
    expect(screen.getByText(/Step 2 of 4 · Goals/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(await screen.findByText(/Step 1 of 4 · Lifestyle/)).toBeInTheDocument();
  });

  it('saves the answers and the account marker on first sign-in', async () => {
    render(<OnboardingScreen />);
    await screen.findByText(/Step 1 of 4/);
    fireEvent.change(screen.getByLabelText(/wake time/i), { target: { value: '06:30' } });
    fireEvent.change(screen.getByLabelText(/work or school schedule/i), { target: { value: 'Office 9–5' } });
    await nextStep(2);
    fireEvent.change(await screen.findByLabelText('Goal 1'), { target: { value: 'Move daily' } });
    await nextStep(3);
    await nextStep(4);
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'));
    const profile = await getProfile();
    expect(profile?.goals.items).toEqual(['Move daily']);
    expect(profile?.lifestyle.wakeTime).toBe('06:30');
    expect(profile?.accountEmail).toBe('me@example.com');
    expect(profile?.skipped).toBe(false);
    expect(profile?.onboardedAt).toBeGreaterThan(0);
  });

  it('skips from any step and still records who set the device up', async () => {
    render(<OnboardingScreen />);
    await screen.findByText(/Step 1 of 4/);
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'));
    const profile = await getProfile();
    expect(profile?.skipped).toBe(true);
    expect(profile?.accountEmail).toBe('me@example.com');
  });

  it('blocks Save with no goals and says why', async () => {
    render(<OnboardingScreen />);
    await screen.findByText(/Step 1 of 4/);
    await nextStep(2);
    await nextStep(3);
    await nextStep(4);
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/add at least one goal/i);
    expect(await screen.findByText(/Step 2 of 4 · Goals/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('prefills and edits an existing profile instead of starting over', async () => {
    await saveProfile({
      goals: { items: ['Sleep better'] },
      lifestyle: { sleepTime: '21:45' },
      accountEmail: 'first@example.com',
    }, 1_000);

    render(<OnboardingScreen />);
    expect(await screen.findByText('Edit profile')).toBeInTheDocument();
    expect(screen.getByLabelText(/sleep time/i)).toHaveValue('21:45');
    expect(screen.getByRole('link', { name: /cancel/i })).toHaveAttribute('href', '/settings');

    await nextStep(2);
    expect(await screen.findByDisplayValue('Sleep better')).toBeInTheDocument();
  });

  it('never rewrites the account that owns the device', async () => {
    await saveProfile({ goals: { items: ['Old goal'] }, accountEmail: 'first@example.com' }, 1_000);
    getSession.mockResolvedValue({ user: { email: 'second@example.com' } });

    render(<OnboardingScreen />);
    await screen.findByText('Edit profile');
    await nextStep(2);
    await nextStep(3);
    await nextStep(4);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'));
    expect((await getProfile())?.accountEmail).toBe('first@example.com');
  });

  it('offers quick picks on the challenges step', async () => {
    render(<OnboardingScreen />);
    await screen.findByText(/Step 1 of 4/);
    await nextStep(2);
    await nextStep(3);
    fireEvent.click(await screen.findByRole('button', { name: 'No time' }));
    expect(screen.getByRole('button', { name: 'No time' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/hard to keep/i)).toHaveValue('No time');
  });
});
