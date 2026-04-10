'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Database, 
  Zap, 
  ClipboardCheck, 
  BarChart3, 
  History, 
  FileText,
  Menu,
  X,
  Calculator
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Bancos', href: '/bancos', icon: Database },
  { name: 'Capacitores', href: '/capacitores', icon: Zap },
  { name: 'Dimensionar', href: '/dimensionar', icon: Calculator },
  { name: 'Realizar Teste', href: '/testes', icon: ClipboardCheck },
  { name: 'Gráficos', href: '/graficos', icon: BarChart3 },
  { name: 'Histórico', href: '/historico', icon: History },
  { name: 'Relatórios', href: '/relatorios', icon: FileText },
  { name: 'Configurações', href: '/configuracoes', icon: Database },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        className="fixed top-4 left-4 z-50 rounded-md bg-primary p-2 text-white md:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar Container */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 transform bg-primary text-white transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center justify-center border-b border-white/10 py-8">
            <div className="flex items-center gap-2">
              <Zap className="text-secondary" size={32} />
              <h1 className="text-xl font-bold tracking-tight">Capacitor<span className="text-secondary">Manager</span></h1>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-4 py-6">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 transition-colors",
                    isActive 
                      ? "bg-secondary text-primary font-semibold" 
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <item.icon size={20} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-white/10 p-4 text-center">
            <p className="text-[10px] font-medium text-secondary/80 mb-1 italic">
              &quot;Capacitores sob controle, resultados sob medida&quot;
            </p>
            <p className="text-[8px] text-white/20 uppercase tracking-widest">
              &copy; 2026 CapacitorManager v1.1
            </p>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
