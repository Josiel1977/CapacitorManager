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
  Calculator,
  Activity,
  Play,
  BookOpen,
  Settings,
  Wrench,
  Info,
  HelpCircle,
  Star
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, badge: null },
  { name: 'Demonstração', href: '/demo', icon: Play, badge: 'Novo' },
  { name: 'Como Usar', href: '/como-usar', icon: BookOpen, badge: 'Guia' },
  { name: 'Clientes', href: '/clientes', icon: Users, badge: null },
  { name: 'Bancos', href: '/bancos', icon: Database, badge: null },
  { name: 'Capacitores', href: '/capacitores', icon: Zap, badge: null },
  { name: 'Dimensionar', href: '/dimensionar', icon: Calculator, badge: null },
  { name: 'Realizar Teste', href: '/testes', icon: ClipboardCheck, badge: null },
  { name: 'Gráficos', href: '/graficos', icon: BarChart3, badge: null },
  { name: 'Histórico', href: '/historico', icon: History, badge: null },
  { name: 'Memória de Massa', href: '/analise-fatura', icon: Activity, badge: null },
  { name: 'Relatórios', href: '/relatorios', icon: FileText, badge: null },
  { name: 'Manutenção Preditiva', href: '/manutencao', icon: Wrench, badge: 'Premium' },
  { name: 'Configurações', href: '/configuracoes', icon: Settings, badge: null },
  { name: 'Documentação', href: '/documentacao', icon: BookOpen, badge: null },
];

// Seção de suporte/ajuda (separada visualmente)
const supportItems = [
  { name: 'Central de Ajuda', href: '/ajuda', icon: HelpCircle },
  { name: 'Solicitar Demo', href: '/contato', icon: Star },
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

          {/* Navigation - Menu Principal */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2.5 transition-all duration-200",
                    isActive 
                      ? "bg-secondary text-primary font-semibold shadow-md" 
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={18} />
                    <span className="text-sm">{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                      item.badge === 'Novo' && "bg-green-500 text-white",
                      item.badge === 'Guia' && "bg-blue-500 text-white",
                      item.badge === 'Premium' && "bg-amber-500 text-white",
                    )}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Seção de Suporte */}
          <div className="border-t border-white/10 px-3 py-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
              Suporte
            </p>
            {supportItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive 
                      ? "bg-secondary text-primary font-semibold" 
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <item.icon size={16} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Banner de Upgrade (se não for plano pago) */}
          <div className="mx-3 mb-3 rounded-lg bg-secondary/20 p-3 border border-secondary/30">
            <div className="flex items-start gap-2">
              <Star size={14} className="text-secondary mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-secondary">Versão Demo</p>
                <p className="text-[9px] text-white/60 mt-1">
                  Teste todas as funcionalidades por 30 dias grátis!
                </p>
                <button 
                  onClick={() => window.location.href = '/contato'}
                  className="mt-2 text-[9px] font-bold text-secondary hover:underline"
                >
                  Solicitar Acesso Completo →
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 p-3 text-center">
            <p className="text-[9px] font-medium text-secondary/70 mb-1 italic">
              &quot;Capacitores sob controle, resultados sob medida&quot;
            </p>
            <p className="text-[7px] text-white/20 uppercase tracking-widest">
              © 2026 CapacitorManager v2.0
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
