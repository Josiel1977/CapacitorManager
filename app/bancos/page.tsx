'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  Plus, Search, Edit2, Trash2, X, Save, LayoutGrid, List,
  Database, ChevronDown, RefreshCw, Calculator, Eye, ArrowRight,
  Building, Zap, TrendingUp, Cpu
} from 'lucide-react';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export default function BancosPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [bancos, setBancos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
    potencia_trafo_kva: '', // Adicionado campo de potência do trafo em kVA
    potencia_total_kvar: '',
  });
  const [eficienciaMedia, setEficienciaMedia] = useState<number | null>(null);

  // Redireciona se não autenticado
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Obtém tenant_id do perfil
  useEffect(() => {
    const fetchTenant = async () => {
      if (!user) return;
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      if (error || !profile?.tenant_id) {
        console.error('Perfil sem tenant', error);
        Swal.fire('Erro', 'Perfil não configurado. Contate o suporte.', 'error');
        return;
      }
      setTenantId(profile.tenant_id);
    };
    if (isAuthenticated) fetchTenant();
  }, [user, isAuthenticated]);

  // Carrega dados do tenant
  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      // Buscar bancos do tenant (certifique-se de que a coluna potencia_trafo_kva existe na tabela bancos_capacitores do Supabase)
      const { data: bancosData, error: bancosError } = await supabase
        .from('bancos_capacitores')
        .select('*, clientes(id, nome)')
        .eq('tenant_id', tenantId)
        .eq('ativo', true)
        .order('nome_banco');
      if (bancosError) throw bancosError;
      setBancos(bancosData || []);

      // Buscar clientes do tenant (para os dropdowns)
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome')
        .eq('tenant_id', tenantId)
        .eq('ativo', true)
        .order('nome');
      if (clientesError) throw clientesError;
      setClientes(clientesData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      Swal.fire('Erro', 'Não foi possível carregar os dados.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) fetchData();
  }, [tenantId]);

  // Recalcular eficiência média quando dados ou filtro mudarem
  const calcularEficienciaMedia = async () => {
    if (!tenantId) return;
    try {
      let query = supabase
        .from('capacitores')
        .select('potencia_kvar, banco_id, medicoes(desvio_percentual, status_validacao, created_at)')
        .eq('ativo', true);

      // Se houver filtro de cliente, restringe aos bancos desse cliente
      if (clienteFiltro !== 'todos') {
        const { data: bancosDoCliente } = await supabase
          .from('bancos_capacitores')
          .select('id')
          .eq('cliente_id', clienteFiltro)
          .eq('tenant_id', tenantId)
          .eq('ativo', true);
        const bancosIds = bancosDoCliente?.map(b => b.id) || [];
        if (bancosIds.length > 0) query = query.in('banco_id', bancosIds);
        else { setEficienciaMedia(null); return; }
      }

      const { data: capacitores } = await query;
      if (!capacitores || capacitores.length === 0) {
        setEficienciaMedia(null);
        return;
      }

      let totalPotenciaNominal = 0, totalPotenciaEfetiva = 0;
      for (const cap of capacitores) {
        const potenciaNominal = cap.potencia_kvar || 0;
        totalPotenciaNominal += potenciaNominal;

        const medicoes = cap.medicoes || [];
        if (medicoes.length === 0) {
          totalPotenciaEfetiva += potenciaNominal;
          continue;
        }
        const ultima = medicoes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        let fator = 1;
        if (ultima.status_validacao === 'atencao') fator = 0.7;
        else if (ultima.status_validacao === 'reprovado') fator = 0;
        totalPotenciaEfetiva += potenciaNominal * fator;
      }
      const eficiencia = totalPotenciaNominal > 0 ? (totalPotenciaEfetiva / totalPotenciaNominal) * 100 : 0;
      setEficienciaMedia(eficiencia);
    } catch (error) {
      console.error('Erro ao calcular eficiência:', error);
      setEficienciaMedia(null);
    }
  };

  useEffect(() => {
    calcularEficienciaMedia();
  }, [bancos, clienteFiltro]);

  // Filtros
  const filteredBancos = useMemo(() => {
    let filtered = [...bancos];
    if (clienteFiltro !== 'todos') {
      filtered = filtered.filter(b => b.cliente_id === clienteFiltro);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(b =>
        b.nome_banco?.toLowerCase().includes(term) ||
        b.localizacao?.toLowerCase().includes(term) ||
        b.clientes?.nome?.toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [bancos, clienteFiltro, searchTerm]);

  const stats = {
    total: filteredBancos.length,
    totalPotencia: filteredBancos.reduce((acc, b) => acc + (b.potencia_calculada || b.potencia_total_kvar || 0), 0),
    clientesAtendidos: new Set(filteredBancos.map(b => b.cliente_id)).size,
  };

  // Handlers do modal
  function handleOpenModal(banco: any = null) {
    if (banco) {
      setEditingBanco(banco);
      setFormData({
        cliente_id: banco.cliente_id || '',
        nome_banco: banco.nome_banco || '',
        localizacao: banco.localizacao || '',
        tensao_nominal: banco.tensao_nominal?.toString() || '',
        potencia_trafo_kva: banco.potencia_trafo_kva?.toString() || '', // Carrega potência do trafo
        potencia_total_kvar: banco.potencia_total_kvar?.toString() || '',
      });
    } else {
      setEditingBanco(null);
      setFormData({
        cliente_id: clienteFiltro !== 'todos' ? clienteFiltro : '',
        nome_banco: '',
        localizacao: '',
        tensao_nominal: '',
        potencia_trafo_kva: '',
        potencia_total_kvar: '',
      });
    }
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    if (!formData.cliente_id) {
      Swal.fire('Atenção', 'Selecione um cliente', 'warning');
      return;
    }

    const dataToSave = {
      cliente_id: formData.cliente_id,
      nome_banco: formData.nome_banco,
      localizacao: formData.localizacao || null,
      tensao_nominal: formData.tensao_nominal ? parseFloat(formData.tensao_nominal) : null,
      potencia_trafo_kva: formData.potencia_trafo_kva ? parseFloat(formData.potencia_trafo_kva) : null, // Salva potência do trafo
      potencia_total_kvar: 0, // mantido ou recalculado por trigger/função
      tenant_id: tenantId,
      ativo: true,
    };

    try {
      if (editingBanco) {
        const { error } = await supabase
          .from('bancos_capacitores')
          .update(dataToSave)
          .eq('id', editingBanco.id);
        if (error) throw error;
        Swal.fire('Sucesso', 'Banco atualizado!', 'success');
      } else {
        const { error } = await supabase
          .from('bancos_capacitores')
          .insert([dataToSave]);
        if (error) throw error;
        Swal.fire('Sucesso', 'Banco cadastrado!', 'success');
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
      text: "O banco será desativado.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0a2b3c',
      confirmButtonText: 'Sim, excluir!',
    });
    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from('bancos_capacitores')
          .update({ ativo: false })
          .eq('id', id);
        if (error) throw error;
        Swal.fire('Excluído!', 'Banco removido.', 'success');
        fetchData();
      } catch (error: any) {
        Swal.fire('Erro', error.message, 'error');
      }
    }
  }

  if (authLoading || loading) {
    return <div className="flex justify-center items-center h-64">Carregando...</div>;
  }
  if (!isAuthenticated) return null;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <motion.section
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-primary/80 p-8 text-white shadow-xl md:p-12"
      >
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />
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
            Gerencie todos os bancos de capacitores, acompanhe a potência do transformador vinculado e a eficiência do sistema.
          </p>
        </div>
      </motion.section>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary"><Database size={22} /></div>
            <span className="text-xs font-medium text-slate-500 uppercase">Total de Bancos</span>
          </div>
          <p className="text-3xl font-bold text-primary">{stats.total}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Zap size={22} /></div>
            <span className="text-xs font-medium text-slate-500 uppercase">Potência Instalada</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{stats.totalPotencia.toFixed(1)} kVAr</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-50 rounded-lg text-green-600"><Building size={22} /></div>
            <span className="text-xs font-medium text-slate-500 uppercase">Clientes</span>
          </div>
          <p className="text-3xl font-bold text-green-600">{stats.clientesAtendidos}</p>
        </div>
        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-6 border border-primary/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/20 rounded-lg text-primary"><TrendingUp size={22} /></div>
            <span className="text-xs font-medium text-slate-500 uppercase">Eficiência Média</span>
          </div>
          <p className="text-3xl font-bold text-primary">
            {eficienciaMedia !== null ? `${eficienciaMedia.toFixed(1)}%` : '--%'}
          </p>
        </div>
      </div>

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
              <button onClick={() => setViewMode('cards')} className={cn("p-2 rounded-lg transition-colors", viewMode === 'cards' ? "bg-primary text-white" : "bg-slate-100 text-slate-400")}>
                <LayoutGrid size={18} />
              </button>
              <button onClick={() => setViewMode('lista')} className={cn("p-2 rounded-lg transition-colors", viewMode === 'lista' ? "bg-primary text-white" : "bg-slate-100 text-slate-400")}>
                <List size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Botão Novo Banco */}
      <div className="flex justify-end">
        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-white font-medium hover:bg-primary/90">
          <Plus size={20} /> Novo Banco de Capacitores
        </button>
      </div>

      {/* Conteúdo (cards ou lista) */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBancos.map((banco) => (
            <motion.div key={banco.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="group rounded-2xl bg-white p-6 shadow-sm border border-slate-100 hover:shadow-lg">
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-xl bg-primary/10 p-3 text-primary"><Database size={24} /></div>
                <div className="flex gap-1">
                  <button onClick={() => handleOpenModal(banco)} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(banco.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-primary">{banco.nome_banco}</h3>
              <p className="mb-4 text-sm font-medium text-secondary">{banco.clientes?.nome}</p>
              <div className="space-y-2 text-sm text-slate-600">
                {banco.localizacao && <div className="flex justify-between"><span>📍 Localização:</span><span className="font-medium">{banco.localizacao}</span></div>}
                {banco.tensao_nominal && <div className="flex justify-between"><span>⚡ Tensão Nominal:</span><span className="font-medium">{banco.tensao_nominal} V</span></div>}
                {banco.potencia_trafo_kva && <div className="flex justify-between"><span>🔌 Potência do Trafo:</span><span className="font-medium text-amber-600">{banco.potencia_trafo_kva} kVA</span></div>}
                <div className="flex justify-between pt-2 border-t"><span>Potência Bancos:</span><span className="font-bold text-lg text-primary">{banco.potencia_total_kvar?.toFixed(1) || 0} kVAr</span></div>
              </div>
              <button onClick={() => router.push(`/capacitores?banco_id=${banco.id}`)} className="mt-5 w-full rounded-xl bg-primary/10 py-2.5 text-primary font-medium hover:bg-primary/20">Ver Capacitores <ArrowRight size={16} className="inline" /></button>
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
                  <th className="px-6 py-4">Potência Trafo</th>
                  <th className="px-6 py-4">Potência kVAr</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBancos.map((banco) => (
                  <tr key={banco.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold text-primary">{banco.nome_banco}</td>
                    <td className="px-6 py-4">{banco.clientes?.nome}</td>
                    <td className="px-6 py-4 text-slate-500">{banco.localizacao || '-'}</td>
                    <td className="px-6 py-4">{banco.tensao_nominal ? `${banco.tensao_nominal} V` : '-'}</td>
                    <td className="px-6 py-4 font-semibold text-amber-600">{banco.potencia_trafo_kva ? `${banco.potencia_trafo_kva} kVA` : '-'}</td>
                    <td className="px-6 py-4 font-bold text-primary">{banco.potencia_total_kvar?.toFixed(1) || 0} kVAr</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => router.push(`/capacitores?banco_id=${banco.id}`)} className="p-1.5 text-primary hover:bg-primary/10 rounded-lg"><Eye size={18} /></button>
                        <button onClick={() => handleOpenModal(banco)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(banco.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
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
          <p>Nenhum banco encontrado</p>
          <button onClick={() => handleOpenModal()} className="mt-4 text-primary hover:underline">+ Cadastrar primeiro banco</button>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
              <div className="mb-6 flex justify-between items-center">
                <h2 className="text-xl font-bold text-primary">{editingBanco ? '✏️ Editar Banco' : '➕ Novo Banco'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
                  <select required className="w-full rounded-lg border border-slate-200 px-4 py-2" value={formData.cliente_id} onChange={(e) => setFormData({...formData, cliente_id: e.target.value})}>
                    <option value="">Selecione um cliente</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Banco *</label>
                  <input required type="text" placeholder="Ex: QGBT Principal ou Trafo 01" className="w-full rounded-lg border border-slate-200 px-4 py-2" value={formData.nome_banco} onChange={(e) => setFormData({...formData, nome_banco: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Localização</label>
                  <input type="text" placeholder="Ex: Barracão de Produção" className="w-full rounded-lg border border-slate-200 px-4 py-2" value={formData.localizacao} onChange={(e) => setFormData({...formData, localizacao: e.target.value})} />
                </div>
                
                {/* Linha com Tensão e Potência do Trafo */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tensão Nominal (V)</label>
                    <input type="number" placeholder="Ex: 380" className="w-full rounded-lg border border-slate-200 px-4 py-2" value={formData.tensao_nominal} onChange={(e) => setFormData({...formData, tensao_nominal: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Potência do Trafo (kVA)</label>
                    <input type="number" placeholder="Ex: 500" className="w-full rounded-lg border border-slate-200 px-4 py-2" value={formData.potencia_trafo_kva} onChange={(e) => setFormData({...formData, potencia_trafo_kva: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Potência Total (kVAr)</label>
                  <input type="number" className="w-full rounded-lg border border-slate-200 px-4 py-2 bg-slate-50" value={formData.potencia_total_kvar} disabled />
                  <p className="text-[10px] text-slate-400 mt-1">Calculada automaticamente pelos capacitores cadastrados</p>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-lg text-slate-600 hover:bg-slate-100">Cancelar</button>
                  <button type="submit" className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90"><Save size={18} /> Salvar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
