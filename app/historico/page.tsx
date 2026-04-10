'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Trash2, CheckCircle2, AlertTriangle, XCircle, TrendingUp, TrendingDown, BarChart3, Activity } from 'lucide-react';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

// Funções de cálculo
function calcularCorrenteTeorica(potenciaKvar: number, tensaoNominal: number): number {
    if (!tensaoNominal || tensaoNominal === 0) return 0;
    return (potenciaKvar * 1000) / (Math.sqrt(3) * tensaoNominal);
}

function calcularCapacitanciaTeoricaDelta(capacitanciaNominalFase: number): number {
    return capacitanciaNominalFase * 1.5;
}

function getStatusValidacao(desvio: number): string {
    if (desvio >= -5 && desvio <= 10) return 'aprovado';
    if (desvio >= -10 && desvio < -5) return 'atencao';
    if (desvio > 10 && desvio <= 15) return 'atencao';
    return 'reprovado';
}

// Função para calcular tendência de degradação
function calcularTendencia(medicoes: any[]) {
    if (medicoes.length < 2) return null;
    
    const primeira = medicoes[medicoes.length - 1];
    const ultima = medicoes[0];
    
    const variacao = ultima.desvio_percentual - primeira.desvio_percentual;
    const dias = (new Date(ultima.created_at).getTime() - new Date(primeira.created_at).getTime()) / (1000 * 3600 * 24);
    const degradacaoPorMes = dias > 0 ? (variacao / dias) * 30 : 0;
    
    let previsao = null;
    if (degradacaoPorMes > 0 && ultima.desvio_percentual < 15) {
        const mesesRestantes = (15 - ultima.desvio_percentual) / degradacaoPorMes;
        previsao = {
            meses: mesesRestantes.toFixed(1),
            data: new Date(Date.now() + mesesRestantes * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')
        };
    }
    
    return {
        variacao: variacao.toFixed(2),
        degradacaoPorMes: degradacaoPorMes.toFixed(2),
        tendencia: variacao > 0 ? 'piorando' : variacao < 0 ? 'melhorando' : 'estavel',
        primeiraData: new Date(primeira.created_at).toLocaleDateString('pt-BR'),
        ultimaData: new Date(ultima.created_at).toLocaleDateString('pt-BR'),
        primeiraDesvio: primeira.desvio_percentual?.toFixed(2) || '0',
        ultimaDesvio: ultima.desvio_percentual?.toFixed(2) || '0',
        previsao
    };
}

export default function HistoricoPage() {
  const [medicoes, setMedicoes] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    cliente_id: '',
    tipo_teste: '',
    status: '',
    search: '',
    periodo: 'todos'
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
      
      const processedData = medData?.map(med => {
        let desvio = med.desvio_percentual;
        let status = med.status_validacao;
        let teoricoLabel = '---';
        let tensaoExibicao = null;
        
        if (med.capacitores) {
          const tensaoNominal = med.capacitores.tensao_nominal_v;
          tensaoExibicao = tensaoNominal;
          
          if (med.tipo_teste === 'corrente') {
            const correnteTeorica = calcularCorrenteTeorica(med.capacitores.potencia_kvar, tensaoNominal);
            teoricoLabel = `${correnteTeorica.toFixed(2)} A @ ${tensaoNominal}V`;
            
            if (med.corrente_medida_a && correnteTeorica > 0) {
              desvio = ((med.corrente_medida_a - correnteTeorica) / correnteTeorica) * 100;
              status = getStatusValidacao(desvio);
            }
          } else if (med.tipo_teste === 'capacitancia') {
            const capacitanciaTeorica = calcularCapacitanciaTeoricaDelta(med.capacitores.capacitancia_nominal_uf);
            teoricoLabel = `${capacitanciaTeorica.toFixed(2)} µF (Δ) @ ${tensaoNominal}V`;
            
            if (med.capacitancia_medida_uf && capacitanciaTeorica > 0) {
              desvio = ((med.capacitancia_medida_uf - capacitanciaTeorica) / capacitanciaTeorica) * 100;
              status = getStatusValidacao(desvio);
            }
          }
        }
        
        return { 
          ...med, 
          desvio_percentual: desvio,
          status_validacao: status,
          teoricoLabel,
          tensaoNominal: tensaoExibicao
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

  const getDataLimite = () => {
    const hoje = new Date();
    switch (filters.periodo) {
      case '30dias': return new Date(hoje.setDate(hoje.getDate() - 30));
      case '60dias': return new Date(hoje.setDate(hoje.getDate() - 60));
      case '90dias': return new Date(hoje.setDate(hoje.getDate() - 90));
      default: return null;
    }
  };

  const filteredMedicoes = medicoes.filter(m => {
    const matchCliente = !filters.cliente_id || m.cliente_id === filters.cliente_id;
    const matchTipo = !filters.tipo_teste || m.tipo_teste === filters.tipo_teste;
    const matchStatus = !filters.status || m.status_validacao === filters.status;
    const matchSearch = !filters.search || 
      m.capacitores?.codigo_identificacao?.toLowerCase().includes(filters.search.toLowerCase()) ||
      m.bancos_capacitores?.nome_banco?.toLowerCase().includes(filters.search.toLowerCase());
    
    const dataLimite = getDataLimite();
    const matchPeriodo = !dataLimite || new Date(m.created_at) >= dataLimite;
    
    return matchCliente && matchTipo && matchStatus && matchSearch && matchPeriodo;
  });

  const medicoesPorCapacitor = filteredMedicoes.reduce((acc: any, med) => {
    const key = `${med.capacitores?.codigo_identificacao}_${med.capacitores?.id}`;
    if (!acc[key]) {
      acc[key] = {
        nome: med.capacitores?.codigo_identificacao,
        id: med.capacitores?.id,
        medicoes: []
      };
    }
    acc[key].medicoes.push(med);
    return acc;
  }, {});

  Object.keys(medicoesPorCapacitor).forEach(key => {
    medicoesPorCapacitor[key].medicoes.sort((a: any, b: any) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  });

  function handleAnalisarCapacitor(capacitorNome: string, capacitorMedicoes: any[]) {
    if (capacitorMedicoes.length < 2) {
        Swal.fire('Atenção', 'São necessárias pelo menos 2 medições para análise de tendência', 'info');
        return;
    }
    
    const tendencia = calcularTendencia(capacitorMedicoes);
    
    // 🔧 VERIFICAÇÃO IMPORTANTE: se tendencia for null, não prossegue
    if (!tendencia) {
        Swal.fire('Erro', 'Não foi possível calcular a tendência', 'error');
        return;
    }
    
    Swal.fire({
        title: `📊 Análise de Tendência - ${capacitorNome}`,
        html: `
            <div style="text-align: left;">
                <p><strong>📅 Período analisado:</strong> ${tendencia.primeiraData} a ${tendencia.ultimaData}</p>
                <p><strong>📉 Desvio inicial:</strong> ${tendencia.primeiraDesvio}%</p>
                <p><strong>📈 Desvio atual:</strong> ${tendencia.ultimaDesvio}%</p>
                <p><strong>🔄 Variação total:</strong> <span style="color: ${parseFloat(tendencia.variacao) > 0 ? '#e74c3c' : '#2ecc71'}; font-weight: bold;">${parseFloat(tendencia.variacao) > 0 ? '+' : ''}${tendencia.variacao}%</span></p>
                <p><strong>📊 Tendência:</strong> ${tendencia.tendencia === 'piorando' ? '⚠️ Degradação detectada' : tendencia.tendencia === 'melhorando' ? '✅ Melhorando' : '➡️ Estável'}</p>
                <p><strong>⚡ Degradação por mês:</strong> ${tendencia.degradacaoPorMes}%</p>
                ${tendencia.previsao ? `
                    <hr style="margin: 15px 0;">
                    <p><strong>🔮 PREVISÃO:</strong></p>
                    <p>⚠️ Previsão de substituição em aproximadamente <strong>${tendencia.previsao.meses} meses</strong></p>
                    <p>📅 Data estimada: <strong>${tendencia.previsao.data}</strong></p>
                ` : '<p>✅ Capacitor dentro da faixa normal de operação</p>'}
            </div>
        `,
        icon: tendencia.tendencia === 'piorando' ? 'warning' : 'success',
        confirmButtonText: 'Fechar'
    });
  }

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
        <p className="text-slate-500">Consulte, compare e analise a evolução dos capacitores</p>
      </header>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div>
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
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Tipo</label>
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
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Período</label>
            <select 
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
              value={filters.periodo}
              onChange={(e) => setFilters({...filters, periodo: e.target.value})}
            >
              <option value="todos">📅 Todos</option>
              <option value="30dias">📆 30 dias</option>
              <option value="60dias">📆 60 dias</option>
              <option value="90dias">📆 90 dias</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Buscar</label>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Cód. Capacitor..."
                className="w-full rounded-lg border border-slate-200 pl-10 pr-3 py-2 text-sm outline-none focus:border-primary"
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={20} className="text-secondary" />
          <h2 className="text-lg font-bold text-primary">Análise por Capacitor</h2>
          <span className="text-xs text-slate-400">Clique em "Analisar" para ver tendência e previsão</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-sm font-medium text-slate-500">
              <tr>
                <th className="px-4 py-3">Capacitor</th>
                <th className="px-4 py-3">Banco</th>
                <th className="px-4 py-3">Medições</th>
                <th className="px-4 py-3">1ª Medição</th>
                <th className="px-4 py-3">Última</th>
                <th className="px-4 py-3">Variação</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(medicoesPorCapacitor).map(([key, data]: [string, any]) => {
                const medicoes = data.medicoes;
                const primeira = medicoes[medicoes.length - 1];
                const ultima = medicoes[0];
                const variacao = ultima.desvio_percentual - primeira.desvio_percentual;
                
                return (
                  <tr key={key} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-primary">{data.nome}</td>
                    <td className="px-4 py-3 text-slate-600">{ultima.bancos_capacitores?.nome_banco || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-medium">
                        {medicoes.length} medições
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(primeira.created_at).toLocaleDateString('pt-BR')}<br/>
                      <span className="font-medium">{primeira.desvio_percentual?.toFixed(2)}%</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(ultima.created_at).toLocaleDateString('pt-BR')}<br/>
                      <span className="font-medium">{ultima.desvio_percentual?.toFixed(2)}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {variacao > 0 ? <TrendingUp size={14} className="text-red-500" /> : variacao < 0 ? <TrendingDown size={14} className="text-green-500" /> : <Activity size={14} className="text-slate-400" />}
                        <span className={variacao > 0 ? 'text-red-600' : variacao < 0 ? 'text-green-600' : 'text-slate-600'}>
                          {variacao > 0 ? '+' : ''}{variacao.toFixed(2)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        onClick={() => handleAnalisarCapacitor(data.nome, medicoes)}
                        className="bg-secondary/10 text-secondary hover:bg-secondary/20 px-3 py-1 rounded-full text-xs font-medium transition-colors"
                      >
                        🔍 Analisar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
                  <td className="px-6 py-4">
                    <div className="font-bold text-primary">{med.capacitores?.codigo_identificacao}</div>
                    {med.tensaoNominal && (
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full mt-1 inline-block">
                        ⚡ {med.tensaoNominal}V
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {med.tipo_teste === 'corrente' ? '🔁 Corrente' : '📏 Capacitância'}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {med.teoricoLabel}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-700">
                    {med.tipo_teste === 'corrente' 
                      ? `${med.corrente_medida_a?.toFixed(2)} A` 
                      : `${med.capacitancia_medida_uf?.toFixed(2)} µF`}
                  </td>
                  <td className="px-6 py-4 font-medium">
                    <span className={cn(
                      med.desvio_percentual && med.desvio_percentual > 0 ? "text-red-600 font-bold" : 
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