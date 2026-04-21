'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Plus, Search, Edit2, Trash2, X, Save, Database, Filter, ChevronDown, 
  RefreshCw, Calculator, TrendingUp, TrendingDown, AlertTriangle, 
  CheckCircle2, Zap, Eye, ArrowRight, LayoutGrid, List,
  BarChart3, Activity, DollarSign, Clock, Building
} from 'lucide-react';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'motion/react';
import { parseNumber, cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function BancosPage() {
  const router = useRouter();
  const [bancos, setBancos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculando, setCalculando] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<'cards' | 'lista'>('cards');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanco, setEditingBanco] = useState<any>(null);
  const [formData, setFormData] = useState({
    cliente_id: '',
    nome_banco: '',
    localizacao: '',
    tensao_nominal: '',
    potencia_total_kvar: '',
  });
  const [resumoCliente, setResumoCliente] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (clienteFiltro !== 'todos') {
      carregarResumoCliente();
    } else {
      setResumoCliente(null);
    }
  }, [clienteFiltro, bancos]);

  async function carregarResumoCliente() {
    if (clienteFiltro === 'todos') return;
    
    const bancosCliente = bancos.filter(b => b.cliente_id === clienteFiltro);
    const totalKvarInstalado = bancosCliente.reduce((sum, b) => sum + (b.potencia_calculada || 0), 0);
    
    setResumoCliente({
      totalKvarInstalado,
      totalBancos: bancosCliente.length,
      totalPotencia: totalKvarInstalado
    });
  }

  async function fetchData() {
    try {
      setLoading(true);
      
      // Buscar todos os bancos ativos
      const { data: bancosData, error: bancosError } = await supabase
        .from('bancos_capacitores')
        .select(`
          *,
          clientes(id, nome)
        `)
        .eq('ativo', true)
        .order('nome_banco');
      
      if (bancosError) throw bancosError;

      // Buscar todos os capacitores ativos para calcular potência real
      const { data: capacitoresData } = await supabase
        .from('capacitores')
        .select('banco_id, potencia_kvar')
        .eq('ativo', true);

      // Calcular potência total por banco SOMANDO os capacitores
      const potenciaPorBanco: { [key: string]: number } = {};
      capacitoresData?.forEach(cap => {
        if (cap.banco_id) {
          potenciaPorBanco[cap.banco_id] = (potenciaPorBanco[cap.banco_id] || 0) + (cap.potencia_kvar || 0);
        }
      });

      // Atualizar bancos com a potência calculada
      const bancosComPotenciaReal = (bancosData || []).map(banco => ({
        ...banco,
        potencia_calculada: potenciaPorBanco[banco.id] || 0,
        potencia_digitada: banco.potencia_total_kvar || 0,
        potencia_divergente: Math.abs((banco.potencia_total_kvar || 0) - (potenciaPorBanco[banco.id] || 0)) > 1
      }));

      // ATUALIZAR automaticamente os bancos com a potência correta
      for (const banco of bancosComPotenciaReal) {
        if (banco.potencia_divergente && banco.potencia_calculada > 0) {
          await supabase
            .from('bancos_capacitores')
            .update({ potencia_total_kvar: banco.potencia_calculada })
            .eq('id', banco.id);
        }
      }

      setBancos(bancosComPotenciaReal);
      
      // Buscar clientes
      const { data: clientesData } = await supabase
        .from('clientes')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');

      setClientes(clientesData || []);
    } catch (error) {
      console.error('Error:', error);
      Swal.fire('Erro', 'Não foi possível carregar os dados', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function recalcularPotenciaBanco(bancoId: string, bancoNome: string) {
    setCalculando(bancoId);
    try {
      const { data: capacitores, error } = await supabase
        .from('capacitores')
        .select('id, potencia_kvar')
        .eq('banco_id', bancoId)
        .eq('ativo', true);

      if (error) throw error;

      const potenciaTotal = capacitores?.reduce((sum, cap) => sum + (cap.potencia_kvar || 0), 0) || 0;

      const { error: updateError } = await supabase
        .from('bancos_capacitores')
        .update({ potencia_total_kvar: potenciaTotal })
        .eq('id', bancoId);

      if (updateError) throw updateError;

      Swal.fire({
        title: 'Potência Atualizada!',
        html: `
          <div class="text-left">
            <p>Banco: <strong>${bancoNome}</strong></p>
            <p>Potência total calculada: <strong class="text-primary">${potenciaTotal.toFixed(1)} kVAr</strong></p>
            <p class="text-xs text-slate-500 mt-2">Baseado em ${capacitores?.length || 0} capacitor(es) ativo(s)</p>
          </div>
        `,
        icon: 'success',
        timer: 3000,
        confirmButtonColor: '#0a2b3c'
      });

      fetchData();
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    } finally {
      setCalculando(null);
    }
  }

  const filteredBancos = useMemo(() => {
    let filtered = [...bancos];
    if (clienteFiltro !== 'todos') {
      filtered = filtered.filter(b => b.cliente_id === clienteFiltro);
    }
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

  const stats = {
    total: filteredBancos.length,
    totalPotencia: filteredBancos.reduce((acc, b) => acc + (b.potencia_calculada || 0), 0),
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
        potencia_total_kvar: banco.potencia_calculada?.toString() || banco.potencia_total_kvar?.toString() || '',
      });
    } else {
      setEditingBanco(null);
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
        potencia_total_kvar: 0, // Começa com 0, será calculado depois
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

  const clienteSelecionado = clientes.find(c => c.id === clienteFiltro);

  if (loading) {
    return (
      <div className="space-y-8 pb-12">
        <div className="h-64 animate-pulse rounded-3xl bg-slate-100" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-48 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <motion.section 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-primary/80 p-8 text-white shadow-xl md:p-12"
      >
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-secondary/20 p-2">
              <Database size={28} className="text-secondary" />
            </div>
            <span className="text-sm font-medium text-white/80">Gestão de Bancos</span>
          </div>
          <h1 className="mb-4 text-4xl font-bold leading-tight md:text-5xl">
            Bancos de <span className="text-secondary">Capacitores</span>
          </h1>
          <p className="text-lg text-white/80 md:text-xl max-w-2xl">
            Gerencie todos os bancos de capacitores, acompanhe a potência instalada e a eficiência do sistema.
          </p>
        </div>
      </motion.section>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Database size={22} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase">Total de Bancos</span>
          </div>
          <p className="text-3xl font-bold text-primary">{stats.total}</p>
          <p className="text-xs text-slate-400 mt-1">Bancos cadastrados</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Zap size={22} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase">Potência Instalada</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{stats.totalPotencia.toFixed(1)} kVAr</p>
          <p className="text-xs text-slate-400 mt-1">Capacidade total</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <Building size={22} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase">Clientes</span>
          </div>
          <p className="text-3xl font-bold text-green-600">{stats.clientesAtendidos}</p>
          <p className="text-xs text-slate-400 mt-1">Clientes atendidos</p>
        </div>

        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-6 border border-primary/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/20 rounded-lg text-primary">
              <TrendingUp size={22} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase">Eficiência Média</span>
          </div>
          <p className="text-3xl font-bold text-primary">--%</p>
          <p className="text-xs text-slate-400 mt-1">do sistema</p>
        </div>
      </div>

      {/* Resumo do Cliente Selecionado */}
      {resumoCliente && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-2xl p-6 border border-primary/20"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-bold text-primary text-lg">{clienteSelecionado?.nome}</h3>
              <p className="text-sm text-slate-500">Resumo do Cliente</p>
            </div>
            <button
              onClick={() => router.push(`/capacitores?cliente_id=${clienteFiltro}`)}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Eye size={16} />
              Ver todos os capacitores
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            <div className="text-center">
              <p className="text-xs text-slate-500">Bancos</p>
              <p className="text-xl font-bold text-primary">{resumoCliente.totalBancos}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">kVAr Instalado</p>
              <p className="text-xl font-bold text-amber-600">{resumoCliente.totalKvarInstalado.toFixed(1)}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4">
            <label className="mb-1 block text-xs font-medium text-slate-500">Filtrar por Cliente</label>
            <div className="relative">
              <select 
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-4 py-2.5 pr-8 outline-none focus:border-primary"
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

          <div className="lg:col-span-5">
            <label className="mb-1 block text-xs font-medium text-slate-500">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por nome do banco, cliente ou localização..." 
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 outline-none focus:border-primary"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="lg:col-span-3 flex items-end gap-2">
            <div className="flex-1 bg-primary/5 rounded-lg p-2 text-center">
              <p className="text-[10px] text-slate-500">Potência Total</p>
              <p className="text-lg font-bold text-primary">{stats.totalPotencia.toFixed(1)} kVAr</p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('cards')}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  viewMode === 'cards' ? "bg-primary text-white" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                )}
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode('lista')}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  viewMode === 'lista' ? "bg-primary text-white" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                )}
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Botão Novo Banco */}
      <div className="flex justify-end">
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-white font-medium transition-colors hover:bg-primary/90 shadow-md"
        >
          <Plus size={20} />
          Novo Banco de Capacitores
        </button>
      </div>

      {/* Grid/Lista de Bancos */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredBancos.map((banco) => (
            <motion.div 
              key={banco.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="group relative rounded-2xl bg-white p-6 shadow-sm border border-slate-100 transition-all hover:shadow-lg hover:border-primary/20"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-xl bg-primary/10 p-3 text-primary">
                  <Database size={24} />
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => recalcularPotenciaBanco(banco.id, banco.nome_banco)}
                    disabled={calculando === banco.id}
                    className="rounded-lg p-2 text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                    title="Recalcular potência total"
                  >
                    {calculando === banco.id ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Calculator size={16} />
                    )}
                  </button>
                  <button 
                    onClick={() => handleOpenModal(banco)}
                    className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(banco.id)}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50 transition-colors"
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
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="flex items-center gap-1">
                    <Calculator size={12} />
                    Potência:
                  </span>
                  <span className={cn(
                    "font-bold text-lg",
                    banco.potencia_divergente ? "text-amber-600" : "text-primary"
                  )}>
                    {banco.potencia_calculada?.toFixed(1) || 0} kVAr
                  </span>
                </div>
              </div>

              <button 
                onClick={() => router.push(`/capacitores?banco_id=${banco.id}`)}
                className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-primary/10 py-2.5 text-primary font-medium hover:bg-primary/20 transition-colors"
              >
                Ver Capacitores
                <ArrowRight size={16} />
              </button>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-sm font-medium text-slate-500">
                <tr>
                  <th className="px-6 py-4">Banco</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Localização</th>
                  <th className="px-6 py-4">Tensão</th>
                  <th className="px-6 py-4">Potência</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBancos.map((banco) => (
                  <tr key={banco.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-primary">{banco.nome_banco}</td>
                    <td className="px-6 py-4">{banco.clientes?.nome}</td>
                    <td className="px-6 py-4 text-slate-500">{banco.localizacao || '-'}</td>
                    <td className="px-6 py-4">{banco.tensao_nominal || '-'} V</td>
                    <td className="px-6 py-4 font-bold text-primary">{banco.potencia_calculada?.toFixed(1) || 0} kVAr</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => router.push(`/capacitores?banco_id=${banco.id}`)}
                          className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Ver capacitores"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => handleOpenModal(banco)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(banco.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                   </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredBancos.length === 0 && !loading && (
        <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-100">
          <Database size={64} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">Nenhum banco encontrado</p>
          <button 
            onClick={() => handleOpenModal()}
            className="mt-4 text-primary hover:underline"
          >
            + Cadastrar primeiro banco
          </button>
        </div>
      )}

      {/* Modal */}
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
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Potência Total (kVAr)
                    </label>
                    <input 
                      type="number" 
                      placeholder="Calculada automaticamente"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary bg-slate-50"
                      value={formData.potencia_total_kvar}
                      onChange={(e) => setFormData({...formData, potencia_total_kvar: e.target.value})}
                      disabled
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      💡 A potência será calculada automaticamente após adicionar os capacitores
                    </p>
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
