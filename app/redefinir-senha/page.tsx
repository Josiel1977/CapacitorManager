'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (password.length < 12) return setError('Use pelo menos 12 caracteres.');
    if (password !== confirmation) return setError('As senhas não coincidem.');
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) return setError('O link expirou ou não é válido. Solicite outro link.');
    router.replace('/login');
  }

  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl bg-white p-7 shadow-lg">
        <h1 className="text-2xl font-bold text-primary">Definir nova senha</h1>
        <input type="password" required minLength={12} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border p-3" placeholder="Nova senha (12+ caracteres)" />
        <input type="password" required minLength={12} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-lg border p-3" placeholder="Confirmar nova senha" />
        <button disabled={loading} className="w-full rounded-lg bg-primary p-3 font-semibold text-white disabled:opacity-50">{loading ? 'Salvando…' : 'Salvar nova senha'}</button>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </form>
    </main>
  );
}
