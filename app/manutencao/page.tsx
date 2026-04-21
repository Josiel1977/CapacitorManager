'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  Wrench, TrendingUp, TrendingDown, Activity, AlertTriangle, 
  CheckCircle2, XCircle, Calendar, Clock, Zap, Droplets,
  DollarSign, RefreshCw, Eye, FileText, Download, Shield, Filter
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

// ============================================
// FUNÇÕES DE CÁLCULO (MESMAS DO RELATÓRIO)
// ============================================
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

// Função para calcular tendência de degradação (MESMA DO RELATÓRIO)
function calcularTendenciaCapacitor(medicoes: any[]) {
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

interface CapacitorManutencao {
  id: string;
  codigo: string;
  banco: string;
  cliente: string;
  cliente_id: string;
  potencia_kvar: number;
  tensao_nominal_v: number;
  capacitancia_nominal_uf: number;
  ultimo_desvio: number;
  ultimo_status: string;
  ultima_data: string;
  tendencia: 'piorando' | 'melhorando' | 'estavel';
  previsao_meses: string | null;
  previsao_data: string | null;
  medicoes_count: number;
  variacao: string;
}

export default function ManutencaoPage() {
  const [capacitores, setCapacitores] = useState<CapacitorManutencao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'urgente' | 'atencao'>('todos');
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteFiltro, setClienteFiltro] = useState<string>('todos');

  useEffect(() => {
    fetchClientes();
    fetchDadosManutencao();
  }, []);

  async function fetchClientes() {
    try {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      setClientes(data || []);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    }
  }

  async function fetchDadosManutencao() {
    setLoading(true);
    try {
      // Buscar todas as medições com dados relacionados
      const { data: medicoesData, error } = await supabase
        .from('medicoes')
        .select(`
          *,
          bancos_capacitores (
            id,
            nome_banco,
            cliente_id,
            clientes (id, nome)
          ),
          capacitores (
            id,
            codigo_identificacao,
            potencia_kvar,
            capacitancia_nominal_uf,
            tensao_nominal_v
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!medicoesData || medicoesData.length === 0) {
        setCapacitores([]);
        setLoading(false);
        return;
      }

      // Recalcular desvios usando as mesmas funções do relatório
      const medicoesCorrigidas = medicoesData.map(med => {
        let desvio = med.desvio_percentual;
        let status = med.status_validacao;
        
        if (med.capacitores) {
          const tensaoNominal = med.capacitores.tensao_nominal_v;
          
          if (med.tipo_teste === 'corrente' && med.corrente_medida_a) {
            const correnteTeorica = calcularCorrenteTeorica(med.capacitores.potencia_kvar, tensaoNominal);
            if (correnteTeorica > 0) {
              desvio = ((med.corrente_medida_a - correnteTeorica) / correnteTeorica) * 100;
              status = getStatusValidacao(desvio);
            }
          } else if (med.tipo_teste === 'capacitancia' && med.capacitancia_medida_uf) {
            const capacitanciaTeorica = calcularCapacitanciaTeoricaDelta(med.capacitores.capacitancia_nominal_uf);
            if (capacitanciaTeorica > 0) {
              desvio = ((med.capacitancia_medida_uf - capacitanciaTeorica) / capacitanciaTeorica) * 100;
              status = getStatusValidacao(desvio);
            }
          }
        }
        
        return {
          ...med,
          desvio_percentual: desvio,
          status_validacao: status
        };
      });

      // Agrupar por capacitor
      const gruposPorCapacitor: { [key: string]: any[] } = {};
      medicoesCorrigidas.forEach(med => {
        const key = med.capacitores?.id;
        if (!key) return;
        if (!gruposPorCapacitor[key]) {
          gruposPorCapacitor[key] = [];
        }
        gruposPorCapacitor[key].push(med);
      });

      // Ordenar medições por data (mais antiga primeiro para tendência)
      Object.keys(gruposPorCapacitor).forEach(key => {
        gruposPorCapacitor[key].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });

      const processedData: CapacitorManutencao[] = [];

      for (const [capId, medicoes] of Object.entries(gruposPorCapacitor)) {
        if (medicoes.length === 0) continue;

        const ultimaMedicao = medicoes[medicoes.length - 1];
        const primeiraMedicao = medicoes[0];
        const capacitor = ultimaMedicao.capacitores;
        
        if (!capacitor) continue;

        const desvio = Math.abs(ultimaMedicao.desvio_percentual || 0);
        
        // Determinar status (mesmo do relatório)
        let status = 'ok';
        if (desvio > 15) status = 'critical';
        else if (desvio > 10) status = 'warning';
        
        // Calcular tendência usando a mesma função do relatório
        const tendenciaData = calcularTendenciaCapacitor(medicoes);
        
        const clienteNome = ultimaMedicao.bancos_capacitores?.clientes?.nome || 'N/A';
        const clienteId = ultimaMedicao.bancos_capacitores?.cliente_id;
        const bancoNome = ultimaMedicao.bancos_capacitores?.nome_banco || 'N/A';
        
        // Aplicar filtro por cliente
        if (clienteFiltro !== 'todos' && clienteId !== clienteFiltro) {
          continue;
        }

        processedData.push({
          id: capId,
          codigo: capacitor.codigo_identificacao || 'N/A',
          banco: bancoNome,
          cliente: clienteNome,
          cliente_id: clienteId || '',
          potencia_kvar: capacitor.potencia_kvar || 0,
          tensao_nominal_v: capacitor.tensao_nominal_v || 0,
          capacitancia_nominal_uf: capacitor.capacitancia_nominal_uf || 0,
          ultimo_desvio: ultimaMedicao.desvio_percentual || 0,
          ultimo_status: status,
          ultima_data: ultimaMedicao.created_at,
          tendencia: (tendenciaData?.tendencia as 'piorando' | 'melhorando' | 'estavel') || 'estavel',
          previsao_meses: tendenciaData?.previsao?.meses || null,
          previsao_data: tendenciaData?.previsao?.data || null,
          medicoes_count: medicoes.length,
          variacao: tendenciaData?.variacao || '0'
        });
      }

      setCapacitores(processedData);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      Swal.fire({
        title: 'Erro',
        text: 'Não foi possível carregar os dados. Verifique sua conexão.',
        icon: 'error',
        confirmButtonColor: '#0a2b3c'
      });
    } finally {
      setLoading(false);
    }
  }

  // Recarregar quando o filtro de cliente mudar
  useEffect(() => {
    fetchDadosManutencao();
  }, [clienteFiltro]);

  // Filtrar capacitores
  const filteredCapacitores = capacitores.filter(cap => {
    if (filter === 'urgente') return cap.previsao_meses !== null && parseFloat(cap.previsao_meses) <= 3;
    if (filter === 'atencao') return cap.ultimo_status === 'warning';
    return true;
  });

  const urgentes = capacitores.filter(c => c.previsao_meses !== null && parseFloat(c.previsao_meses) <= 3).length;
  const atencao = capacitores.filter(c => c.ultimo_status === 'warning').length;
  const saudaveis = capacitores.filter(c => c.ultimo_status === 'ok' && (c.previsao_meses === null || parseFloat(c.previsao_meses) > 3)).length;

  function handleGerarRelatorio() {
    Swal.fire({
      title: 'Relatório de Manutenção',
      html: `
        <div class="text-left">
          <p><strong>📊 Resumo:</strong></p>
          <ul class="list-disc pl-5 mb-3">
            <li>🔴 Críticos: ${urgentes}</li>
            <li>🟡 Atenção: ${atencao}</li>
            <li>🟢 Saudáveis: ${saudaveis}</li>
          </ul>
          <p><strong>💰 Estimativa de Investimento:</strong></p>
          <p>R$ ${urgentes * 250} em substituições urgentes</p>
          <hr class="my-3">
          <p class="text-xs text-slate-500">Relatório gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      `,
      icon: 'info',
      confirmButtonColor: '#0a2b3c'
    });
  }

  if (loading) {
    return (
      <div className="space-y-8 pb-12">
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
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
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-secondary/20 p-2">
              <Wrench size={24} className="text-secondary" />
            </div>
            <span className="text-sm font-medium text-white/80">Manutenção Preditiva</span>
          </div>
          <h1 className="mb-4 text-4xl font-bold leading-tight md:text-5xl">
            Análise de <span className="text-secondary">Capacitores</span>
          </h1>
          <p className="text-lg text-white/80 md:text-xl max-w-2xl">
            Acompanhe a saúde dos seus capacitores e planeje substituições antes da falha.
          </p>
        </div>
      </motion.section>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Filtrar por Cliente</label>
          <select 
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 outline-none focus:border-primary"
            value={clienteFiltro}
            onChange={(e) => setClienteFiltro(e.target.value)}
          >
            <option value="todos">📋 Todos os clientes</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>🏢 {c.nome}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 items-end">
          <button
            onClick={() => setFilter('todos')}
            className={cn(
              "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              filter === 'todos' ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            Todos ({capacitores.length})
          </button>
          <button
            onClick={() => setFilter('urgente')}
            className={cn(
              "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              filter === 'urgente' ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            Urgentes ({urgentes})
          </button>
          <button
            onClick={() => setFilter('atencao')}
            className={cn(
              "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              filter === 'atencao' ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            Atenção ({atencao})
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <AlertTriangle size={22} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase">Críticos</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{urgentes}</p>
          <p className="text-xs text-red-500 mt-1">Substituir nos próximos 3 meses</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Activity size={22} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase">Atenção</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{atencao}</p>
          <p className="text-xs text-amber-500 mt-1">Monitorar mensalmente</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <CheckCircle2 size={22} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase">Saudáveis</span>
          </div>
          <p className="text-3xl font-bold text-green-600">{saudaveis}</p>
          <p className="text-xs text-green-500 mt-1">Dentro da especificação</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Droplets size={22} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase">Total</span>
          </div>
          <p className="text-3xl font-bold text-primary">{capacitores.length}</p>
          <p className="text-xs text-slate-400 mt-1">Capacitores monitorados</p>
        </div>
      </div>

      {/* Ações */}
      <div className="flex justify-end gap-2">
        <button
          onClick={fetchDadosManutencao}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
        <button
          onClick={handleGerarRelatorio}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90"
        >
          <FileText size={16} />
          Relatório
        </button>
      </div>

      {/* Tabela de Capacitores */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-sm font-medium text-slate-500">
              <tr>
                <th className="px-5 py-4">Código</th>
                <th className="px-5 py-4">Cliente / Banco</th>
                <th className="px-5 py-4">Potência</th>
                <th className="px-5 py-4">Última Medição</th>
                <th className="px-5 py-4">Desvio</th>
                <th className="px-5 py-4">Tendência</th>
                <th className="px-5 py-4">Previsão</th>
                <th className="px-5 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCapacitores.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <Wrench size={32} className="mx-auto mb-2 opacity-50" />
                    <p>Nenhum capacitor encontrado</p>
                    <p className="text-xs mt-1">Cadastre medições para começar a análise</p>
                   </td>
                 </tr>
              ) : (
                filteredCapacitores.map((cap) => (
                  <tr key={cap.id} className="text-sm hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-bold text-primary">{cap.codigo}</td>
                    <td className="px-5 py-3">
                      <div className="font-medium">{cap.cliente}</div>
                      <div className="text-xs text-slate-400">{cap.banco}</div>
                    </td>
                    <td className="px-5 py-3">{cap.potencia_kvar} kVAr</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">
                      {new Date(cap.ultima_data).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        "font-bold",
                        cap.ultimo_desvio > 0 ? "text-red-500" : "text-green-500"
                      )}>
                        {cap.ultimo_desvio > 0 ? '+' : ''}{cap.ultimo_desvio.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        {cap.tendencia === 'piorando' && <TrendingUp size={14} className="text-red-500" />}
                        {cap.tendencia === 'melhorando' && <TrendingDown size={14} className="text-green-500" />}
                        {cap.tendencia === 'estavel' && <Activity size={14} className="text-slate-400" />}
                        <span className={cn(
                          "text-xs",
                          cap.tendencia === 'piorando' ? "text-red-600" : 
                          cap.tendencia === 'melhorando' ? "text-green-600" : "text-slate-500"
                        )}>
                          {cap.tendencia === 'piorando' ? "Degradando" : 
                           cap.tendencia === 'melhorando' ? "Melhorando" : "Estável"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {cap.previsao_meses && parseFloat(cap.previsao_meses) <= 3 ? (
                        <span className="text-red-600 font-medium text-xs">
                          Urgente! {cap.previsao_meses} meses
                        </span>
                      ) : cap.previsao_meses ? (
                        <span className="text-slate-500 text-xs">
                          {cap.previsao_meses} meses
                        </span>
                      ) : (
                        <span className="text-green-600 text-xs">Saudável</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        "px-2 py-1 text-xs font-bold rounded-full",
                        cap.previsao_meses && parseFloat(cap.previsao_meses) <= 3 ? "bg-red-100 text-red-700" :
                        cap.ultimo_status === 'warning' ? "bg-amber-100 text-amber-700" :
                        "bg-green-100 text-green-700"
                      )}>
                        {cap.previsao_meses && parseFloat(cap.previsao_meses) <= 3 ? "CRÍTICO" :
                         cap.ultimo_status === 'warning' ? "ATENÇÃO" : "OK"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Estimativa de Investimento */}
      {urgentes > 0 && (
        <div className="bg-gradient-to-r from-primary/5 to-secondary/5 p-6 rounded-2xl border border-primary/20">
          <h4 className="font-bold text-primary mb-4 flex items-center gap-2">
            <DollarSign size={18} />
            Estimativa de Investimento
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl">
              <p className="text-xs text-slate-500">Substituição Urgente</p>
              <p className="text-2xl font-bold text-red-600">R$ {urgentes * 250}</p>
              <p className="text-xs text-slate-400">{urgentes} capacitores</p>
            </div>
            <div className="bg-white p-4 rounded-xl">
              <p className="text-xs text-slate-500">Economia mensal estimada</p>
              <p className="text-2xl font-bold text-green-600">R$ {Math.ceil(urgentes * 250 * 0.3)}</p>
              <p className="text-xs text-slate-400">Com eliminação de multas</p>
            </div>
            <div className="bg-white p-4 rounded-xl">
              <p className="text-xs text-slate-500">Payback estimado</p>
              <p className="text-2xl font-bold text-primary">~{Math.ceil((urgentes * 250) / (urgentes * 75))} meses</p>
              <p className="text-xs text-slate-400">Retorno do investimento</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
