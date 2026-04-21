'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Edit2, Trash2, X, Save, Database, Filter, ChevronDown } from 'lucide-react';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'motion/react';
import { parseNumber, cn } from '@/lib/utils';

export default function BancosPage() {
  const [bancos, setBancos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState<string>('todos'); // ✅ Filtro por cliente
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanco, setEditingBanco] = useState<any>(null);
  const [formData, setFormData] = useState({
    cliente_id: '',
    nome_banco: '',
    localizacao: '',
    tensao_nominal: '',
    potencia_total_kvar: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      
      // Buscar todos os bancos ativos com dados do cliente
      const { data: bancosData, error: bancosError } = await supabase
        .from('bancos_capacitores')
        .select(`
          *,
          clientes(id, nome)
        `)
        .eq('ativo', true)
        .order('nome_banco');
      
      // Buscar clientes ativos para o filtro
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');

      if (bancosError) throw bancosError;
      if (clientesError) throw clientesError;

      setBancos(bancosData || []);
      setClientes(clientesData || []);
    } catch (error) {
      console.error('Error:', error);
      Swal.fire('Erro', 'Não foi possível carregar os dados', 'error');
    } finally {
      setLoading(false);
    }
  }

  // ✅ Filtrar bancos por cliente e busca
  const filteredBancos = useMemo(() => {
    let filtered = [...bancos];
    
    // Filtrar por cliente
    if (clienteFiltro !== 'todos') {
      filtered = filtered.filter(b => b.cliente_id === clienteFiltro);
    }
    
    // Filtrar por busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(b => 
        b.nome_banco.toLowerCase().includes(term) ||
        b.clientes?.nome.toLowerCase().includes(term) ||
        b.localizacao?.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  }, [bancos, clienteFiltro, searchTerm]);

  // ✅ Estatísticas dos bancos filtrados
  const stats = {
    total: filteredBancos.length,
    totalPotencia: filteredBancos.reduce((acc, b) => acc + (parseFloat(b.potencia_total_kvar) || 0), 0),
    clientesAtendidos: new Set(filteredBancos.map(b => b.cliente_id)).size,
  };

  function handleOpenModal(banco: any = null) {
    if (banco) {
      setEditingBanco(banco);
      setFormData({
        cliente_id: banco.cliente_id,
        nome_banco: banco.nome_banco,
        localizacao: banco.localizacao || '',
        tensao_nominal: banco.tensao_nominal || '',
        potencia_total_kvar: banco.potencia_total_kvar || '',
      });
    } else {
      setEditingBanco(null);
      // ✅ Se tiver um cliente filtrado, pré-seleciona ele no formulário
      setFormData({
        cliente_id: clienteFiltro !== 'todos' ? clienteFiltro : '',
        nome_banco: '',
        localizacao: '',
        tensao_nominal: '',
        potencia_total_kvar: '',
      });
    }
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.cliente_id) {
      Swal.fire('Atenção', 'Selecione um cliente', 'warning');
      return;
    }
    
    try {
      const data = {
        cliente_id: formData.cliente_id,
        nome_banco: formData.nome_banco,
        localizacao: formData.localizacao || null,
        tensao_nominal: formData.tensao_nominal ? parseNumber(formData.tensao_nominal) : null,
        potencia_total_kvar: formData.potencia_total_kvar ? parseNumber(formData.potencia_total_kvar) : null,
      };

      if (editingBanco) {
        const { error } = await supabase
          .from('bancos_capacitores')
          .update(data)
          .eq('id', editingBanco.id);
        if (error) throw error;
        Swal.fire('Sucesso', 'Banco atualizado com sucesso!', 'success');
      } else {
        const { error } = await supabase
          .from('bancos_capacitores')
          .insert([{ ...data, ativo: true }]);
        if (error) throw error;
        Swal.fire('Sucesso', 'Banco cadastrado com sucesso!', 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    }
  }

  async function handleDelete(id: string) {
    const result = await Swal.fire({
      title: 'Tem certeza?',
      text: "O banco será desativado do sistema.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0a2b3c',
      cancelButtonColor: '#e74c3c',
      confirmButtonText: 'Sim, desativar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        // ✅ Verificar se existem capacitores vinculados
        const { count: capacitoresCount } = await supabase
          .from('capacitores')
          .select('*', { count: 'exact', head: true })
          .eq('banco_id', id)
          .eq('ativo', true);
        
        if (capacitoresCount && capacitoresCount > 0) {
          const confirm = await Swal.fire({
            title: 'Atenção!',
            text: `Este banco possui ${capacitoresCount} capacitor(es) vinculado(s). Desativar o banco irá desativar também seus capacitores. Deseja continuar?`,
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
          .from('bancos_capacitores')
          .update({ ativo: false })
          .eq('id', id);
        
        if (error) throw error;
        Swal.fire('Desativado!', 'Banco removido com sucesso.', 'success');
        fetchData();
      } catch (error: any) {
        Swal.fire('Erro', error.message, 'error');
      }
    }
  }

  // ✅ Obter nome do cliente selecionado para exibição
  const clienteSelecionado = clientes.find(c => c.id === clienteFiltro);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary">Bancos de Capacitores</h1>
          <p className="text-slate-500">Gerencie os bancos vinculados aos seus clientes</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-primary/90"
        >
          <Plus size={20} />
          Novo Banco
        </button>
      </header>

      {/* ✅ Filtro por Cliente */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Select de cliente */}
        <div className="lg:col-span-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">Filtrar por Cliente</label>
          <div className="relative">
            <select 
              className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-4 py-2 pr-8 outline-none focus:border-primary"
              value={clienteFiltro}
              onChange={(e) => setClienteFiltro(e.target.value)}
            >
              <option value="todos">📋 Todos os clientes</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>🏢 {c.nome}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>

        {/* Busca */}
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nome do banco, cliente ou localização..." 
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 outline-none focus:border-primary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Estatísticas */}
        <div className="bg-primary/5 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500">Bancos encontrados</p>
          <p className="text-2xl font-bold text-primary">{stats.total}</p>
          <p className="text-[10px] text-slate-400">{stats.totalPotencia.toFixed(0)} kVAr total</p>
        </div>
      </div>

      {/* ✅ Indicador de filtro ativo */}
      {clienteFiltro !== 'todos' && (
        <div className="flex items-center gap-2 text-sm bg-primary/10 text-primary rounded-lg px-3 py-2">
          <Filter size={14} />
          <span>Filtrando por: <strong>{clienteSelecionado?.nome}</strong></span>
          <button 
            onClick={() => setClienteFiltro('todos')}
            className="ml-auto text-xs hover:underline"
          >
            Limpar filtro
          </button>
        </div>
      )}

      {/* Grid de Bancos */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredBancos.map((banco) => (
            <motion.div 
              key={banco.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="group relative rounded-xl bg-white p-6 shadow-sm border border-slate-100 transition-all hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Database size={24} />
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => handleOpenModal(banco)}
                    className="rounded p-1.5 text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(banco.id)}
                    className="rounded p-1.5 text-red-600 hover:bg-red-50 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-primary">{banco.nome_banco}</h3>
              <p className="mb-4 text-sm font-medium text-secondary">
                {banco.clientes?.nome}
              </p>
              
              <div className="space-y-2 text-sm text-slate-600">
                {banco.localizacao && (
                  <div className="flex justify-between">
                    <span>📍 Localização:</span>
                    <span className="font-medium">{banco.localizacao}</span>
                  </div>
                )}
                {banco.tensao_nominal && (
                  <div className="flex justify-between">
                    <span>⚡ Tensão:</span>
                    <span className="font-medium">{banco.tensao_nominal} V</span>
                  </div>
                )}
                {banco.potencia_total_kvar && (
                  <div className="flex justify-between">
                    <span>💪 Potência:</span>
                    <span className="font-medium">{banco.potencia_total_kvar} kVAr</span>
                  </div>
                )}
              </div>

              {/* Link para ver capacitores deste banco */}
              <button 
                onClick={() => window.location.href = `/capacitores?banco_id=${banco.id}`}
                className="mt-4 w-full text-center text-xs text-primary hover:underline"
              >
                Ver capacitores →
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {filteredBancos.length === 0 && !loading && (
        <div className="py-12 text-center text-slate-400">
          <Database size={48} className="mx-auto mb-3 opacity-50" />
          <p>Nenhum banco encontrado</p>
          {clienteFiltro !== 'todos' && (
            <button 
              onClick={() => setClienteFiltro('todos')}
              className="mt-2 text-primary hover:underline"
            >
              Limpar filtro e ver todos os bancos
            </button>
          )}
        </div>
      )}

      {/* Modal - igual ao original */}
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
                  {editingBanco ? '✏️ Editar Banco' : '➕ Novo Banco'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Cliente <span className="text-red-500">*</span>
                  </label>
                  <select 
                    required
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                    value={formData.cliente_id}
                    onChange={(e) => setFormData({...formData, cliente_id: e.target.value})}
                  >
                    <option value="">Selecione um cliente</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Nome do Banco <span className="text-red-500">*</span>
                  </label>
                  <input 
                    required
                    type="text" 
                    placeholder="Ex: Banco Principal"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                    value={formData.nome_banco}
                    onChange={(e) => setFormData({...formData, nome_banco: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Localização</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Subestação 01, Sala de Máquinas"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                    value={formData.localizacao}
                    onChange={(e) => setFormData({...formData, localizacao: e.target.value})}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Tensão Nominal (V)</label>
                    <input 
                      type="number" 
                      placeholder="Ex: 480"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                      value={formData.tensao_nominal}
                      onChange={(e) => setFormData({...formData, tensao_nominal: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Potência Total (kVAr)</label>
                    <input 
                      type="number" 
                      placeholder="Ex: 150"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                      value={formData.potencia_total_kvar}
                      onChange={(e) => setFormData({...formData, potencia_total_kvar: e.target.value})}
                    />
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-lg px-6 py-2 text-slate-600 transition-colors hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-white transition-colors hover:bg-primary/90"
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
