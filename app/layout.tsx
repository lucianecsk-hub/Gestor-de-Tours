import './globals.css';
import type { Metadata, Viewport } from 'next';
import SwRegister from '@/components/SwRegister';

export const metadata: Metadata = {
  title: 'Gestor de Tours & Invoices',
  description: 'Lançamentos diários, comissão de city tour, humor do dia e geração de invoice.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Gestor de Tours',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-blue-50 text-slate-800 font-sans min-h-screen">
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
