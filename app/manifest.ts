import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Gestor de Tours & Invoices',
    short_name: 'Gestor de Tours',
    description: 'Lançamentos diários de tours, comissões, humor do dia e geração de invoice.',
    start_url: '/',
    display: 'standalone',
    background_color: '#dbeafe',
    theme_color: '#0f172a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
