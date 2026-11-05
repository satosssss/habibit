import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateSuggestions } = vi.hoisted(() => ({ generateSuggestions: vi.fn() }));
vi.mock('@/lib/recommendClient', () => ({ generateSuggestions }));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { cacheSuggestions } from '@/lib/recommendations';
import { clearAll, getProfile, listHabits, putRecommendations, saveProfile } from '@/lib/repo';
import type { HabitSuggestion } from '@/lib/types';
import { RecommendationsSection } from './RecommendationsSection';

const walk: HabitSuggestion = {
  id: 'walk-0', name: 'Walk after lunch', reason: 'You sit all afternoon.',
  suggestedTime: '13:00', firstStep: 'Five minutes outside.',
};

const stretch: HabitSuggestion = {
  id: 'stretch-0', name: 'Stretch at your desk', reason: 'Tight shoulders.',
  suggestedTime: '10:00', firstStep: 'Thirty seconds.',
};

const seedCached = async (suggestions: HabitSuggestion[] = [walk]) => {
  await saveProfile({ goals: { items: ['Move daily'] } }, 1_000);
  await putRecommendations(cacheSuggestions(suggestions, 'server', '2026-01-01', 2_000));
};

beforeEach(async () => {
  await clearAll();
  generateSuggestions.mockReset();
});

describe('RecommendationsSection (account spec R4)', () => {
  it('explains the setup link when there is no profile', async () => {
    render(<RecommendationsSection />);
    expect(await screen.findByText(/answer four short questions/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /set up your profile/i })).toHaveAttribute('href', '/onboarding');
  });

  it('renders cached suggestions with reason, time, first step and a privacy note', async () => {
    await seedCached();
    render(<RecommendationsSection />);
    expect(await screen.findByText('Walk after lunch')).toBeInTheDocument();
    expect(screen.getByText('You sit all afternoon.')).toBeInTheDocument();
    expect(screen.getByText(/1:00pm/)).toBeInTheDocument();
    expect(screen.getByText(/Five minutes outside\./)).toBeInTheDocument();
    expect(screen.getByText(/stays on this device/i)).toBeInTheDocument();
    expect(screen.getByText(/Generated with Gemini/i)).toBeInTheDocument();
  });

  it('adds a suggestion through the normal habit form', async () => {
    await seedCached();
    render(<RecommendationsSection />);
    fireEvent.click(await screen.findByRole('button', { name: /add to my habits/i }));

    expect(await screen.findByDisplayValue('Walk after lunch')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));

    await waitFor(async () => {
      const names = (await listHabits()).map((habit) => habit.name);
      expect(names).toContain('Walk after lunch');
    });
    expect(await screen.findByRole('button', { name: /already added/i })).toBeDisabled();
  });

  it('regenerates on demand and stores the new cache', async () => {
    await seedCached();
    generateSuggestions.mockResolvedValue({
      suggestions: [stretch], source: 'on-device', deviceStatus: 'available',
    });

    render(<RecommendationsSection />);
    await screen.findByText('Walk after lunch');
    fireEvent.click(screen.getByRole('button', { name: /regenerate/i }));

    expect(await screen.findByText('Stretch at your desk')).toBeInTheDocument();
    expect(generateSuggestions).toHaveBeenCalledOnce();
    await waitFor(async () => {
      const cache = (await getProfile())?.recommendations;
      expect(cache?.source).toBe('on-device');
      expect(cache?.suggestions[0].name).toBe('Stretch at your desk');
    });
  });

  it('generates automatically when the cache is stale', async () => {
    await saveProfile({ goals: { items: ['Move daily'] } });
    generateSuggestions.mockResolvedValue({
      suggestions: [walk], source: 'server', deviceStatus: 'unavailable',
    });

    render(<RecommendationsSection />);
    await waitFor(() => expect(generateSuggestions).toHaveBeenCalledOnce());
    expect(await screen.findByText('Walk after lunch')).toBeInTheDocument();
  });

  it('surfaces a failure as an alert', async () => {
    await saveProfile({ goals: { items: ['Move daily'] } });
    generateSuggestions.mockRejectedValue(new Error('AI suggestions are not configured'));

    render(<RecommendationsSection />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/not configured/i);
  });
});
