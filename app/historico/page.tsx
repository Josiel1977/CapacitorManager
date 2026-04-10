'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Trash2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import { cn, getStatusValidacao, calculateCapacitanciaTeoricaDelta } from '@/lib/utils';

export default function HistoricoPage() {
  const [medicoes, setMedicoes] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    cliente_id: '',
    tipo_teste: '',
    status: '',
    search: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const { data: medData, error: medError } = await supabase
        .from('medicoes')
        .select(`
          *,
          clientes(id, nome),
          bancos_capacitores(id, nome_banco),
          capacitores(id, codigo_identificacao, potencia_kvar, capacitancia_nominal_uf, tensao_nominal_v)
        `)
        .order('created_at', { ascending: false });
      
      const { data: cliData } = await supabase
        .from('clientes')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');

      if (medError) throw medError;
      
      // 🔧 RECALCULAR dados inconsistentes (medições antigas com erro)
      const processedData = medData?.map(med => {
        let desvio = med.desvio_percentual;
        let status = med.status_validacao;
        
        // Se o desvio não existe ou está estranho, recalcular
        const precisaRecalcular = desvio === null || desvio === undefined || 
          (status === 'reprovado' && med.corrente_medida_a && med.corrente_teorica_a);
        
        if (precisaRecalcular) {
          if (med.tipo_teste === 'corrente' && med.corrente_teorica_a && med.corrente_teorica_a > 0 && med.corrente_medida_a) {
            // Recalcular corrente
            desvio = ((med.corrente_medida_a - med.corrente_teorica_a) / med.corrente_teorica_a) * 100;
            status = getStatusValidacao(desvio);
            
          } else if (med.tipo_teste === 'capacitancia' && med.capacitancia_medida_uf && med.capacitores?.capacitancia_nominal_uf) {
            // Recalcular capacitância
            const teorico = calculateCapacitanciaTeoricaDelta(med.capacitores.capacitancia_nominal_uf);
            desvio = ((med.capacitancia_medida_uf - teorico) / teorico) * 100;
            status = getStatusValidacao(desvio);
          }
        }
        
        // Determinar valor teórico para exibição
        let teoricoLabel = '---';
        if (med.tipo_teste === 'corrente' && med.corrente_teorica_a) {
          teoricoLabel = `${med.corrente_teorica_a.toFixed(2)} A`;
        } else if (med.tipo_teste === 'capacitancia' && med.capacitores?.capacitancia_nominal_uf) {
          teoricoLabel = `${(med.capacitores.capacitancia_nominal_uf * 1.5).toFixed(2)} µF`;
        }
        
        return { 
          ...med, 
          desvio_percentual: desvio,
          status_validacao: status,
          teoricoLabel
        };
      }) || [];
      
      setMedicoes(processedData);
      setClientes(cliData || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredMedicoes = medicoes.filter(m => {
    const matchCliente = !filters.cliente_id || m.cliente_id === filters.cliente_id;
    const matchTipo = !filters.tipo_teste || m.tipo_teste === filters.tipo_teste;
    const matchStatus = !filters.status || m.status_validacao === filters.status;
    const matchSearch = !filters.search || 
      m.capacitores?.codigo_identificacao?.toLowerCase().includes(filters.search.toLowerCase()) ||
      m.bancos_capacitores?.nome_banco?.toLowerCase().includes(filters.search.toLowerCase());
    
    return matchCliente && matchTipo && matchStatus && matchSearch;
  });

  async function handleDelete(id: string) {
    const result = await Swal.fire({
      title: 'Excluir medição?',
      text: "Esta ação não pode ser desfeita.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e74c3c',
      cancelButtonColor: '#0a2b3c',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase.from('medicoes').delete().eq('id', id);
        if (error) throw error;
        Swal.fire('Excluído!', 'Medição removida com sucesso.', 'success');
        fetchData();
      } catch (error: any) {
        Swal.fire('Erro', error.message, 'error');
      }
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-primary">Histórico de Medições</h1>
        <p className="text-slate-500">Consulte todas as medições realizadas no sistema</p>
      </header>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Cliente</label>
            <select 
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
              value={filters.cliente_id}
              onChange={(e) => setFilters({...filters, cliente_id: e.target.value})}
            >
              <option value="">Todos os Clientes</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Tipo de Teste</label>
            <select 
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
              value={filters.tipo_teste}
              onChange={(e) => setFilters({...filters, tipo_teste: e.target.value})}
            >
              <option value="">Todos</option>
              <option value="corrente">🔁 Corrente</option>
              <option value="capacitancia">📏 Capacitância</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Status</label>
            <select 
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
            >
              <option value="">Todos</option>
              <option value="aprovado">✅ Aprovado</option>
              <option value="atencao">⚠️ Atenção</option>
              <option value="reprovado">❌ Reprovado</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Buscar</label>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Cód. Capacitor ou Banco..."
                className="w-full rounded-lg border border-slate-200 pl-10 pr-3 py-2 text-sm outline-none focus:border-primary"
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-sm font-medium text-slate-500">
              <tr>
                <th className="px-6 py-4">Data/Hora</th>
                <th className="px-6 py-4">Cliente / Banco</th>
                <th className="px-6 py-4">Capacitor</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Teórico</th>
                <th className="px-6 py-4">Medido</th>
                <th className="px-6 py-4">Desvio</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMedicoes.map((med) => (
                <tr key={med.id} className="hover:bg-slate-50 transition-colors text-sm">
                  <td className="px-6 py-4 text-slate-600">
                    {new Date(med.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-primary">{med.clientes?.nome}</div>
                    <div className="text-xs text-slate-500">{med.bancos_capacitores?.nome_banco}</div>
                  </td>
                  <td className="px-6 py-4 font-bold text-primary">
                    {med.capacitores?.codigo_identificacao}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {med.tipo_teste === 'corrente' ? '🔁 Corrente' : '📏 Capacitância'}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {med.teoricoLabel}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-700">
                    {med.tipo_teste === 'corrente' 
                      ? `${med.corrente_medida_a?.toFixed(2)} A` 
                      : `${med.capacitancia_medida_uf?.toFixed(2)} µF`}
                  </td>
                  <td className="px-6 py-4 font-medium">
                    <span className={cn(
                      med.desvio_percentual && med.desvio_percentual > 0 ? "text-red-600" : 
                      med.desvio_percentual && med.desvio_percentual < 0 ? "text-amber-600" : "text-slate-700"
                    )}>
                      {med.desvio_percentual !== null && med.desvio_percentual !== undefined
                        ? `${med.desvio_percentual > 0 ? '+' : ''}${med.desvio_percentual.toFixed(2)}%` 
                        : '---'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={med.status_validacao} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDelete(med.id)}
                      className="rounded p-1.5 text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredMedicoes.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                    Nenhuma medição encontrada
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                    Carregando medições...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    aprovado: { icon: CheckCircle2, color: 'bg-green-50 text-green-700', label: '✅ Aprovado' },
    atencao: { icon: AlertTriangle, color: 'bg-amber-50 text-amber-700', label: '⚠️ Atenção' },
    reprovado: { icon: XCircle, color: 'bg-red-50 text-red-700', label: '❌ Reprovado' },
  };

  const config = configs[status?.toLowerCase()] || configs.atencao;
  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", config.color)}>
      <Icon size={14} />
      {config.label}
    </span>
  );
}