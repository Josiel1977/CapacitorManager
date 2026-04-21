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
  data_instalacao: string;
  ultima_medicao: {
    data: string;
    desvio: number;
    status: string;
  };
  tendencia: 'degradando' | 'estavel' | 'melhorando';
  previsao_substituicao: {
    meses: number;
    data: string;
    urgente: boolean;
  };
  medicoes_count: number;
}

export default function ManutencaoPage() {
  const [capacitores, setCapacitores] = useState<CapacitorManutencao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'urgente' | 'atencao'>('todos');

  useEffect(() => {
    fetchDadosManutencao();
  }, []);

  async function fetchDadosManutencao() {
    setLoading(true);
    try {
      // Buscar capacitores com suas medições
      const { data: capacitoresData, error } = await supabase
        .from('capacitores')
        .select(`
          *,
          bancos_capacitores (
            id,
            nome_banco,
            clientes (id, nome)
          ),
          medicoes (
            id,
            data_medicao,
            desvio_percent,
            status_validacao,
            created_at
          )
        `)
        .eq('ativo', true);

      if (error) throw error;

      const processedData: CapacitorManutencao[] = [];

      for (const cap of capacitoresData || []) {
        const medicoes = cap.medicoes || [];
        if (medicoes.length === 0) continue;

        // Ordenar medições por data
        const medicoesOrdenadas = [...medicoes].sort((a, b) => 
          new Date(b.data_medicao || b.created_at).getTime() - new Date(a.data_medicao || a.created_at).getTime()
        );

        const ultimaMedicao = medicoesOrdenadas[0];
        const desvio = Math.abs(ultimaMedicao.desvio_percent || 0);
        
        // Determinar status
        let status = 'ok';
        if (desvio > 15) status = 'critical';
        else if (desvio > 10) status = 'warning';
        
        // Calcular tendência
        let tendencia: 'degradando' | 'estavel' | 'melhorando' = 'estavel';
        if (medicoesOrdenadas.length >= 2) {
          const primeiro = Math.abs(medicoesOrdenadas[medicoesOrdenadas.length - 1].desvio_percent || 0);
          const ultimo = desvio;
          if (ultimo > primeiro * 1.05) tendencia = 'degradando';
          else if (ultimo < primeiro * 0.95) tendencia = 'melhorando';
        }
        
        // Calcular previsão de substituição
        const desvioRestante = 15 - desvio;
        const degradacaoMensal = 0.5; // Taxa padrão de degradação
        const mesesRestantes = desvioRestante > 0 ? desvioRestante / degradacaoMensal : 0;
        const dataPrevisao = new Date();
        dataPrevisao.setMonth(dataPrevisao.getMonth() + mesesRestantes);
        
        processedData.push({
          id: cap.id,
          codigo: cap.codigo_identificacao,
          banco: cap.bancos_capacitores?.nome_banco || 'N/A',
          cliente: cap.bancos_capacitores?.clientes?.nome || 'N/A',
          potencia_kvar: cap.potencia_kvar || 0,
          data_instalacao: cap.data_instalacao || new Date().toISOString(),
          ultima_medicao: {
            data: ultimaMedicao.data_medicao || ultimaMedicao.created_at,
            desvio: ultimaMedicao.desvio_percent || 0,
            status: status
          },
          tendencia,
          previsao_substituicao: {
            meses: mesesRestantes,
            data: dataPrevisao.toLocaleDateString('pt-BR'),
            urgente: mesesRestantes <= 3
          },
          medicoes_count: medicoes.length
        });
      }

      setCapacitores(processedData);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      Swal.fire('Erro', 'Não foi possível carregar os dados', 'error');
    } finally {
      setLoading(false);
    }
  }

  const filteredCapacitores = capacitores.filter(cap => {
    if (filter === 'urgente') return cap.previsao_substituicao.urgente;
    if (filter === 'atencao') return cap.ultima_medicao.status === 'warning';
    return true;
  });

  const urgentes = capacitores.filter(c => c.previsao_substituicao.urgente).length;
  const atencao = capacitores.filter(c => c.ultima_medicao.status === 'warning').length;
  const saudaveis = capacitores.filter(c => c.ultima_medicao.status === 'ok' && !c.previsao_substituicao.urgente).length;

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
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

      {/* Filtros e Ações */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('todos')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              filter === 'todos' ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter('urgente')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              filter === 'urgente' ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            Urgentes ({urgentes})
          </button>
          <button
            onClick={() => setFilter('atencao')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              filter === 'atencao' ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            Atenção ({atencao})
          </button>
        </div>
        <div className="flex gap-2">
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
              {filteredCapacitores.map((cap) => (
                <tr key={cap.id} className="text-sm hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-bold text-primary">{cap.codigo}</td>
                  <td className="px-5 py-3">
                    <div className="font-medium">{cap.cliente}</div>
                    <div className="text-xs text-slate-400">{cap.banco}</div>
                  </td>
                  <td className="px-5 py-3">{cap.potencia_kvar} kVAr</td>
                  <td className="px-5 py-3 text-slate-500 text-xs">
                    {new Date(cap.ultima_medicao.data).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn(
                      "font-bold",
                      cap.ultima_medicao.desvio > 0 ? "text-red-500" : "text-green-500"
                    )}>
                      {cap.ultima_medicao.desvio > 0 ? '+' : ''}{cap.ultima_medicao.desvio.toFixed(2)}%
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
                    {cap.previsao_substituicao.urgente ? (
                      <span className="text-red-600 font-medium text-xs">
                        Urgente! {cap.previsao_substituicao.meses.toFixed(0)} meses
                      </span>
                    ) : cap.previsao_substituicao.meses > 0 ? (
                      <span className="text-slate-500 text-xs">
                        {cap.previsao_substituicao.meses.toFixed(0)} meses
                      </span>
                    ) : (
                      <span className="text-green-600 text-xs">Saudável</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn(
                      "px-2 py-1 text-xs font-bold rounded-full",
                      cap.previsao_substituicao.urgente ? "bg-red-100 text-red-700" :
                      cap.ultima_medicao.status === 'warning' ? "bg-amber-100 text-amber-700" :
                      "bg-green-100 text-green-700"
                    )}>
                      {cap.previsao_substituicao.urgente ? "CRÍTICO" :
                       cap.ultima_medicao.status === 'warning' ? "ATENÇÃO" : "OK"}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredCapacitores.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <Wrench size={32} className="mx-auto mb-2 opacity-50" />
                    Nenhum capacitor encontrado
                  </td>
                </tr>
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
