import type { MetadataRoute } from 'next';

/** PWA spec R8: installable shell; colours come from the existing tokens. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Habibit',
    short_name: 'Habibit',
    description: 'Local-first habit tracker',
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f0ebe3',
    theme_color: '#f59e0b',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
