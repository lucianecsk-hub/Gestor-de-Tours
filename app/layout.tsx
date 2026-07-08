import './globals.css';

export const metadata = {
  title: 'Gestor de Tours & Invoices',
  description: 'Lançamentos diários, comissão de city tour, humor do dia e geração de invoice.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-blue-50 text-slate-800 font-sans min-h-screen">{children}</body>
    </html>
  );
}
