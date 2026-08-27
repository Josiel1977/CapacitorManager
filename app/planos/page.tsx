'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { useAuth } from '@/lib/AuthContext';
import { PLAN_LIST, formatPlanLimits, type PlanId } from '@/lib/plans';

export default function PlanosPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [submitting, setSubmitting] = useState<PlanId | null>(null);

  async function subscribe(plan: PlanId) {
    if (!isAuthenticated) {
      router.push('/login?redirectTo=/planos');
      return;
    }
    setSubmitting(plan);
    try {
      const response = await fetch('/api/mp/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano: plan }),
      });
      const result = await response.json();
      if (!response.ok || !result.init_point) throw new Error(result.error || 'Não foi possível iniciar o pagamento.');
      window.location.assign(result.init_point);
    } catch (error) {
      Swal.fire('Assinatura não iniciada', error instanceof Error ? error.message : 'Tente novamente.', 'error');
      setSubmitting(null);
    }
  }

  if (isLoading) return <main className="grid min-h-[60vh] place-items-center">Carregando…</main>;

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-center text-3xl font-bold text-primary">Escolha seu plano</h1>
      <p className="mt-2 text-center text-slate-500">Cobrança mensal recorrente processada pelo Mercado Pago.</p>
      <div className="mt-8 grid gap-6 md:grid-cols-4">
        {PLAN_LIST.map((plan) => (
          <section key={plan.id} className="rounded-2xl border bg-white p-6 shadow-md">
            <h2 className="text-xl font-bold text-primary">{plan.name}</h2>
            <p className="mt-2 text-3xl font-bold">R$ {plan.priceMonthly}<span className="text-base">/mês</span></p>
            <p className="mt-2 text-sm text-slate-500">{formatPlanLimits(plan)}</p>
            <button disabled={submitting !== null} onClick={() => subscribe(plan.id)} className="mt-6 w-full rounded-lg bg-primary py-2 text-white disabled:opacity-50">
              {submitting === plan.id ? 'Abrindo checkout…' : 'Assinar'}
            </button>
            <a href={`/termos/${plan.id}`} target="_blank" className="mt-3 block text-center text-xs text-primary underline">Condições do plano</a>
          </section>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-slate-500">A ativação ocorre somente após confirmação do pagamento pelo webhook assinado.</p>
    </main>
  );
}
