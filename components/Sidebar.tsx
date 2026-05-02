'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, Users, Database, Zap, ClipboardCheck, BarChart3, 
  History, FileText, Menu, X, Calculator, Activity, Play, BookOpen, 
  Settings, Wrench, LogOut, HelpCircle, Star, LogIn
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';

// Itens públicos (sempre visíveis) – agora todos juntos
const publicMenuItems = [
  { name: 'Demonstração', href: '/demo', icon: Play },
  { name: 'Como Usar', href: '/como-usar', icon: BookOpen },
  { name: 'Central de Ajuda', href: '/ajuda', icon: HelpCircle },
  { name: 'Solicitar Demo', href: '/signup', icon: Star },
];

// Itens privados (só aparecem quando logado)
const privateMenuItems = [
  { name: 'Dashboard', href: '/dimensionar', icon: LayoutDashboard },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Bancos', href: '/bancos', icon: Database },
  { name: 'Capacitores', href: '/capacitores', icon: Zap },
  { name: 'Dimensionar', href: '/dimensionar', icon: Calculator },
  { name: 'Realizar Teste', href: '/testes', icon: ClipboardCheck },
  { name: 'Gráficos', href: '/graficos', icon: BarChart3 },
  { name: 'Histórico', href: '/historico', icon: History },
  { name: 'Relatórios', href: '/relatorios', icon: FileText },
  { name: 'Manutenção Preditiva', href: '/manutencao', icon: Wrench },
  { name: 'Configurações', href: '/configuracoes', icon: Settings },
  { name: 'Documentação', href: '/documentacao', icon: BookOpen },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, logout } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);

  if (isLoading) {
    return <div className="fixed inset-y-0 left-0 z-40 w-64 bg-primary text-white p-4">Carregando...</div>;
  }

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleLogin = () => router.push('/login');

  return (
    <>
      {/* Mobile toggle */}
      <button 
        className="fixed top-4 left-4 z-50 rounded-md bg-primary p-2 text-white md:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 transform bg-primary text-white transition-transform duration-300 ease-in-out md:relative md:translate-x-0 overflow-y-auto",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center justify-center border-b border-white/10 py-6">
            <div className="flex items-center gap-2">
              <Zap className="text-secondary" size={28} />
              <h1 className="text-lg font-bold tracking-tight">
                Capacitor<span className="text-secondary">Manager</span>
              </h1>
            </div>
          </div>

          {/* Menu Público (sempre visível) */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {publicMenuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200",
                    isActive 
                      ? "bg-secondary text-primary font-semibold shadow-md" 
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <item.icon size={18} />
                  <span className="text-sm">{item.name}</span>
                </Link>
              );
            })}

            {/* Menu Privado (somente se autenticado) */}
            {isAuthenticated && (
              <div className="mt-4 space-y-1">
                <div className="my-2 h-px bg-white/10" />
                {privateMenuItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200",
                        isActive 
                          ? "bg-secondary text-primary font-semibold shadow-md" 
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <item.icon size={18} />
                      <span className="text-sm">{item.name}</span>
                    </Link>
                  );
                })}
                {/* Botão Sair */}
                <button
                  onClick={handleLogout}
                  className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <LogOut size={16} />
                  Sair
                </button>
              </div>
            )}
          </nav>

          {/* Botão Login (aparece apenas se NÃO estiver logado) */}
          {!isAuthenticated && (
            <div className="border-t border-white/10 p-4">
              <button
                onClick={handleLogin}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-secondary text-primary font-semibold py-2 hover:bg-secondary/90 transition-colors"
              >
                <LogIn size={16} />
                Login
              </button>
            </div>
          )}

          {/* Footer (opcional) */}
          <div className="border-t border-white/10 p-4 text-center text-[9px] text-white/20">
            © 2026 CapacitorManager v2.0
          </div>
        </div>
      </aside>

      {/* Overlay mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}