'use client';

import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { supabase } from '@/lib/supabaseClient';

const CHECKOUT_URLS = {
  basico: process.env.NEXT_PUBLIC_MP_CHECKOUT_BASICO,
  essencial: process.env.NEXT_PUBLIC_MP_CHECKOUT_ESSENCIAL,
  pro: process.env.NEXT_PUBLIC_MP_CHECKOUT_PRO,
  master: process.env.NEXT_PUBLIC_MP_CHECKOUT_MASTER,
};

const PLANOS = [
  { id: 'basico', nome: 'Básico', preco: 149, descricao: '1 cliente · 1 banco · 50 capacitores', checkoutUrl: CHECKOUT_URLS.basico },
  { id: 'essencial', nome: 'Essencial', preco: 297, descricao: '5 clientes · 10 bancos · 50 capacitores', checkoutUrl: CHECKOUT_URLS.essencial },
  { id: 'pro', nome: 'Pro', preco: 597, descricao: '20 clientes · 20 bancos · 200 capacitores', checkoutUrl: CHECKOUT_URLS.pro },
  { id: 'master', nome: 'Master', preco: 797, descricao: '50 clientes · 100 bancos · 600 capacitores', checkoutUrl: CHECKOUT_URLS.master },
];

export default function PlanosPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTenant = async () => {
      if (!isAuthenticated || !user) {
        // Se não estiver logado, tenta pegar da URL (caso venha do cadastro)
        const params = new URLSearchParams(window.location.search);
        const tid = params.get('tenant_id');
        if (tid) setTenantId(tid);
        return;
      }
      // Se logado, busca do perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      setTenantId(profile?.tenant_id || null);
    };
    fetchTenant();
  }, [isAuthenticated, user]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  }

  const handleAssinar = (plano: typeof PLANOS[0]) => {
    if (!isAuthenticated && !tenantId) {
      Swal.fire('Acesso restrito', 'Faça login ou crie uma conta para assinar.', 'info');
      router.push('/signup');
      return;
    }
    if (!tenantId) {
      Swal.fire('Erro', 'Identificador não encontrado. Faça login novamente.', 'error');
      return;
    }
    if (!plano.checkoutUrl) {
      Swal.fire('Erro', 'URL de checkout não configurada. Contate o suporte.', 'error');
      console.error('Checkout URL missing for plan', plano.id);
      return;
    }
    const url = `${plano.checkoutUrl}&external_reference=${tenantId}`;
    window.location.href = url;
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold text-primary text-center">Escolha seu plano</h1>
      <p className="text-center text-slate-500 mt-2">Acesse todas as funcionalidades do CapacitorManager</p>
      <div className="grid md:grid-cols-4 gap-6 mt-8">
        {PLANOS.map(plano => (
          <div key={plano.id} className="bg-white rounded-2xl shadow-md border p-6">
            <h2 className="text-xl font-bold text-primary">{plano.nome}</h2>
            <p className="text-3xl font-bold mt-2">R$ {plano.preco}<span className="text-base">/mês</span></p>
            <p className="text-sm text-slate-500 mt-2">{plano.descricao}</p>
            <button onClick={() => handleAssinar(plano)} className="mt-6 w-full bg-primary text-white py-2 rounded-lg">
              Assinar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}