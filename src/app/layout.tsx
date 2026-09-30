import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Slice D R2: self-hosted variable fonts — vendored files, zero runtime fetch,
// no CDN. next/font/local rewrites these at build time into local @font-face.
const display = localFont({
  src: './fonts/outfit-variable.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-display',
});
const body = localFont({
  src: './fonts/dm-sans-variable.woff2',
  weight: '100 1000',
  display: 'swap',
  variable: '--font-body',
});

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
      <body className={`${display.variable} ${body.variable} antialiased`}>{children}</body>
    </html>
  );
}
