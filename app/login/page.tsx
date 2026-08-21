'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff, Lock, Mail, Zap } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

function getSafeRedirect(): string {
  if (typeof window === 'undefined') return '/dashboard-real';
  const requestedRedirect = new URLSearchParams(window.location.search).get('redirectTo');
  return requestedRedirect?.startsWith('/') && !requestedRedirect.startsWith('//')
    ? requestedRedirect
    : '/dashboard-real';
}

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get('error');

    if (errorCode) {
      setMessage({
        type: 'error',
        text: errorCode === 'unavailable'
          ? 'O serviço de autenticação não respondeu. Tente novamente.'
          : errorCode === 'configuration'
            ? 'A autenticação local não está configurada corretamente.'
            : 'E-mail ou senha inválidos.',
      });
    }

    // Remove parâmetros sensíveis de URLs antigas geradas antes da RC6.
    if (params.has('email') || params.has('password') || errorCode) {
      params.delete('email');
      params.delete('password');
      params.delete('error');
      const query = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await login(email, senha);
      setMessage({ type: 'success', text: 'Login realizado. Abrindo o sistema…' });
      window.location.assign(getSafeRedirect());
    } catch (error) {
      const authenticationUnavailable = error instanceof Error
        && /tempo limite|fetch|network|conex/i.test(error.message);
      setMessage({
        type: 'error',
        text: authenticationUnavailable
          ? 'O serviço de autenticação não respondeu. Verifique sua internet e tente novamente.'
          : 'E-mail ou senha inválidos.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-gradient-to-br from-primary/10 to-secondary/10">
      <div className="flex min-h-dvh items-center justify-center p-4">
        <section className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl" aria-labelledby="login-title">
          <header className="bg-primary p-6 text-center">
            <div className="mb-4 inline-flex rounded-xl bg-white/10 p-3">
              <Zap size={32} className="text-secondary" aria-hidden="true" />
            </div>
            <h1 id="login-title" className="text-2xl font-bold text-white">CapacitorManager</h1>
            <p className="text-sm text-white/70">Acesso ao Sistema</p>
          </header>

          <form
            method="post"
            action="/api/auth/login"
            onSubmit={handleSubmit}
            className="space-y-5 p-6"
          >
            <input type="hidden" name="redirectTo" value="/dashboard-real" />
            <div>
              <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-slate-700">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  placeholder="seu@email.com"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-slate-700">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Digite sua senha"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-11 text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {message && (
              <p
                role="status"
                aria-live="polite"
                className={`rounded-lg border px-3 py-2 text-sm ${
                  message.type === 'success'
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? 'Entrando…' : <><span>Entrar</span><ArrowRight size={18} aria-hidden="true" /></>}
            </button>

            <div className="space-y-3 text-center text-sm">
              <Link href="/recuperar-senha" className="block text-primary hover:underline">Esqueci minha senha</Link>
              <p className="text-slate-500">
                Não tem acesso?{' '}
                <Link href="/signup" className="font-medium text-primary hover:underline">Cadastre-se agora</Link>
              </p>
              <Link href="/demo" className="block text-xs text-slate-400 hover:text-primary">Voltar à demonstração</Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
