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

import { todayKey } from '@/lib/dates';
import { clearAll, getProfile, listHabits, loadDay, saveProfile } from '@/lib/repo';
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

describe('OnboardingScreen (onboarding v2)', () => {
  it('starts on step 1 of 5 and asks for a name', async () => {
    render(<OnboardingScreen />);
    expect(await screen.findByText(/Step 1 of 5 · You/)).toBeInTheDocument();
    expect(screen.getByLabelText(/what should we call you/i)).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
  });

  it('walks forward and back through the five steps', async () => {
    render(<OnboardingScreen />);
    await screen.findByText(/Step 1 of 5/);
    await nextStep(2);
    expect(screen.getByText(/Step 2 of 5 · Your day/)).toBeInTheDocument();
    await nextStep(3);
    expect(screen.getByText(/Step 3 of 5 · Goals/)).toBeInTheDocument();
    await nextStep(4);
    expect(screen.getByText(/Step 4 of 5 · Obstacles/)).toBeInTheDocument();
    await nextStep(5);
    expect(screen.getByText(/Step 5 of 5 · First habits/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(await screen.findByText(/Step 4 of 5/)).toBeInTheDocument();
  });

  it('saves the name, avatar and account marker on skip', async () => {
    render(<OnboardingScreen />);
    await screen.findByText(/Step 1 of 5/);
    fireEvent.change(screen.getByLabelText(/what should we call you/i), { target: { value: 'Sam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fox' }));
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'));
    const profile = await getProfile();
    expect(profile?.identity).toEqual({ displayName: 'Sam', avatarId: 'fox' });
    expect(profile?.accountEmail).toBe('me@example.com');
    expect(profile?.skipped).toBe(true);
    expect(profile?.onboardedAt).toBeGreaterThan(0);
  });

  it('creates the picked habits and offers the first win', async () => {
    render(<OnboardingScreen />);
    await screen.findByText(/Step 1 of 5/);
    await nextStep(2);
    await nextStep(3);
    // Goals step: pick a goal so the starter list is ranked for it.
    fireEvent.click(screen.getByRole('button', { name: 'Move more' }));
    await nextStep(4);
    await nextStep(5);
    fireEvent.click(await screen.findByRole('button', { name: /10-minute walk/i }));

    const create = screen.getByRole('button', { name: /create my habits/i });
    expect(create).toBeEnabled();
    fireEvent.click(create);

    expect(await screen.findByText(/You're set/)).toBeInTheDocument();
    const habits = await listHabits();
    expect(habits).toHaveLength(1);
    expect(habits[0].name).toBe('10-minute walk');
    expect(habits[0].difficulty).toBe('easy');
    // Profile is saved before the first-win screen, so a refresh keeps it.
    expect((await getProfile())?.goals.items).toEqual(['Move more']);
    expect(replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /i did it/i }));
    await waitFor(async () => {
      const entries = await loadDay(todayKey());
      expect(entries).toHaveLength(1);
      expect(entries[0].value).toBe(1);
    });
    expect(screen.getByRole('button', { name: /done for today/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /open my day/i }));
    expect(replace).toHaveBeenCalledWith('/home');
  });

  it('skips from any step and still records who set the device up', async () => {
    render(<OnboardingScreen />);
    await screen.findByText(/Step 1 of 5/);
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'));
    const profile = await getProfile();
    expect(profile?.skipped).toBe(true);
    expect(profile?.accountEmail).toBe('me@example.com');
  });

  it('prefills an existing profile and links back to settings', async () => {
    await saveProfile({
      identity: { displayName: 'Sam', avatarId: 'fox' },
      goals: { items: ['Sleep better'] },
      lifestyle: { sleepTime: '21:45' },
      accountEmail: 'first@example.com',
    }, 1_000);

    render(<OnboardingScreen />);
    expect(await screen.findByText('Edit profile')).toBeInTheDocument();
    expect(screen.getByLabelText(/what should we call you/i)).toHaveValue('Sam');
    expect(screen.getByRole('button', { name: 'Fox' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: /cancel/i })).toHaveAttribute('href', '/settings');

    await nextStep(2);
    expect(screen.getByLabelText(/sleep time/i)).toHaveValue('21:45');
    await nextStep(3);
    expect(screen.getByRole('button', { name: 'Sleep better' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not create duplicate habits when editing an existing profile', async () => {
    await saveProfile({ goals: { items: ['Move more'] }, accountEmail: 'first@example.com' }, 1_000);

    render(<OnboardingScreen />);
    await screen.findByText('Edit profile');
    await nextStep(2);
    await nextStep(3);
    await nextStep(4);
    await nextStep(5);
    expect(screen.getByText(/You already have habits on this device/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'));
    expect(await listHabits()).toHaveLength(0);
  });

  it('never rewrites the account that owns the device', async () => {
    await saveProfile({ goals: { items: ['Old goal'] }, accountEmail: 'first@example.com' }, 1_000);
    getSession.mockResolvedValue({ user: { email: 'second@example.com' } });

    render(<OnboardingScreen />);
    await screen.findByText('Edit profile');
    await nextStep(2);
    await nextStep(3);
    await nextStep(4);
    await nextStep(5);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'));
    expect((await getProfile())?.accountEmail).toBe('first@example.com');
  });

  it('offers quick picks on the obstacles step', async () => {
    render(<OnboardingScreen />);
    await screen.findByText(/Step 1 of 5/);
    await nextStep(2);
    await nextStep(3);
    await nextStep(4);
    fireEvent.click(await screen.findByRole('button', { name: 'No time' }));
    expect(screen.getByRole('button', { name: 'No time' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/hard to keep/i)).toHaveValue('No time');
  });
});
