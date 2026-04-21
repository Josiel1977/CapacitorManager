'use client';

import { useAuth } from '@/lib/AuthContext';
import { Lock } from 'lucide-react';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

interface ProtectedActionProps {
  children: React.ReactNode;
  action: 'create' | 'edit' | 'delete' | 'export';
  className?: string;
}

export default function ProtectedAction({ children, action, className }: ProtectedActionProps) {
  const { mode } = useAuth();

  const handleClick = () => {
    if (mode === 'demo') {
      Swal.fire({
        title: '🔒 Acesso Restrito',
        html: `
          <p>Esta ação está disponível apenas na <strong>versão completa</strong>.</p>
          <div class="mt-4 p-3 bg-primary/10 rounded-lg">
            <p class="font-bold text-primary">🎯 Desbloqueie agora!</p>
            <p class="text-sm">Solicite sua demonstração e tenha acesso a:</p>
            <ul class="text-left text-xs mt-2">
              <li>✓ Criar/editar/excluir registros</li>
              <li>✓ Relatórios completos</li>
              <li>✓ Manutenção preditiva</li>
              <li>✓ Suporte prioritário</li>
            </ul>
          </div>
        `,
        icon: 'info',
        confirmButtonText: 'Solicitar Acesso',
        confirmButtonColor: '#0a2b3c',
        showCancelButton: true,
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href = '/contato';
        }
      });
    }
  };

  if (mode === 'demo') {
    return (
      <button
        onClick={handleClick}
        className={cn("flex items-center gap-2 rounded-lg px-4 py-2 bg-slate-100 text-slate-400 cursor-not-allowed", className)}
        title="Disponível na versão completa"
      >
        <Lock size={16} />
        {children}
      </button>
    );
  }

  return <>{children}</>;
}