'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  Wrench, TrendingUp, TrendingDown, Activity, AlertTriangle, 
  CheckCircle2, XCircle, Calendar, Clock, Zap, Droplets,
  DollarSign, RefreshCw, Eye, FileText, Download, Shield
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

interface CapacitorManutencao {
  id: string;
  codigo: string;
  banco: string;
  cliente: string;
  potencia_kvar: number;
  tensao_nominal_v: number;
  data_instalacao: string;
  ultimo_desvio: number;
  ultimo_status: string;
  ultima_data: string;
  tendencia: 'degradando' | 'estavel' | 'melhorando';
  previsao_meses: number;
  previsao_urgente: boolean;
  medicoes_count: number;
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
      // Buscar capacitores com seus bancos e medições
      const { data: capacitoresData, error } = await supabase
        .from('capacitores')
        .select(`
          id,
          codigo_identificacao,
          potencia_kvar,
          tensao_nominal_v,
          data_instalacao,
          banco_id,
          bancos_capacitores (
            id,
            nome_banco,
            cliente_id,
            clientes (id, nome)
          ),
          medicoes (
            id,
            desvio_percentual,
            status_validacao,
            data_medicao,
            created_at
          )
        `)
        .eq('ativo', true);

      if (error) throw error;
      if (!capacitoresData || capacitoresData.length === 0) {
        setCapacitores([]);
        setLoading(false);
        return;
      }

      const processedData: CapacitorManutencao[] = [];

      for (const cap of capacitoresData) {
        const medicoes = cap.medicoes || [];
        if (medicoes.length === 0) continue;

        // Ordenar medições por data (mais recente primeiro)
        const medicoesOrdenadas = [...medicoes].sort((a, b) => {
          const dateA = a.data_medicao || a.created_at;
          const dateB = b.data_medicao || b.created_at;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });

        const ultimaMedicao = medicoesOrdenadas[0];
        const desvio = Math.abs(ultimaMedicao.desvio_percentual || 0);
        
        // Determinar status
        let status = 'ok';
        if (desvio > 15) status = 'critical';
        else if (desvio > 10) status = 'warning';
        
        // Calcular tendência
        let tendencia: 'degradando' | 'estavel' | 'melhorando' = 'estavel';
        if (medicoesOrdenadas.length >= 2) {
          const ultima = medicoesOrdenadas[0];
          const primeira = medicoesOrdenadas[medicoesOrdenadas.length - 1];
          const desvioUltimo = Math.abs(ultima.desvio_percentual || 0);
          const desvioPrimeiro = Math.abs(primeira.desvio_percentual || 0);
          
          if (desvioUltimo > desvioPrimeiro * 1.05) tendencia = 'degradando';
          else if (desvioUltimo < desvioPrimeiro * 0.95) tendencia = 'melhorando';
        }
        
        // Calcular previsão de substituição
        const desvioRestante = 15 - desvio;
        const taxaDegradacao = 0.5; // Taxa padrão de 0.5% por mês
        let mesesRestantes = 0;
        let urgente = false;
        
        if (desvioRestante > 0 && taxaDegradacao > 0) {
          mesesRestantes = desvioRestante / taxaDegradacao;
          urgente = mesesRestantes <= 3;
        } else if (desvioRestante <= 0) {
          urgente = true;
        }

        // Aplicar filtro por cliente se necessário
        const clienteNome = cap.bancos_capacitores?.clientes?.nome || 'N/A';
        const clienteId = cap.bancos_capacitores?.cliente_id;
        
        if (clienteFiltro !== 'todos' && clienteId !== clienteFiltro) {
          continue;
        }

        processedData.push({
          id: cap.id,
          codigo: cap.codigo_identificacao || 'N/A',
          banco: cap.bancos_capacitores?.nome_banco || 'N/A',
          cliente: clienteNome,
          potencia_kvar: cap.potencia_kvar || 0,
          tensao_nominal_v: cap.tensao_nominal_v || 0,
          data_instalacao: cap.data_instalacao || new Date().toISOString(),
          ultimo_desvio: ultimaMedicao.desvio_percentual || 0,
          ultimo_status: status,
          ultima_data: ultimaMedicao.data_medicao || ultimaMedicao.created_at,
          tendencia,
          previsao_meses: mesesRestantes,
          previsao_urgente: urgente,
          medicoes_count: medicoes.length
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

  // Filtrar capacitores
  const filteredCapacitores = capacitores.filter(cap => {
    if (filter === 'urgente') return cap.previsao_urgente;
    if (filter === 'atencao') return cap.ultimo_status === 'warning';
    return true;
  });

  const urgentes = capacitores.filter(c => c.previsao_urgente).length;
  const atencao = capacitores.filter(c => c.ultimo_status === 'warning').length;
  const saudaveis = capacitores.filter(c => c.ultimo_status === 'ok' && !c.previsao_urgente).length;

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
            onChange={(e) => {
              setClienteFiltro(e.target.value);
              fetchDadosManutencao();
            }}
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
            <span className="text-xs font-medium text-slate-500 uppercase">Urgentes</span>
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
                        {cap.tendencia === 'degradando' && <TrendingDown size={14} className="text-red-500" />}
                        {cap.tendencia === 'melhorando' && <TrendingUp size={14} className="text-green-500" />}
                        {cap.tendencia === 'estavel' && <Activity size={14} className="text-slate-400" />}
                        <span className={cn(
                          "text-xs",
                          cap.tendencia === 'degradando' ? "text-red-600" : 
                          cap.tendencia === 'melhorando' ? "text-green-600" : "text-slate-500"
                        )}>
                          {cap.tendencia === 'degradando' ? "Degradando" : 
                           cap.tendencia === 'melhorando' ? "Melhorando" : "Estável"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {cap.previsao_urgente ? (
                        <span className="text-red-600 font-medium text-xs">
                          Urgente! {cap.previsao_meses.toFixed(0)} meses
                        </span>
                      ) : cap.previsao_meses > 0 ? (
                        <span className="text-slate-500 text-xs">
                          {cap.previsao_meses.toFixed(0)} meses
                        </span>
                      ) : (
                        <span className="text-green-600 text-xs">Saudável</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        "px-2 py-1 text-xs font-bold rounded-full",
                        cap.previsao_urgente ? "bg-red-100 text-red-700" :
                        cap.ultimo_status === 'warning' ? "bg-amber-100 text-amber-700" :
                        "bg-green-100 text-green-700"
                      )}>
                        {cap.previsao_urgente ? "CRÍTICO" :
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
