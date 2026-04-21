'use client';

import { useAuth } from '@/lib/AuthContext';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function DemoBanner() {
  const { mode } = useAuth();

  if (mode === 'authenticated') return null;

  return (
    <div className="bg-gradient-to-r from-amber-50 to-amber-100 border-l-4 border-amber-500 p-4 mb-6 rounded-lg shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500 rounded-lg text-white">
            <Sparkles size={20} />
          </div>
          <div>
            <p className="font-bold text-amber-800">🔍 Modo Demonstração</p>
            <p className="text-sm text-amber-700">
              Você está visualizando dados de exemplo. 
              <a href="/contato" className="underline font-medium ml-1 hover:text-amber-900">
                Solicite acesso completo →
              </a>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded-full">
            2 testes grátis disponíveis
          </span>
          <a 
            href="/login"
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 transition-colors flex items-center gap-1"
          >
            Fazer Login
            <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}