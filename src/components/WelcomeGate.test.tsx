import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

import { clearAll, saveProfile } from '@/lib/repo';
import { WelcomeGate } from './WelcomeGate';

beforeEach(async () => {
  await clearAll();
  replace.mockClear();
});

describe('WelcomeGate (account spec D5)', () => {
  it('sends a device with no profile to onboarding', async () => {
    render(<WelcomeGate />);
    expect(screen.getByRole('status')).toHaveTextContent(/opening habibit/i);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/onboarding'));
  });

  it('sends a returning device straight home', async () => {
    await saveProfile({ goals: { items: ['Move daily'] } }, 1_000);
    render(<WelcomeGate />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'));
  });
});
