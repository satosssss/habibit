import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';

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

export const metadata: Metadata = {
  title: 'Habibit',
  description: 'Local-first habit tracker',
  applicationName: 'Habibit',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Habibit', statusBarStyle: 'default' },
  icons: { apple: '/icons/icon-192.png' },
};

// PWA spec R8: browser chrome follows the app tokens in each theme.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f0ebe3' },
    { media: '(prefers-color-scheme: dark)', color: '#100d0a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBoot }} /></head>
      <body className={`${display.variable} ${body.variable} antialiased`}>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
