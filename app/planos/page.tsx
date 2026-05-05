'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { supabase } from '@/lib/supabaseClient'; // ajuste o caminho se necessário

const PLANOS = [
  {
    id: 'basico',
    nome: 'Básico',
    preco: 149,
    descricao: '1 cliente, 1 banco, 6 capacitores',
    checkoutUrl: process.env.NEXT_PUBLIC_MP_CHECKOUT_BASICO!,
  },
  {
    id: 'essencial',
    nome: 'Essencial',
    preco: 297,
    descricao: '5 clientes, 10 bancos, 50 capacitores',
    checkoutUrl: process.env.NEXT_PUBLIC_MP_CHECKOUT_ESSENCIAL!,
  },
  {
    id: 'pro',
    nome: 'Pro',
    preco: 597,
    descricao: '20 clientes, 50 bancos, 200 capacitores',
    checkoutUrl: process.env.NEXT_PUBLIC_MP_CHECKOUT_PRO!,
  },
  {
    id: 'master',
    nome: 'Master',
    preco: 797,
    descricao: '50+ clientes, bancos ilimitados',
    checkoutUrl: process.env.NEXT_PUBLIC_MP_CHECKOUT_MASTER!,
  },
];

export default function PlanosPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [termosAceitos, setTermosAceitos] = useState<Record<string, boolean>>({});

  // Buscar tenant_id do usuário logado e quais planos ele já aceitou
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const fetchTenant = async () => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      if (!error && profile?.tenant_id) {
        setTenantId(profile.tenant_id);
        // Buscar plano já aceito
        const { data: tenant } = await supabase
          .from('tenants')
          .select('plano_aceito')
          .eq('id', profile.tenant_id)
          .single();
        if (tenant?.plano_aceito) {
          setTermosAceitos({ [tenant.plano_aceito]: true });
        }
      }
    };
    fetchTenant();
  }, [isAuthenticated, user]);

  if (isLoading) return <div className="p-8 text-center">Carregando...</div>;

  const handleAssinar = async (plano: typeof PLANOS[0]) => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // Se já aceitou os termos deste plano, vai direto para o checkout
    if (termosAceitos[plano.id]) {
      window.location.href = plano.checkoutUrl;
      return;
    }

    // Exibir modal com os termos do plano
    const result = await Swal.fire({
      title: `Termos do Plano ${plano.nome}`,
      html: `
        <div class="text-left max-h-96 overflow-y-auto">
          <p><strong>Limites:</strong> ${plano.descricao}</p>
          <p><strong>Valor:</strong> R$ ${plano.preco}/mês</p>
          <p><strong>Cobrança:</strong> Automática via Mercado Pago.</p>
          <p><strong>Rescisão:</strong> O plano pode ser cancelado a qualquer momento, sem multa.</p>
          <hr class="my-3" />
          <p>Leia os <a href="/termos/${plano.id}" target="_blank" class="text-primary hover:underline">termos completos do plano</a>.</p>
          <label class="flex items-center gap-2 mt-3">
            <input type="checkbox" id="aceite-modal" /> 
            <span>Declaro que li e aceito os termos do plano ${plano.nome}.</span>
          </label>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Aceitar e continuar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const aceite = (document.getElementById('aceite-modal') as HTMLInputElement)?.checked;
        if (!aceite) {
          Swal.showValidationMessage('Você precisa aceitar os termos para continuar.');
          return false;
        }
        return true;
      },
    });

    if (!result.isConfirmed) return;

    // Registrar aceite no banco
    if (tenantId) {
      await supabase
        .from('tenants')
        .update({
          plano_aceito: plano.id,
          data_aceite_plano: new Date().toISOString(),
        })
        .eq('id', tenantId);
    }

    // Atualizar estado local
    setTermosAceitos((prev) => ({ ...prev, [plano.id]: true }));

    // Redirecionar para o checkout do Mercado Pago
    window.location.href = plano.checkoutUrl;
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold text-primary text-center">Escolha seu plano</h1>
      <p className="text-center text-slate-500 mt-2">Acesse todas as funcionalidades do CapacitorManager</p>
      <div className="grid md:grid-cols-4 gap-6 mt-8">
        {PLANOS.map((plano) => (
          <div
            key={plano.id}
            className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 hover:shadow-lg transition-shadow"
          >
            <h2 className="text-xl font-bold text-primary">{plano.nome}</h2>
            <p className="text-3xl font-bold mt-2">
              R$ {plano.preco}
              <span className="text-base font-normal text-slate-500">/mês</span>
            </p>
            <p className="text-sm text-slate-500 mt-2">{plano.descricao}</p>
            <button
              onClick={() => handleAssinar(plano)}
              className="mt-6 w-full bg-primary text-white py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Assinar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}