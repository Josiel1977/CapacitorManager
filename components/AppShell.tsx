'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import PublicHeader from '@/components/PublicHeader';
import BackToTopButton from '@/components/BackToTopButton';
import ChatAssistant from '@/components/ChatAssistant';

const publicPrefixes = [
  '/',
  '/demo',
  '/como-usar',
  '/ajuda',
  '/contato',
  '/relatorio-exemplo',
  '/signup',
  '/login',
  '/recuperar-senha',
  '/redefinir-senha',
  '/privacidade',
  '/termos',
] as const;

const isPublicExperience = (pathname: string) => publicPrefixes.some(
  (route) => route === '/' ? pathname === '/' : pathname === route || pathname.startsWith(`${route}/`),
);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const publicExperience = !isAuthenticated && isPublicExperience(pathname);

  if (publicExperience) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PublicHeader />
        <main>{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>© 2026 CapacitorManager · Tecnologia da JM Eletro Service</p>
            <div className="flex gap-4">
              <a href="/termos" className="hover:text-primary">Termos</a>
              <a href="/privacidade" className="hover:text-primary">Privacidade</a>
              <a href="/contato" className="hover:text-primary">Contato</a>
            </div>
          </div>
        </footer>
        <BackToTopButton />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      <BackToTopButton />
      <ChatAssistant />
    </div>
  );
}
