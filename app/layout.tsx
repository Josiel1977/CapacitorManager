import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import BackToTopButton from '@/components/BackToTopButton';
import { AuthProvider } from '@/lib/AuthContext';

const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s | CapacitorManager',
    default: 'CapacitorManager - Gestão Inteligente de Capacitores',
  },
  description: 'Sistema profissional para gestão, monitoramento e manutenção preditiva de bancos de capacitores.',
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
    description: 'Monitore, valide e otimize seus bancos de capacitores.',
    url: 'https://capacitor-manage.vercel.app',
    siteName: 'CapacitorManager',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'CapacitorManager Dashboard' }],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CapacitorManager - Gestão Inteligente de Capacitores',
    description: 'Sistema profissional para gestão de bancos de capacitores.',
    images: ['/og-image.png'],
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
  themeColor: '#0a2b3c',
  alternates: {
    canonical: 'https://capacitor-manage.vercel.app',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning className="flex min-h-screen bg-slate-50 antialiased">
        <AuthProvider>
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            {children}
          </main>
          <BackToTopButton />
        </AuthProvider>
      </body>
    </html>
  );
}

