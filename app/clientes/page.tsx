'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Edit2, Trash2, X, Save, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

// ✅ 1. Extrair tipos
interface Cliente {
  id: string;
  nome: string;
  cnpj_cpf: string;
  contato_responsavel: string;
  telefone: string;
  email: string;
  ativo: boolean;
  created_at?: string;
}

interface ClienteFormData {
  nome: string;
  cnpj_cpf: string;
  contato_responsavel: string;
  telefone: string;
  email: string;
}

// ✅ 2. Constantes para evitar magic strings
const INITIAL_FORM_DATA: ClienteFormData = {
  nome: '',
  cnpj_cpf: '',
  contato_responsavel: '',
  telefone: '',
  email: '',
};

const MASK_CONFIGS = {
  cnpj: '99.999.999/9999-99',
  cpf: '999.999.999-99',
  telefone: '(99) 99999-9999',
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false); // ✅ 3. Estado para submit
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState<ClienteFormData>(INITIAL_FORM_DATA);
  const [formErrors, setFormErrors] = useState<Partial<ClienteFormData>>({}); // ✅ 4. Validação de campos

  useEffect(() => {
    fetchClientes();
  }, []);

  // ✅ 5. Memoizar funções
  async function fetchClientes() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Error fetching clientes:', error);
      Swal.fire('Erro', 'Não foi possível carregar os clientes', 'error');
    } finally {
      setLoading(false);
    }
  }

  // ✅ 6. Validação de formulário
  const validateForm = (): boolean => {
    const errors: Partial<ClienteFormData> = {};
    
    if (!formData.nome.trim()) {
      errors.nome = 'Nome é obrigatório';
    }
    
    if (formData.cnpj_cpf && !isValidCnpjCpf(formData.cnpj_cpf)) {
      errors.cnpj_cpf = 'CNPJ/CPF inválido';
    }
    
    if (formData.email && !isValidEmail(formData.email)) {
      errors.email = 'E-mail inválido';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ✅ 7. Funções de validação
  const isValidCnpjCpf = (value: string): boolean => {
    const clean = value.replace(/\D/g, '');
    if (clean.length === 11) return true; // CPF - validação simplificada
    if (clean.length === 14) return true; // CNPJ - validação simplificada
    return false;
  };

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // ✅ 8. Formatação de campos
  const formatCnpjCpf = (value: string): string => {
    const clean = value.replace(/\D/g, '');
    if (clean.length <= 11) {
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4').slice(0, 14);
    }
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5').slice(0, 18);
  };

  const formatTelefone = (value: string): string => {
    const clean = value.replace(/\D/g, '');
    if (clean.length <= 10) {
      return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3').slice(0, 13);
    }
    return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3').slice(0, 14);
  };

  // ✅ 9. Handlers com useCallback
  const handleInputChange = useCallback((field: keyof ClienteFormData, value: string) => {
    let formattedValue = value;
    
    if (field === 'cnpj_cpf') {
      formattedValue = formatCnpjCpf(value);
    } else if (field === 'telefone') {
      formattedValue = formatTelefone(value);
    }
    
    setFormData(prev => ({ ...prev, [field]: formattedValue }));
    // Limpa erro do campo quando o usuário começa a digitar
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [formErrors]);

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
      setFormData(INITIAL_FORM_DATA);
    }
    setFormErrors({});
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // ✅ 10. Validação antes de enviar
    if (!validateForm()) {
      Swal.fire('Atenção', 'Preencha os campos corretamente', 'warning');
      return;
    }
    
    setSubmitting(true);
    
    try {
      if (editingCliente) {
        const { error } = await supabase
          .from('clientes')
          .update(formData)
          .eq('id', editingCliente.id);
        
        if (error) throw error;
        Swal.fire('Sucesso', 'Cliente atualizado com sucesso!', 'success');
      } else {
        // ✅ 11. Verificar duplicata antes de inserir
        const { data: existing } = await supabase
          .from('clientes')
          .select('id')
          .eq('nome', formData.nome)
          .eq('ativo', true)
          .maybeSingle();
        
        if (existing) {
          Swal.fire('Atenção', 'Já existe um cliente com este nome', 'warning');
          setSubmitting(false);
          return;
        }
        
        const { error } = await supabase
          .from('clientes')
          .insert([formData]);
        
        if (error) throw error;
        Swal.fire('Sucesso', 'Cliente cadastrado com sucesso!', 'success');
      }
      
      setIsModalOpen(false);
      fetchClientes();
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const result = await Swal.fire({
      title: 'Tem certeza?',
      html: `
        <p>O cliente será <strong>desativado</strong> do sistema.</p>
        <p class="text-sm text-slate-500 mt-2">Capacitores e medições associados serão mantidos no histórico.</p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0a2b3c',
      cancelButtonColor: '#e74c3c',
      confirmButtonText: 'Sim, desativar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        // ✅ 12. Verificar se o cliente tem bancos antes de desativar
        const { count: bancosCount } = await supabase
          .from('bancos_capacitores')
          .select('*', { count: 'exact', head: true })
          .eq('cliente_id', id)
          .eq('ativo', true);
        
        if (bancosCount && bancosCount > 0) {
          const confirm = await Swal.fire({
            title: 'Atenção!',
            text: `Este cliente possui ${bancosCount} banco(s) de capacitores ativo(s). Desativar o cliente irá desativar também seus bancos e capacitores. Deseja continuar?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#0a2b3c',
            cancelButtonColor: '#e74c3c',
            confirmButtonText: 'Sim, continuar',
            cancelButtonText: 'Cancelar'
          });
          
          if (!confirm.isConfirmed) return;
        }
        
        const { error } = await supabase
          .from('clientes')
          .update({ ativo: false })
          .eq('id', id);
        
        if (error) throw error;
        Swal.fire('Desativado!', 'Cliente removido com sucesso.', 'success');
        fetchClientes();
      } catch (error: any) {
        Swal.fire('Erro', error.message, 'error');
      }
    }
  }

  // ✅ 13. Memoizar lista filtrada
  const filteredClientes = useMemo(() => {
    if (!searchTerm) return clientes;
    
    const term = searchTerm.toLowerCase();
    return clientes.filter(c => 
      c.nome.toLowerCase().includes(term) ||
      c.cnpj_cpf?.includes(term) ||
      c.email?.toLowerCase().includes(term) // ✅ Buscar também por email
    );
  }, [clientes, searchTerm]);

  // ✅ 14. Componente de loading esqueleton
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
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-white transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <Plus size={20} />
          Novo Cliente
        </button>
      </header>

      {/* ✅ 15. Barra de busca melhorada */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome, CNPJ/CPF ou e-mail..." 
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="text-sm text-slate-500">
          {filteredClientes.length} cliente(s) encontrado(s)
        </div>
      </div>

      {/* ✅ 16. Tabela com responsividade melhorada */}
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
              <AnimatePresence>
                {filteredClientes.map((cliente, index) => (
                  <motion.tr 
                    key={cliente.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <span className="font-medium text-primary">{cliente.nome}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-sm">
                      {cliente.cnpj_cpf || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600 hidden md:table-cell">
                      {cliente.contato_responsavel || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600 hidden lg:table-cell">
                      {cliente.telefone || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600 hidden xl:table-cell">
                      {cliente.email || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={() => handleOpenModal(cliente)}
                          className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(cliente.id)}
                          className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50"
                          title="Desativar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {filteredClientes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Search size={32} className="opacity-50" />
                      <p>Nenhum cliente encontrado</p>
                      <button 
                        onClick={() => handleOpenModal()}
                        className="mt-2 text-primary hover:underline"
                      >
                        + Cadastrar primeiro cliente
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ✅ 17. Modal melhorado */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => !submitting && setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-primary">
                  {editingCliente ? '✏️ Editar Cliente' : '➕ Novo Cliente'}
                </h2>
                <button 
                  onClick={() => !submitting && setIsModalOpen(false)} 
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  disabled={submitting}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <input 
                    required
                    type="text" 
                    className={cn(
                      "w-full rounded-lg border px-4 py-2 outline-none transition-all focus:ring-1",
                      formErrors.nome 
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500" 
                        : "border-slate-200 focus:border-primary focus:ring-primary"
                    )}
                    value={formData.nome}
                    onChange={(e) => handleInputChange('nome', e.target.value)}
                    disabled={submitting}
                  />
                  {formErrors.nome && (
                    <p className="mt-1 text-xs text-red-500">{formErrors.nome}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">CNPJ/CPF</label>
                    <input 
                      type="text" 
                      className={cn(
                        "w-full rounded-lg border px-4 py-2 outline-none transition-all font-mono text-sm",
                        formErrors.cnpj_cpf 
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500" 
                          : "border-slate-200 focus:border-primary focus:ring-primary"
                      )}
                      value={formData.cnpj_cpf}
                      onChange={(e) => handleInputChange('cnpj_cpf', e.target.value)}
                      placeholder="00.000.000/0000-00"
                      disabled={submitting}
                    />
                    {formErrors.cnpj_cpf && (
                      <p className="mt-1 text-xs text-red-500">{formErrors.cnpj_cpf}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Responsável</label>
                    <input 
                      type="text" 
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      value={formData.contato_responsavel}
                      onChange={(e) => handleInputChange('contato_responsavel', e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Telefone</label>
                    <input 
                      type="tel" 
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono text-sm"
                      value={formData.telefone}
                      onChange={(e) => handleInputChange('telefone', e.target.value)}
                      placeholder="(00) 00000-0000"
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">E-mail</label>
                    <input 
                      type="email" 
                      className={cn(
                        "w-full rounded-lg border px-4 py-2 outline-none transition-all",
                        formErrors.email 
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500" 
                          : "border-slate-200 focus:border-primary focus:ring-primary"
                      )}
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      disabled={submitting}
                    />
                    {formErrors.email && (
                      <p className="mt-1 text-xs text-red-500">{formErrors.email}</p>
                    )}
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-lg px-6 py-2 text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-white transition-all hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        Salvar
                      </>
                    )}
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
