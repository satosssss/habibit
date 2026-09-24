import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll, listHabits, loadDay, newId, putEntry, putHabit } from '@/lib/repo';
import type { Habit } from '@/lib/types';
import { DataPanel } from './DataPanel';

// jsdom (25) implements neither Blob.text() nor URL.createObjectURL; real
// browsers do, so the component uses the standard APIs and the test shims them.
if (typeof File.prototype.text !== 'function') {
  Object.defineProperty(File.prototype, 'text', {
    configurable: true,
    value(this: Blob): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(this);
      });
    },
  });
}
URL.createObjectURL ??= vi.fn(() => 'blob:habibit');
URL.revokeObjectURL ??= vi.fn();
// jsdom can't navigate to a blob: URL; the download click itself still runs.
beforeAll(() => {
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

const habit = (): Habit => ({
  id: newId(), name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Study', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0,
});

beforeEach(async () => { await clearAll(); });

describe('DataPanel', () => {
  it('round-trips an export through import', async () => {
    const h = habit();
    await putHabit(h);
    await putEntry(h.id, '2026-09-20', 1);
    render(<DataPanel />);
    const link = await screen.findByRole('button', { name: /export json/i });
    fireEvent.click(link);          // exercises the export path
    await waitFor(() => expect(screen.getByText(/exported/i)).toBeInTheDocument());
    // import the same payload back
    const file = new File(
      [JSON.stringify(await import('@/lib/repo').then((m) => m.exportState()))],
      'habibit.json', { type: 'application/json' }
    );
    const input = screen.getByLabelText(/import json/i);
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.queryByText(/imported/i)).toBeInTheDocument());
    expect(await listHabits()).toHaveLength(1);
  });

  it('rejects a malformed file with a readable message and keeps the data', async () => {
    await putHabit(habit());
    render(<DataPanel />);
    const file = new File(['{ not json'], 'bad.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText(/import json/i), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/not valid JSON|Habibit export/i));
    expect(await listHabits()).toHaveLength(1);
  });

  // Review Focus #7 / spec §12: valid JSON with a corrupt row *midway* through
  // the payload must be rejected before any write — never partially applied.
  it('rejects a valid-JSON payload with a bad row midway without touching stored data', async () => {
    const h = habit();
    await putHabit(h);
    await putEntry(h.id, '2026-09-20', 1);
    render(<DataPanel />);
    const payload = {
      habits: [h],
      entries: [
        { id: `${h.id}_2026-09-21`, habitId: h.id, date: '2026-09-21', value: 1, timestamp: 1 },
        { id: 'bad', habitId: 42, date: '2026-09-22', value: 1, timestamp: 1 }, // corrupt row
      ],
    };
    const file = new File([JSON.stringify(payload)], 'half-bad.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText(/import json/i), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Habibit export/i));
    expect(await listHabits()).toHaveLength(1);        // original habit still there
    expect(await loadDay('2026-09-20')).toHaveLength(1); // original entry still there
    expect(await loadDay('2026-09-21')).toHaveLength(0); // payload never applied
  });

  it('re-seeds after a reset', async () => {
    await putHabit(habit());
    render(<DataPanel />);
    fireEvent.click(screen.getByRole('button', { name: /reset data/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, reset/i }));
    await waitFor(async () => {
      const habits = await listHabits();
      expect(habits.length).toBe(8);   // seed restored
    });
  });
});
