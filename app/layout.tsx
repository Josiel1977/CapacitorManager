import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';

const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-sans',
  display: 'swap', // ✅ Melhora a percepção de carregamento da fonte
});

// ✅ Metadados mais completos para SEO
export const metadata: Metadata = {
  title: {
    template: '%s | CapacitorManager', // ✅ Permite títulos dinâmicos por página
    default: 'CapacitorManager - Gestão Inteligente de Capacitores',
  },
  description: 'Sistema profissional para gestão, monitoramento e manutenção preditiva de bancos de capacitores. Validação automática, IA e relatórios técnicos.',
  keywords: 'capacitores, banco de capacitores, gestão de energia, manutenção preditiva, fator de potência, engenharia elétrica',
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
  // ✅ Open Graph para compartilhamento em redes sociais
  openGraph: {
    title: 'CapacitorManager - Gestão Inteligente de Capacitores',
    description: 'Monitore, valide e otimize seus bancos de capacitores com precisão técnica e inteligência artificial.',
    url: 'https://capacitor-manage.vercel.app',
    siteName: 'CapacitorManager',
    images: [
      {
        url: '/og-image.png', // ✅ Crie uma imagem para compartilhamento
        width: 1200,
        height: 630,
        alt: 'CapacitorManager Dashboard',
      },
    ],
    locale: 'pt_BR',
    type: 'website',
  },
  // ✅ Twitter Cards
  twitter: {
    card: 'summary_large_image',
    title: 'CapacitorManager - Gestão Inteligente de Capacitores',
    description: 'Sistema profissional para gestão de bancos de capacitores com IA.',
    images: ['/og-image.png'],
  },
  // ✅ Viewport (movido para configuração separada no Next.js 15)
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
  // ✅ Theme color para navegadores mobile
  themeColor: '#0a2b3c',
  // ✅ Alternar idiomas
  alternates: {
    canonical: 'https://capacitor-manage.vercel.app',
    languages: {
      'pt-BR': 'https://capacitor-manage.vercel.app',
      'en-US': 'https://capacitor-manage.vercel.app/en',
    },
  },
  // ✅ Verificação de propriedade (Google Search Console, etc.)
  verification: {
    google: 'seu-google-site-verification', // ✅ Adicione seu código
  },
  // ✅ Manifest para PWA
  manifest: '/manifest.json', // ✅ Crie um manifest para PWA
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable}`} suppressHydrationWarning>
      <body 
        suppressHydrationWarning 
        className="flex min-h-screen bg-slate-50 antialiased" // ✅ Adicionado antialiased
      >
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
        
        {/* ✅ Botão de "Voltar ao topo" para melhor UX em páginas longas */}
        <BackToTopButton />
      </body>
    </html>
  );
}

// ✅ Componente opcional para melhorar UX
function BackToTopButton() {
  'use client';
  
  const [show, setShow] = React.useState(false);
  
  React.useEffect(() => {
    const handleScroll = () => {
      setShow(window.scrollY > 300);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  if (!show) return null;
  
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-6 right-6 z-50 rounded-full bg-primary p-3 text-white shadow-lg transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      aria-label="Voltar ao topo"
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    </button>
  );
}
