"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { motion } from "motion/react";
import { Zap, Mail, Lock, Building, CreditCard } from "lucide-react";

const PLANOS = [
  { id: "essencial", nome: "Essencial", preco: "R$ 297/mês", descricao: "Até 5 clientes, 10 bancos, 50 capacitores" },
  { id: "pro", nome: "Pro", preco: "R$ 597/mês", descricao: "Até 20 clientes, 50 bancos, 200 capacitores" },
  { id: "enterprise", nome: "Enterprise", preco: "Sob consulta", descricao: "Clientes ilimitados + suporte prioritário" },
];

export default function SignupPage() {
  const router = useRouter();
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [plano, setPlano] = useState("essencial");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Criar o tenant
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .insert({ 
          name: empresa, 
          email, 
          plano, 
          status: "active",
          subdomain: empresa.toLowerCase().replace(/[^a-z0-9]/g, "-")
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // 2. Criar usuário no Supabase Auth
      const { data: authUser, error: authError } = await supabase.auth.signUp({
        email,
        password: senha,
      });

      if (authError) throw authError;

      if (!authUser.user) throw new Error("Erro ao criar usuário");

      // 3. Criar perfil do usuário
      const { error: profileError } = await supabase.from("profiles").insert({
        id: authUser.user.id,
        email,
        role: "user",
        tenant_id: tenant.id,
      });

      if (profileError) throw profileError;

      // 4. Redirecionar para login com mensagem de sucesso
      await Swal.fire({
        title: "✅ Conta criada com sucesso!",
        text: "Faça login para acessar o sistema.",
        icon: "success",
        confirmButtonColor: "#0a2b3c",
      });
      router.push("/login");
    } catch (error: any) {
      console.error(error);
      Swal.fire("Erro", error.message || "Não foi possível criar a conta.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-primary p-6 text-center">
          <div className="inline-flex p-3 bg-white/10 rounded-xl mb-4"><Zap size={32} className="text-secondary" /></div>
          <h1 className="text-2xl font-bold text-white">CapacitorManager</h1>
          <p className="text-white/70 text-sm">Comece sua jornada</p>
        </div>
        <form onSubmit={handleSignup} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Empresa *</label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" required placeholder="Minha Empresa Ltda" className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:border-primary focus:outline-none" value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="email" required placeholder="contato@empresa.com" className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:border-primary focus:outline-none" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Senha *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="password" required placeholder="••••••" className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:border-primary focus:outline-none" value={senha} onChange={(e) => setSenha(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Escolha seu plano *</label>
            <div className="space-y-2">
              {PLANOS.map((p) => (
                <label key={p.id} className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition ${plano === p.id ? "border-primary bg-primary/5" : "border-slate-200 hover:bg-slate-50"}`}>
                  <div className="flex items-center gap-3">
                    <input type="radio" name="plano" value={p.id} checked={plano === p.id} onChange={() => setPlano(p.id)} className="text-primary" />
                    <div>
                      <p className="font-medium">{p.nome}</p>
                      <p className="text-xs text-slate-500">{p.descricao}</p>
                    </div>
                  </div>
                  <p className="font-bold text-primary">{p.preco}</p>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-primary text-white py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Criar conta"}
          </button>
          <p className="text-center text-xs text-slate-400">Já tem conta? <a href="/login" className="text-primary hover:underline">Faça login</a></p>
        </form>
      </motion.div>
    </div>
  );
}