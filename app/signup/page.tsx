'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { supabase } from '@/lib/supabaseClient';
import { PLAN_LIST, formatPlanLimits, type PlanId } from '@/lib/plans';

export default function SignupPage() {
  const router = useRouter();
  const [empresa, setEmpresa] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [plano, setPlano] = useState<PlanId>('basico');
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa, email, senha, plano, aceiteTermos }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível criar a conta.');
      if (result.requiresEmailConfirmation) {
        await Swal.fire('Confirme seu e-mail', 'Enviamos um link de confirmação. Depois, faça login para escolher o plano.', 'success');
        router.replace('/login');
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
      if (error) throw new Error('Conta criada. Faça login para continuar.');
      router.replace('/planos');
    } catch (error) {
      Swal.fire('Cadastro não concluído', error instanceof Error ? error.message : 'Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 p-4">
      <form onSubmit={submit} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-7 shadow-lg">
        <div><h1 className="text-2xl font-bold text-primary">Criar conta</h1><p className="text-sm text-slate-600">Cadastre sua empresa para contratar o CapacitorManager.</p></div>
        <input required minLength={2} maxLength={160} value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="w-full rounded-lg border p-3" placeholder="Nome da empresa" />
        <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border p-3" placeholder="voce@empresa.com" />
        <input required type="password" minLength={12} autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="w-full rounded-lg border p-3" placeholder="Senha com 12 ou mais caracteres" />
        <fieldset className="space-y-2"><legend className="mb-2 font-medium">Plano desejado</legend>{PLAN_LIST.map((plan) => (
          <label key={plan.id} className={`block cursor-pointer rounded-lg border p-3 ${plano === plan.id ? 'border-primary bg-primary/5' : ''}`}>
            <input type="radio" name="plano" className="mr-2" checked={plano === plan.id} onChange={() => setPlano(plan.id)} />
            <strong>{plan.name}</strong> — R$ {plan.priceMonthly}/mês
            <span className="block pl-6 text-xs text-slate-500">{formatPlanLimits(plan)}</span>
          </label>
        ))}</fieldset>
        <label className="flex items-start gap-2 text-xs text-slate-600"><input required type="checkbox" className="mt-1" checked={aceiteTermos} onChange={(e) => setAceiteTermos(e.target.checked)} /><span>Li e aceito os <Link className="text-primary underline" href="/termos" target="_blank">Termos de Uso</Link> e a <Link className="text-primary underline" href="/privacidade" target="_blank">Política de Privacidade</Link>.</span></label>
        <button disabled={loading || !aceiteTermos} className="w-full rounded-lg bg-primary p-3 font-semibold text-white disabled:opacity-50">{loading ? 'Criando conta…' : 'Criar conta'}</button>
        <p className="text-center text-sm">Já tem uma conta? <Link className="text-primary underline" href="/login">Entrar</Link></p>
      </form>
    </main>
  );
}
