'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Edit2, Trash2, X, Save, Zap, Filter, ChevronDown, Eye, ArrowLeft } from 'lucide-react';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'motion/react';
import { parseNumber, cn } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';

export default function CapacitoresPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bancoIdFromUrl = searchParams.get('banco_id');
  
  const [capacitores, setCapacitores] = useState<any[]>([]);
  const [bancos, setBancos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [bancoFiltro, setBancoFiltro] = useState<string>(bancoIdFromUrl || 'todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCapacitor, setEditingCapacitor] = useState<any>(null);
  const [bancoSelecionadoInfo, setBancoSelecionadoInfo] = useState<any>(null);
  const [formData, setFormData] = useState({
    banco_id: '',
    codigo_identificacao: '',
    potencia_kvar: '',
    capacitancia_nominal_uf: '',
    tensao_nominal_v: '',
    data_instalacao: '',
    fabricante: '',
    modelo: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (bancoIdFromUrl) {
      setBancoFiltro(bancoIdFromUrl);
      carregarInfoBanco(bancoIdFromUrl);
    }
  }, [bancoIdFromUrl]);

  async function carregarInfoBanco(bancoId: string) {
    const { data } = await supabase
      .from('bancos_capacitores')
      .select('*, clientes(id, nome)')
      .eq('id', bancoId)
      .single();
    
    if (data) {
      setBancoSelecionadoInfo(data);
    }
  }

  async function fetchData() {
    try {
      setLoading(true);
      
      // Buscar bancos para o filtro
      const { data: bancosData, error: bancosError } = await supabase
        .from('bancos_capacitores')
        .select('*, clientes(id, nome)')
        .eq('ativo', true)
        .order('nome_banco');
      
      if (bancosError) throw bancosError;

      // Buscar todos os capacitores ativos
      let query = supabase
        .from('capacitores')
        .select('*, bancos_capacitores(*, clientes(id, nome))')
        .eq('ativo', true);

      // Aplicar filtro de banco se selecionado
      if (bancoFiltro !== 'todos') {
        query = query.eq('banco_id', bancoFiltro);
      }

      const { data: capacitoresData, error: capacitoresError } = await query.order('codigo_identificacao');

      if (capacitoresError) throw capacitoresError;

      // Buscar clientes para o formulário
      const { data: clientesData } = await supabase
        .from('clientes')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');

      setCapacitores(capacitoresData || []);
      setBancos(bancosData || []);
      setClientes(clientesData || []);
    } catch (error) {
      console.error('Error:', error);
      Swal.fire('Erro', 'Não foi possível carregar os dados', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Filtrar capacitores por busca
  const filteredCapacitores = capacitores.filter(cap => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return cap.codigo_identificacao.toLowerCase().includes(term) ||
             cap.bancos_capacitores?.nome_banco?.toLowerCase().includes(term) ||
             cap.bancos_capacitores?.clientes?.nome?.toLowerCase().includes(term);
    }
    return true;
  });

  // Estatísticas dos capacitores filtrados
  const stats = {
    total: filteredCapacitores.length,
    totalPotencia: filteredCapacitores.reduce((acc, cap) => acc + (parseFloat(cap.potencia_kvar) || 0), 0),
    tensoes: [...new Set(filteredCapacitores.map(cap => cap.tensao_nominal_v))].filter(Boolean),
  };

  function handleOpenModal(capacitor: any = null) {
    if (capacitor) {
      setEditingCapacitor(capacitor);
      setFormData({
        banco_id: capacitor.banco_id,
        codigo_identificacao: capacitor.codigo_identificacao,
        potencia_kvar: capacitor.potencia_kvar?.toString() || '',
        capacitancia_nominal_uf: capacitor.capacitancia_nominal_uf?.toString() || '',
        tensao_nominal_v: capacitor.tensao_nominal_v?.toString() || '',
        data_instalacao: capacitor.data_instalacao || '',
        fabricante: capacitor.fabricante || '',
        modelo: capacitor.modelo || '',
      });
    } else {
      setEditingCapacitor(null);
      setFormData({
        banco_id: bancoFiltro !== 'todos' ? bancoFiltro : '',
        codigo_identificacao: '',
        potencia_kvar: '',
        capacitancia_nominal_uf: '',
        tensao_nominal_v: '',
        data_instalacao: '',
        fabricante: '',
        modelo: '',
      });
    }
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.banco_id || !formData.codigo_identificacao || !formData.potencia_kvar || !formData.tensao_nominal_v) {
      Swal.fire('Atenção', 'Preencha todos os campos obrigatórios', 'warning');
      return;
    }
    
    try {
      const data = {
        banco_id: formData.banco_id,
        codigo_identificacao: formData.codigo_identificacao,
        potencia_kvar: parseNumber(formData.potencia_kvar),
        capacitancia_nominal_uf: formData.capacitancia_nominal_uf ? parseNumber(formData.capacitancia_nominal_uf) : null,
        tensao_nominal_v: parseNumber(formData.tensao_nominal_v),
        data_instalacao: formData.data_instalacao || null,
        fabricante: formData.fabricante || null,
        modelo: formData.modelo || null,
      };

      if (editingCapacitor) {
        const { error } = await supabase
          .from('capacitores')
          .update(data)
          .eq('id', editingCapacitor.id);
        if (error) throw error;
        Swal.fire('Sucesso', 'Capacitor atualizado com sucesso!', 'success');
      } else {
        const { error } = await supabase
          .from('capacitores')
          .insert([{ ...data, ativo: true }]);
        if (error) throw error;
        
        // Após adicionar capacitor, recalcular potência do banco
        await recalcularPotenciaBanco(formData.banco_id);
        Swal.fire('Sucesso', 'Capacitor cadastrado com sucesso!', 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    }
  }

  async function recalcularPotenciaBanco(bancoId: string) {
    const { data: capacitores } = await supabase
      .from('capacitores')
      .select('potencia_kvar')
      .eq('banco_id', bancoId)
      .eq('ativo', true);

    const potenciaTotal = capacitores?.reduce((sum, cap) => sum + (cap.potencia_kvar || 0), 0) || 0;

    await supabase
      .from('bancos_capacitores')
      .update({ potencia_total_kvar: potenciaTotal })
      .eq('id', bancoId);
  }

  async function handleDelete(id: string, bancoId: string) {
    const result = await Swal.fire({
      title: 'Tem certeza?',
      text: "O capacitor será desativado do sistema.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0a2b3c',
      cancelButtonColor: '#e74c3c',
      confirmButtonText: 'Sim, desativar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from('capacitores')
          .update({ ativo: false })
          .eq('id', id);
        if (error) throw error;
        
        // Recalcular potência do banco após remover capacitor
        await recalcularPotenciaBanco(bancoId);
        
        Swal.fire('Desativado!', 'Capacitor removido com sucesso.', 'success');
        fetchData();
      } catch (error: any) {
        Swal.fire('Erro', error.message, 'error');
      }
    }
  }

  function handleVoltarParaBancos() {
    router.push('/bancos');
  }

  // Obter nome do banco selecionado
  const bancoSelecionado = bancos.find(b => b.id === bancoFiltro);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-3 mb-2">
            {bancoIdFromUrl && (
              <button 
                onClick={handleVoltarParaBancos}
                className="flex items-center gap-1 text-primary hover:underline text-sm"
              >
                <ArrowLeft size={16} />
                Voltar para Bancos
              </button>
            )}
          </div>
          <h1 className="text-3xl font-bold text-primary">Capacitores</h1>
          <p className="text-slate-500">Gerencie os capacitores dos bancos</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-primary/90"
        >
          <Plus size={20} />
          Novo Capacitor
        </button>
      </header>

      {/* Banner do Banco Selecionado */}
      {bancoSelecionadoInfo && (
        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-5 border border-primary/20">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs text-slate-500">Banco selecionado</p>
              <h2 className="text-xl font-bold text-primary">{bancoSelecionadoInfo.nome_banco}</h2>
              <p className="text-sm text-slate-500">Cliente: {bancoSelecionadoInfo.clientes?.nome}</p>
            </div>
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-xs text-slate-500">Tensão</p>
                <p className="text-lg font-bold text-primary">{bancoSelecionadoInfo.tensao_nominal || '-'} V</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500">Potência Total</p>
                <p className="text-lg font-bold text-primary">{bancoSelecionadoInfo.potencia_calculada || 0} kVAr</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4">
            <label className="mb-1 block text-xs font-medium text-slate-500">Filtrar por Banco</label>
            <div className="relative">
              <select 
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-4 py-2.5 pr-8 outline-none focus:border-primary"
                value={bancoFiltro}
                onChange={(e) => {
                  setBancoFiltro(e.target.value);
                  if (e.target.value !== 'todos') {
                    carregarInfoBanco(e.target.value);
                  } else {
                    setBancoSelecionadoInfo(null);
                  }
                  fetchData();
                }}
              >
                <option value="todos">📋 Todos os bancos</option>
                {bancos.map(b => (
                  <option key={b.id} value={b.id}>🏢 {b.clientes?.nome} - {b.nome_banco}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>

          <div className="lg:col-span-5">
            <label className="mb-1 block text-xs font-medium text-slate-500">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por código, banco ou cliente..." 
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 outline-none focus:border-primary"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="lg:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-500">Estatísticas</label>
            <div className="bg-primary/5 rounded-lg p-2 text-center">
              <p className="text-xs text-slate-500">Potência Total</p>
              <p className="text-lg font-bold text-primary">{stats.totalPotencia.toFixed(0)} kVAr</p>
              <p className="text-[10px] text-slate-400">{stats.total} capacitor(es)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Indicador de filtro ativo */}
      {bancoFiltro !== 'todos' && bancoSelecionado && (
        <div className="flex items-center gap-2 text-sm bg-primary/10 text-primary rounded-lg px-3 py-2">
          <Filter size={14} />
          <span>Filtrando por: <strong>{bancoSelecionado.nome_banco}</strong></span>
          <button 
            onClick={() => {
              setBancoFiltro('todos');
              setBancoSelecionadoInfo(null);
              fetchData();
            }}
            className="ml-auto text-xs hover:underline"
          >
            Limpar filtro
          </button>
        </div>
      )}

      {/* Grid de Capacitores */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-56 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCapacitores.map((capacitor) => (
            <motion.div 
              key={capacitor.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="group relative rounded-xl bg-white p-6 shadow-sm border border-slate-100 transition-all hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Zap size={24} />
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => handleOpenModal(capacitor)}
                    className="rounded p-1.5 text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(capacitor.id, capacitor.banco_id)}
                    className="rounded p-1.5 text-red-600 hover:bg-red-50 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-primary">{capacitor.codigo_identificacao}</h3>
              <p className="mb-3 text-sm text-secondary">
                {capacitor.bancos_capacitores?.nome_banco}
              </p>
              <p className="text-xs text-slate-500 mb-3">
                Cliente: {capacitor.bancos_capacitores?.clientes?.nome}
              </p>
              
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>⚡ Potência:</span>
                  <span className="font-medium">{capacitor.potencia_kvar} kVAr</span>
                </div>
                <div className="flex justify-between">
                  <span>🔋 Tensão:</span>
                  <span className="font-medium">{capacitor.tensao_nominal_v} V</span>
                </div>
                {capacitor.capacitancia_nominal_uf && (
                  <div className="flex justify-between">
                    <span>📏 Capacitância:</span>
                    <span className="font-medium">{capacitor.capacitancia_nominal_uf} µF</span>
                  </div>
                )}
                {capacitor.data_instalacao && (
                  <div className="flex justify-between">
                    <span>📅 Instalação:</span>
                    <span className="font-medium">{new Date(capacitor.data_instalacao).toLocaleDateString('pt-BR')}</span>
                  </div>
                )}
              </div>

              <button 
                onClick={() => router.push(`/medicoes?capacitor_id=${capacitor.id}`)}
                className="mt-5 w-full text-center text-xs text-primary hover:underline"
              >
                Ver medições →
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {filteredCapacitores.length === 0 && !loading && (
        <div className="py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-100">
          <Zap size={48} className="mx-auto mb-3 opacity-50" />
          <p>Nenhum capacitor encontrado</p>
          {bancoFiltro !== 'todos' ? (
            <button 
              onClick={() => handleOpenModal()}
              className="mt-2 text-primary hover:underline"
            >
              + Adicionar capacitor a este banco
            </button>
          ) : (
            <button 
              onClick={() => handleOpenModal()}
              className="mt-2 text-primary hover:underline"
            >
              + Cadastrar primeiro capacitor
            </button>
          )}
        </div>
      )}

      {/* Modal - Formulário */}
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
                  {editingCapacitor ? '✏️ Editar Capacitor' : '➕ Novo Capacitor'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Banco <span className="text-red-500">*</span>
                  </label>
                  <select 
                    required
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                    value={formData.banco_id}
                    onChange={(e) => setFormData({...formData, banco_id: e.target.value})}
                  >
                    <option value="">Selecione um banco</option>
                    {bancos.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.clientes?.nome} - {b.nome_banco}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Código de Identificação <span className="text-red-500">*</span>
                  </label>
                  <input 
                    required
                    type="text" 
                    placeholder="Ex: CAP-001"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                    value={formData.codigo_identificacao}
                    onChange={(e) => setFormData({...formData, codigo_identificacao: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Potência (kVAr) <span className="text-red-500">*</span>
                    </label>
                    <input 
                      required
                      type="number" 
                      step="0.1"
                      placeholder="Ex: 30"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                      value={formData.potencia_kvar}
                      onChange={(e) => setFormData({...formData, potencia_kvar: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Tensão (V) <span className="text-red-500">*</span>
                    </label>
                    <input 
                      required
                      type="number" 
                      placeholder="Ex: 480"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                      value={formData.tensao_nominal_v}
                      onChange={(e) => setFormData({...formData, tensao_nominal_v: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Capacitância (µF)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      placeholder="Ex: 138"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                      value={formData.capacitancia_nominal_uf}
                      onChange={(e) => setFormData({...formData, capacitancia_nominal_uf: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Data de Instalação</label>
                    <input 
                      type="date" 
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                      value={formData.data_instalacao}
                      onChange={(e) => setFormData({...formData, data_instalacao: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Fabricante</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Siemens"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                      value={formData.fabricante}
                      onChange={(e) => setFormData({...formData, fabricante: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Modelo</label>
                    <input 
                      type="text" 
                      placeholder="Ex: MKP-30"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                      value={formData.modelo}
                      onChange={(e) => setFormData({...formData, modelo: e.target.value})}
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
