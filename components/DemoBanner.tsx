'use client';

import { useAuth } from '@/lib/AuthContext';

export default function DemoBanner() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) return null;

  return (
    <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl p-4 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-secondary/20 rounded-lg">
          <span className="text-2xl">🚀</span>
        </div>
        <div>
          <p className="text-sm font-medium text-primary">Versão Demo</p>
          <p className="text-xs text-slate-500">Teste todas as funcionalidades gratuitamente.</p>
        </div>
      </div>
      <a
        href="/signup"
        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Solicitar Acesso Completo
      </a>
    </div>
  );
}