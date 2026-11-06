'use client';

import { AccountPanel } from './AccountPanel';
import { DataPanel } from './DataPanel';
import { ProfilePanel } from './ProfilePanel';
import { ThemePanel } from './ThemePanel';

export function SettingsScreen() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10">
      <h1 className="py-4 text-lg font-extrabold">Settings</h1>
      <AccountPanel />
      <ProfilePanel />
      <ThemePanel />
      <DataPanel />
    </div>
  );
}
