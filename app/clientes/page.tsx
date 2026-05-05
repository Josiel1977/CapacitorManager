'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Edit2, Trash2, X, Save } from 'lucide-react';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useSubscriptionGuard } from '@/lib/useSubscriptionGuard';

interface Cliente {
  id: string;
  nome: string;
  cnpj_cpf: string;
  contato_responsavel: string;
  telefone: string;
  email: string;
  ativo: boolean;
}

export default function ClientesPage() {
  useSubscriptionGuard(); // Proteção de assinatura ativa

  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    cnpj_cpf: '',
    contato_responsavel: '',
    telefone: '',
    email: '',
  });

  // Redireciona se não autenticado
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Busca role e tenant_id do perfil
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, tenant_id')
        .eq('id', user.id)
        .single();
      if (error) {
        console.error('Erro ao buscar perfil:', error);
        Swal.fire('Erro', 'Perfil não encontrado. Contate o suporte.', 'error');
        return;
      }
      setIsAdmin(profile?.role === 'admin');
      setTenantId(profile?.tenant_id || null);
    };
    if (isAuthenticated) fetchProfile();
  }, [user, isAuthenticated]);

  // Carrega clientes
  const fetchClientes = async () => {
    try {
      setLoading(true);
      let query = supabase.from('clientes').select('*').eq('ativo', true);
      if (!isAdmin && tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      const { data, error } = await query.order('nome');
      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      Swal.fire('Erro', 'Não foi possível carregar os clientes.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && (isAdmin || tenantId)) {
      fetchClientes();
    }
  }, [isAuthenticated, isAdmin, tenantId]);

  const filteredClientes = clientes.filter(c =>
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cnpj_cpf?.includes(searchTerm)
  );

  function handleOpenModal(cliente: Cliente | null = null) {
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
    if (!isAdmin && !tenantId) {
      Swal.fire('Erro', 'Tenant não identificado.', 'error');
      return;
    }
    const dataToSave = {
      ...formData,
      tenant_id: isAdmin ? null : tenantId,
      ativo: true,
    };
    try {
      if (editingCliente) {
        const { error } = await supabase
          .from('clientes')
          .update(dataToSave)
          .eq('id', editingCliente.id);
        if (error) throw error;
        Swal.fire('Sucesso', 'Cliente atualizado!', 'success');
      } else {
        const { error } = await supabase.from('clientes').insert([dataToSave]);
        if (error) throw error;
        Swal.fire('Sucesso', 'Cliente cadastrado!', 'success');
      }
      setIsModalOpen(false);
      fetchClientes();
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    }
  }

  async function handleDelete(id: string) {
    const result = await Swal.fire({
      title: 'Tem certeza?',
      text: "O cliente será desativado.",
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
        Swal.fire('Excluído!', 'Cliente removido.', 'success');
        fetchClientes();
      } catch (error: any) {
        Swal.fire('Erro', error.message, 'error');
      }
    }
  }

  if (isLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary">Clientes</h1>
          <p className="text-slate-500">Gerencie seus clientes</p>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-primary text-white px-4 py-2 rounded-lg flex gap-2">
          <Plus size={20} /> Novo Cliente
        </button>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Buscar por nome, CNPJ/CPF..."
          className="w-full pl-10 pr-4 py-2 border rounded-lg"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr><th className="px-6 py-3">Nome</th><th className="px-6 py-3">CNPJ/CPF</th><th className="px-6 py-3">Contato</th><th className="px-6 py-3">Telefone</th><th className="px-6 py-3">E-mail</th><th className="px-6 py-3">Ações</th></tr>
          </thead>
          <tbody>
            {filteredClientes.map(cliente => (
              <tr key={cliente.id} className="border-t">
                <td className="px-6 py-4">{cliente.nome}</td>
                <td className="px-6 py-4">{cliente.cnpj_cpf || '-'}</td>
                <td className="px-6 py-4">{cliente.contato_responsavel || '-'}</td>
                <td className="px-6 py-4">{cliente.telefone || '-'}</td>
                <td className="px-6 py-4">{cliente.email || '-'}</td>
                <td className="px-6 py-4">
                  <button onClick={() => handleOpenModal(cliente)} className="text-blue-600 mr-2">Editar</button>
                  <button onClick={() => handleDelete(cliente.id)} className="text-red-600">Excluir</button>
                </td>
              </tr>
            ))}
            {filteredClientes.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">Nenhum cliente encontrado</td></tr>}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
              <div className="mb-6 flex justify-between items-center">
                <h2 className="text-xl font-bold text-primary">{editingCliente ? 'Editar Cliente' : 'Novo Cliente'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium">Nome *</label><input required type="text" className="w-full border rounded p-2" value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label>CNPJ/CPF</label><input type="text" className="w-full border rounded p-2" value={formData.cnpj_cpf} onChange={(e) => setFormData({...formData, cnpj_cpf: e.target.value})} /></div>
                  <div><label>Responsável</label><input type="text" className="w-full border rounded p-2" value={formData.contato_responsavel} onChange={(e) => setFormData({...formData, contato_responsavel: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label>Telefone</label><input type="text" className="w-full border rounded p-2" value={formData.telefone} onChange={(e) => setFormData({...formData, telefone: e.target.value})} /></div>
                  <div><label>E-mail</label><input type="email" className="w-full border rounded p-2" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} /></div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-primary text-white rounded">Salvar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}