import type { Metadata } from 'next';
import './globals.css';

const themeBoot = `try {
  var pref = localStorage.getItem('habibit:theme') || 'system';
  var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.themePref = pref;
} catch (e) {}`;

export const metadata: Metadata = { title: 'Habibit', description: 'Local-first habit tracker' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBoot }} /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
