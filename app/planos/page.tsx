'use client';

import { useAuth } from '@/lib/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
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
  { id: 'essencial', nome: 'Essencial', preco: 297, descricao: '5 clientes · 10 bancos · 6 capacitores', checkoutUrl: CHECKOUT_URLS.essencial },
  { id: 'pro', nome: 'Pro', preco: 597, descricao: '20 clientes · 20 bancos · 200 capacitores', checkoutUrl: CHECKOUT_URLS.pro },
  { id: 'master', nome: 'Master', preco: 797, descricao: '50 clientes · 100 bancos · 600 capacitores', checkoutUrl: CHECKOUT_URLS.master },
];

function PlanosContent() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(true);

  useEffect(() => {
    const fetchOrCreateTenant = async () => {
      // 1. Prioriza parâmetro da URL (vem do cadastro)
      const tidParam = searchParams.get('tenant_id');
      if (tidParam) {
        setTenantId(tidParam);
        setLoadingTenant(false);
        return;
      }

      // 2. Se não está autenticado, não há o que fazer
      if (!isAuthenticated || !user) {
        setLoadingTenant(false);
        return;
      }

      // 3. Busca tenant_id em múltiplas fontes
      let tid = null;

      // 3a. Metadados do usuário
      tid = user.user_metadata?.tenant_id;

      // 3b. Tabela profiles
      if (!tid) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .single();
        if (!error && profile?.tenant_id) {
          tid = profile.tenant_id;
        }
      }

      // 3c. Se ainda não existe, criar um tenant para este usuário
      if (!tid) {
        const tenantName = user.user_metadata?.name || user.email?.split('@')[0] || 'Cliente';
        const subdomain = `${tenantName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
        
        const { data: newTenant, error: createError } = await supabase
          .from('tenants')
          .insert({
            name: tenantName,
            email: user.email,
            status: 'active',
            subdomain,
            termos_aceito: true,
            data_aceite_termos: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) {
          console.error('Erro ao criar tenant:', createError);
          Swal.fire('Erro', 'Não foi possível identificar sua conta. Contate o suporte.', 'error');
          setLoadingTenant(false);
          return;
        }

        tid = newTenant.id;

        // Atualiza o perfil do usuário com tenant_id
        await supabase
          .from('profiles')
          .update({ tenant_id: tid })
          .eq('id', user.id);

        // Atualiza os metadados do usuário
        await supabase.auth.updateUser({
          data: { tenant_id: tid }
        });
      }

      setTenantId(tid);
      setLoadingTenant(false);
    };

    fetchOrCreateTenant();
  }, [isAuthenticated, user, searchParams]);

  if (isLoading || loadingTenant) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const handleAssinar = (plano: typeof PLANOS[0]) => {
    if (!isAuthenticated && !tenantId) {
      Swal.fire('Acesso restrito', 'Faça login ou crie uma conta para assinar.', 'info');
      router.push('/signup');
      return;
    }
    if (!tenantId) {
      Swal.fire('Erro', 'Identificador não encontrado. Tente novamente ou contate o suporte.', 'error');
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
            <button onClick={() => handleAssinar(plano)} className="mt-6 w-full bg-primary text-white py-2 rounded-lg hover:bg-primary/90 transition-colors">
              Assinar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlanosPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>}>
      <PlanosContent />
    </Suspense>
  );
}
