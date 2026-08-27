'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('sent') === '1') {
      setMessage('Se existir uma conta para esse e-mail, enviaremos as instruções de recuperação.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    const redirectTo = `${window.location.origin}/redefinir-senha`;
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
    // Resposta genérica evita revelar se o endereço está cadastrado.
    setMessage('Se existir uma conta para esse e-mail, enviaremos as instruções de recuperação.');
    setLoading(false);
  }

  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 p-4">
      <form method="post" action="/api/auth/recover" onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl bg-white p-7 shadow-lg">
        <div>
          <h1 className="text-2xl font-bold text-primary">Recuperar senha</h1>
          <p className="mt-1 text-sm text-slate-600">Informe seu e-mail para receber um link seguro.</p>
        </div>
        <input name="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border p-3" placeholder="voce@empresa.com" />
        <button disabled={loading} className="w-full rounded-lg bg-primary p-3 font-semibold text-white disabled:opacity-50">{loading ? 'Enviando…' : 'Enviar instruções'}</button>
        {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
        <Link href="/login" className="block text-center text-sm text-primary hover:underline">Voltar ao login</Link>
      </form>
    </main>
  );
}
