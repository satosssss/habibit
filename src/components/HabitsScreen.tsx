'use client';

import { HabitsPanel } from './HabitsPanel';

export function HabitsScreen() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10">
      <h1 className="py-4 text-lg font-extrabold">Habits</h1>
      <HabitsPanel />
    </div>
  );
}
