import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll, listHabits } from '@/lib/repo';
import { AddHabitScreen } from './AddHabitScreen';
import { NavShell } from './NavShell';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/add-habit',
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-next-link="" {...rest}>{children}</a>
  ),
}));

beforeEach(async () => { await clearAll(); push.mockClear(); });

describe('AddHabitScreen (slice E R4)', () => {
  it('shows the four groups, Good active, with only its tiles', () => {
    render(<AddHabitScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Add habit' })).toBeInTheDocument();
    for (const label of ['Good', 'Health', 'Bad', 'To-do'])
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Good' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Meditate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Steps' })).not.toBeInTheDocument();
  });

  it('switches segments to show the other group’s tiles', () => {
    render(<AddHabitScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Health' }));
    expect(screen.getByRole('button', { name: 'Health' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Steps' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Meditate' })).not.toBeInTheDocument();
  });

  it('prefills the form from a template tile (Q3-A)', async () => {
    render(<AddHabitScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Health' }));
    fireEvent.click(screen.getByRole('button', { name: 'Steps' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Habit name')).toHaveValue('Steps');
    expect(screen.getByLabelText('Category')).toHaveValue('Health');
    expect(screen.getByLabelText('Intention')).toHaveValue('Health');
    expect(screen.getByLabelText('Unit')).toHaveValue('steps');
    expect(screen.getByLabelText(/^Target/)).toHaveValue(10000);
    expect(screen.getByRole('button', { name: 'Type quantity' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Every day' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('prefills timer templates with minutes in the target', async () => {
    render(<AddHabitScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Meditate' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Type timer' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/^Target/)).toHaveValue(10);   // 600 s shown as 10 min
  });

  it('saves a templated habit and routes to /habits', async () => {
    render(<AddHabitScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Health' }));
    fireEvent.click(screen.getByRole('button', { name: 'Steps' }));
    fireEvent.click(await screen.findByRole('button', { name: /save habit/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/habits'));
    const saved = (await listHabits())[0];
    expect(saved).toMatchObject({
      name: 'Steps', category: 'Health', intention: 'Health', type: 'quantity',
      target: 10000, unit: 'steps', frequency: [0, 1, 2, 3, 4, 5, 6],
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('creates a habit from the scratch form and routes to /habits', async () => {
    render(<AddHabitScreen />);
    fireEvent.click(screen.getByRole('button', { name: /start from scratch/i }));
    fireEvent.change(await screen.findByLabelText('Habit name'), { target: { value: 'Journal' } });
    fireEvent.change(screen.getByLabelText('Intention'), { target: { value: 'Do Hard Things' } });
    fireEvent.click(screen.getByRole('button', { name: /save habit/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/habits'));
    expect((await listHabits()).map((h) => h.name)).toContain('Journal');
  });

  it('leaves no habit behind when the form closes without saving', async () => {
    render(<AddHabitScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Health' }));
    fireEvent.click(screen.getByRole('button', { name: 'Steps' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await listHabits()).toHaveLength(0);
    expect(push).not.toHaveBeenCalled();
  });

  it('shows the banner and does not navigate when the write fails', async () => {
    const repo = await import('@/lib/repo');
    const spy = vi.spyOn(repo, 'putHabit').mockRejectedValue(new Error('disk full'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<NavShell><AddHabitScreen /></NavShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Health' }));
    fireEvent.click(screen.getByRole('button', { name: 'Steps' }));
    fireEvent.click(await screen.findByRole('button', { name: /save habit/i }));
    expect(await screen.findByTestId('write-error')).toHaveTextContent(/couldn't save that change/i);
    expect(push).not.toHaveBeenCalled();
    spy.mockRestore();
    vi.restoreAllMocks();
  });
});
