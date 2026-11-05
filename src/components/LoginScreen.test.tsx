import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signIn, getSession } = vi.hoisted(() => ({
  signIn: vi.fn(async () => undefined),
  getSession: vi.fn(),
}));
vi.mock('next-auth/react', () => ({ signIn, getSession }));

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

import { LoginScreen } from './LoginScreen';

beforeEach(() => {
  signIn.mockClear();
  replace.mockClear();
  getSession.mockResolvedValue(null);
  window.history.replaceState({}, '', '/login');
});

describe('LoginScreen (account spec R1)', () => {
  it('offers exactly one action: Continue with Google', async () => {
    render(<LoginScreen />);
    const button = await screen.findByRole('button', { name: /continue with google/i });
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('starts the Google flow and returns to /welcome', async () => {
    render(<LoginScreen />);
    const button = await screen.findByRole('button', { name: /continue with google/i });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('google', { callbackUrl: '/welcome' }));
  });

  it('sends an already signed-in visitor to /welcome', async () => {
    getSession.mockResolvedValue({ user: { email: 'a@example.com' } });
    render(<LoginScreen />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/welcome'));
  });

  it('explains the data that is stored', async () => {
    render(<LoginScreen />);
    expect(await screen.findByText(/only your name, email and photo/i)).toBeInTheDocument();
    expect(screen.getByText(/never reach our servers/i)).toBeInTheDocument();
  });

  it('shows the Auth.js error return in plain words', async () => {
    window.history.replaceState({}, '', '/login?error=AccessDenied');
    render(<LoginScreen />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/did not complete/i);
  });
});
