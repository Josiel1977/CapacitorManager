import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import AppShell from '@/components/AppShell';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0a2b3c',
};

export const metadata: Metadata = {
  title: {
    template: '%s | CapacitorManager',
    default: 'CapacitorManager - Gestão Inteligente de Capacitores',
  },
  description: 'Audite faturas, valide bancos de capacitores e transforme medições em decisões técnicas e relatórios profissionais.',
  keywords: 'capacitores, banco de capacitores, gestão de energia, manutenção preditiva, fator de potência',
  authors: [{ name: 'CapacitorManager' }],
  creator: 'CapacitorManager',
  publisher: 'CapacitorManager',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'CapacitorManager - Gestão Inteligente de Capacitores',
    description: 'Descubra se seus bancos de capacitores estão economizando ou gerando multas. Teste com uma fatura, sem cadastro.',
    url: 'https://www.capacitormanager.com.br',
    siteName: 'CapacitorManager',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CapacitorManager - Gestão Inteligente de Capacitores',
    description: 'Auditoria de faturas, validação de capacitores e gestão técnica em uma única plataforma.',
  },
  alternates: {
    canonical: 'https://www.capacitormanager.com.br',
  },
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning className="min-h-screen bg-slate-50 antialiased">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
