'use client';

import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';

const PLANOS = [
  { id: 'basico', nome: 'Básico', preco: 149, descricao: '1 cliente · 1 banco · 50 capacitores', checkoutUrl: process.env.NEXT_PUBLIC_MP_CHECKOUT_BASICO! },
  { id: 'essencial', nome: 'Essencial', preco: 297, descricao: '5 clientes · 10 bancos · 50 capacitores', checkoutUrl: process.env.NEXT_PUBLIC_MP_CHECKOUT_ESSENCIAL! },
  { id: 'pro', nome: 'Pro', preco: 597, descricao: '20 clientes · 20 bancos · 200 capacitores', checkoutUrl: process.env.NEXT_PUBLIC_MP_CHECKOUT_PRO! },
  { id: 'master', nome: 'Master', preco: 797, descricao: '50 clientes · 100 bancos · 600 capacitores', checkoutUrl: process.env.NEXT_PUBLIC_MP_CHECKOUT_MASTER! },
];

export default function PlanosPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTenant = async () => {
      if (!isAuthenticated || !user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      setTenantId(profile?.tenant_id || null);
    };
    fetchTenant();
  }, [isAuthenticated, user]);

  if (isLoading) return <div className="p-8 text-center">Carregando...</div>;

  const handleAssinar = (plano: typeof PLANOS[0]) => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!tenantId) {
      Swal.fire('Erro', 'Identificador não encontrado. Faça login novamente.', 'error');
      return;
    }
    // Adiciona o external_reference como parâmetro extra (ignorado no checkout mas útil para webhook)
    const url = `${plano.checkoutUrl}&external_reference=${tenantId}`;
    window.location.href = url;
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold text-primary text-center">Escolha seu plano</h1>
      <div className="grid md:grid-cols-4 gap-6 mt-8">
        {PLANOS.map((plano) => (
          <div key={plano.id} className="bg-white rounded-2xl shadow-md border p-6">
            <h2 className="text-xl font-bold text-primary">{plano.nome}</h2>
            <p className="text-3xl font-bold mt-2">R$ {plano.preco}<span className="text-base">/mês</span></p>
            <p className="text-sm text-slate-500 mt-2">{plano.descricao}</p>
            <button onClick={() => handleAssinar(plano)} className="mt-6 w-full bg-primary text-white py-2 rounded-lg">Assinar</button>
          </div>
        ))}
      </div>
    </div>
  );
}