'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, FileSearch, LogIn, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { href: '/demo', label: 'Analisar fatura' },
  { href: '/relatorio-exemplo', label: 'Relatório de exemplo' },
  { href: '/como-usar', label: 'Como funciona' },
  { href: '/contato', label: 'Falar com especialista' },
];

export default function PublicHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-primary" aria-label="CapacitorManager — página inicial">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-secondary shadow-sm">
            <Zap size={22} aria-hidden="true" />
          </span>
          <span className="text-lg font-black tracking-tight">
            Capacitor<span className="text-secondary">Manager</span>
          </span>
        </Link>

        <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto pb-1 md:order-2 md:w-auto md:pb-0" aria-label="Navegação pública">
          {links.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100 hover:text-primary',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="order-2 flex items-center gap-2 md:order-3">
          <Link href="/login" className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-slate-100 sm:flex">
            <LogIn size={16} aria-hidden="true" /> Entrar
          </Link>
          <Link href="/demo" className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-bold text-primary shadow-sm transition-transform hover:-translate-y-0.5">
            <FileSearch size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Diagnóstico grátis</span>
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}
