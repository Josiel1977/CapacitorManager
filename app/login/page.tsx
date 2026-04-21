'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Zap, Lock, Mail, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Preencher com as credenciais padrão
  const preencherCredenciais = () => {
    setEmail('suporte@jmeletroservice.com.br');
    setSenha('Suporte@1677#');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(email, senha);
    if (success) {
      Swal.fire({
        title: 'Bem-vindo!',
        text: 'Login realizado com sucesso.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
      router.push('/');
    } else {
      Swal.fire({
        title: 'Erro!',
        text: 'E-mail ou senha inválidos.',
        icon: 'error',
        confirmButtonColor: '#0a2b3c'
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="bg-primary p-6 text-center">
          <div className="inline-flex p-3 bg-white/10 rounded-xl mb-4">
            <Zap size={32} className="text-secondary" />
          </div>
          <h1 className="text-2xl font-bold text-white">CapacitorManager</h1>
          <p className="text-white/70 text-sm">Acesso ao Sistema</p>
        </div>

        <form onSubmit={handleLogin} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                required
                placeholder="suporte@jmeletroservice.com.br"
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:border-primary outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••"
                className="w-full pl-10 pr-10 py-2 border border-slate-200 rounded-lg focus:border-primary outline-none"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Entrar
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-slate-400">ou</span>
            </div>
          </div>

          <button
            type="button"
            onClick={preencherCredenciais}
            className="w-full border border-slate-200 text-slate-600 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles size={18} />
            Preencher credenciais de teste
          </button>

          <p className="text-center text-xs text-slate-400 mt-4">
            Não tem acesso? <a href="/contato" className="text-primary hover:underline">Solicite uma demonstração</a>
          </p>
        </form>
      </motion.div>
    </div>
  );
}