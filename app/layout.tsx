import type { Metadata, Viewport } from 'next';
import {SITE_URL,SITE_TITLE,SITE_DESCRIPTION} from '@/lib/site-seo';
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
  metadataBase: new URL(SITE_URL),
  title: { template: '%s | CapacitorManager', default: SITE_TITLE },
  description: SITE_DESCRIPTION,
  keywords: ['banco de capacitores', 'energia reativa', 'auditoria energética', 'fator de potência', 'demanda contratada', 'gestão tarifária'],
  authors: [{ name: 'JM Eletro Service' }],
  creator: 'CapacitorManager',
  publisher: 'JM Eletro Service',
  // Public pages explicitly opt in. Login, reports and internal screens inherit noindex.
  // This does not replace the existing authentication and authorization checks.
  robots: { index: false, follow: true },
  openGraph: { type: 'website', locale: 'pt_BR', siteName: 'CapacitorManager', title: SITE_TITLE, description: SITE_DESCRIPTION },
  twitter: { card: 'summary_large_image', title: SITE_TITLE, description: SITE_DESCRIPTION },
  icons: { icon: '/icon.svg' },
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
