'use client';

import { DataPanel } from './DataPanel';
import { ThemePanel } from './ThemePanel';

export function SettingsScreen() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10">
      <h1 className="py-4 text-lg font-extrabold">Settings</h1>
      <ThemePanel />
      <DataPanel />
    </div>
  );
}
