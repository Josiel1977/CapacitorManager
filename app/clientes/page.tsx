'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Plus, Search, Edit2, Trash2, X, Save } from 'lucide-react';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'motion/react';

export default function ClientesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<any>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [limites, setLimites] = useState({ limite_clientes: 0, plan: '' });
  const [formData, setFormData] = useState({
    nome: '',
    cnpj_cpf: '',
    contato_responsavel: '',
    telefone: '',
    email: '',
  });

  useEffect(() => {
    const getUserAndTenant = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.tenant_id) {
        Swal.fire('Erro', 'Perfil sem tenant. Contate o administrador.', 'error');
        router.push('/login');
        return;
      }

      setTenantId(profile.tenant_id);

      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('plan, limite_clientes')
        .eq('id', profile.tenant_id)
        .single();

      if (!tenantError && tenant) {
        setLimites({ limite_clientes: tenant.limite_clientes, plan: tenant.plan });
      }

      await fetchClientes(profile.tenant_id);
    };

    getUserAndTenant();
  }, [router, supabase]);

  async function fetchClientes(tenantId: string) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Error fetching clientes:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredClientes = clientes.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cnpj_cpf?.includes(searchTerm)
  );

  function handleOpenModal(cliente: any = null) {
    if (cliente) {
      setEditingCliente(cliente);
      setFormData({
        nome: cliente.nome,
        cnpj_cpf: cliente.cnpj_cpf || '',
        contato_responsavel: cliente.contato_responsavel || '',
        telefone: cliente.telefone || '',
        email: cliente.email || '',
      });
    } else {
      setEditingCliente(null);
      setFormData({
        nome: '',
        cnpj_cpf: '',
        contato_responsavel: '',
        telefone: '',
        email: '',
      });
    }
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;

    try {
      if (!editingCliente && limites.limite_clientes > 0) {
        const currentCount = clientes.length;
        if (currentCount >= limites.limite_clientes) {
          Swal.fire({
            title: 'Limite do plano atingido',
            html: `Seu plano <strong>${limites.plan}</strong> permite no máximo ${limites.limite_clientes} clientes ativos.<br/><br/>Faça upgrade para adicionar mais clientes.`,
            icon: 'warning',
            confirmButtonText: 'Ver planos',
            showCancelButton: true,
            cancelButtonText: 'Cancelar'
          }).then((result) => {
            if (result.isConfirmed) router.push('/planos');
          });
          return;
        }
      }

      const dataToSave = {
        ...formData,
        tenant_id: tenantId,
      };

      if (editingCliente) {
        const { error } = await supabase
          .from('clientes')
          .update(dataToSave)
          .eq('id', editingCliente.id);
        if (error) throw error;
        Swal.fire('Sucesso', 'Cliente atualizado com sucesso!', 'success');
      } else {
        const { error } = await supabase
          .from('clientes')
          .insert([dataToSave]);
        if (error) throw error;
        Swal.fire('Sucesso', 'Cliente cadastrado com sucesso!', 'success');
      }
      setIsModalOpen(false);
      await fetchClientes(tenantId);
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    }
  }

  async function handleDelete(id: string) {
    const result = await Swal.fire({
      title: 'Tem certeza?',
      text: "O cliente será desativado do sistema.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0a2b3c',
      cancelButtonColor: '#e74c3c',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from('clientes')
          .update({ ativo: false })
          .eq('id', id);
        if (error) throw error;
        Swal.fire('Excluído!', 'Cliente removido com sucesso.', 'success');
        await fetchClientes(tenantId!);
      } catch (error: any) {
        Swal.fire('Erro', error.message, 'error');
      }
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary">Clientes</h1>
          <p className="text-slate-500">Gerencie o cadastro de seus clientes</p>
          {limites.limite_clientes > 0 && (
            <p className="text-xs text-slate-400 mt-1">
              Plano {limites.plan}: {clientes.length} / {limites.limite_clientes} clientes
            </p>
          )}
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-primary/90"
        >
          <Plus size={20} />
          Novo Cliente
        </button>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Buscar por nome, CNPJ/CPF ou e-mail..." 
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-sm font-medium text-slate-500">
              <tr>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">CNPJ/CPF</th>
                <th className="px-6 py-4 hidden md:table-cell">Contato</th>
                <th className="px-6 py-4 hidden lg:table-cell">Telefone</th>
                <th className="px-6 py-4 hidden xl:table-cell">E-mail</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClientes.map((cliente) => (
                <tr key={cliente.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-primary">{cliente.nome}</td>
                  <td className="px-6 py-4 text-slate-600 font-mono text-sm">{cliente.cnpj_cpf || '-'}</td>
                  <td className="px-6 py-4 text-slate-600 hidden md:table-cell">{cliente.contato_responsavel || '-'}</td>
                  <td className="px-6 py-4 text-slate-600 hidden lg:table-cell">{cliente.telefone || '-'}</td>
                  <td className="px-6 py-4 text-slate-600 hidden xl:table-cell">{cliente.email || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleOpenModal(cliente)} className="rounded p-1.5 text-blue-600 hover:bg-blue-50"><Edit2 size={18} /></button>
                      <button onClick={() => handleDelete(cliente.id)} className="rounded p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClientes.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Nenhum cliente encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-primary">
                  {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={20} /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Nome Completo *</label>
                  <input 
                    required
                    type="text" 
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                    value={formData.nome}
                    onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">CNPJ/CPF</label>
                    <input 
                      type="text" 
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                      value={formData.cnpj_cpf}
                      onChange={(e) => setFormData({...formData, cnpj_cpf: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Responsável</label>
                    <input 
                      type="text" 
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                      value={formData.contato_responsavel}
                      onChange={(e) => setFormData({...formData, contato_responsavel: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Telefone</label>
                    <input 
                      type="text" 
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                      value={formData.telefone}
                      onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">E-mail</label>
                    <input 
                      type="email" 
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-lg px-6 py-2 text-slate-600 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-white hover:bg-primary/90"
                  >
                    <Save size={18} />
                    Salvar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}