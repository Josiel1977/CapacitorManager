'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  Wrench, TrendingUp, TrendingDown, Activity, AlertTriangle, 
  CheckCircle2, XCircle, Calendar, Clock, Zap, Droplets,
  DollarSign, RefreshCw, Eye, FileText, Download, Shield, Filter,
  BatteryWarning, Gauge, Building, Banknote, PieChart
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

// ============================================
// FUNÇÕES DE CÁLCULO
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

// Função para calcular tendência de degradação
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

// ============================================
// FUNÇÕES DE CÁLCULO DE INEFICIÊNCIA
// ============================================

interface IneficienciaCalculada {
  nome: string;
  total_nominal_kvar: number;
  total_efetivo_kvar: number;
  total_perda_kvar: number;
  eficiencia_media_percent: number;
  custo_mensal_perda: number;
  capacitores_afetados: number;
  bancos_afetados: number;
  recomendacao_substituicao: number;
}

// Calcular potência efetiva baseada no desvio
function calcularPotenciaEfetiva(potenciaNominal: number, desvioPercentual: number): number {
  const eficiencia = Math.max(0, 100 - Math.abs(desvioPercentual));
  return (potenciaNominal * eficiencia) / 100;
}

// Calcular custo estimado da ineficiência (R$/mês)
function calcularCustoIneficiencia(perdaKvar: number, tarifaReferencia: number = 0.95): number {
  const horasDia = 8;
  const diasMes = 30;
  return perdaKvar * horasDia * diasMes * tarifaReferencia;
}

interface CapacitorManutencao {
  id: string;
  codigo: string;
  banco: string;
  banco_id: string;
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
  potencia_efetiva: number;
  perda_kvar: number;
  eficiencia: number;
}

interface ClienteResumo {
  id: string;
  nome: string;
  total_kvar_instalado: number;
  total_kvar_efetivo: number;
  deficiencia_kvar: number;
  eficiencia_percentual: number;
  custo_mensal_perda: number;
  capacitores_afetados: number;
  bancos_afetados: number;
  bancos: {
    id: string;
    nome: string;
    kvar_instalado: number;
    kvar_efetivo: number;
    deficiencia: number;
  }[];
}

export default function ManutencaoPage() {
  const [capacitores, setCapacitores] = useState<CapacitorManutencao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'urgente' | 'atencao'>('todos');
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteFiltro, setClienteFiltro] = useState<string>('todos');
  const [ineficienciaTotal, setIneficienciaTotal] = useState<IneficienciaCalculada | null>(null);
  const [resumoClientes, setResumoClientes] = useState<ClienteResumo[]>([]);
  const [clienteSelecionadoResumo, setClienteSelecionadoResumo] = useState<ClienteResumo | null>(null);

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
      // Buscar todos os bancos
      const { data: bancosData } = await supabase
        .from('bancos_capacitores')
        .select('id, nome_banco, cliente_id')
        .eq('ativo', true);

      const bancosMap = new Map();
      bancosData?.forEach(banco => {
        bancosMap.set(banco.id, {
          nome: banco.nome_banco,
          cliente_id: banco.cliente_id
        });
      });

      // Buscar todos os capacitores com suas medições
      const { data: capacitoresData } = await supabase
        .from('capacitores')
        .select(`
          id,
          codigo_identificacao,
          potencia_kvar,
          tensao_nominal_v,
          capacitancia_nominal_uf,
          banco_id,
          medicoes (
            id,
            desvio_percentual,
            status_validacao,
            data_medicao,
            created_at,
            tipo_teste,
            corrente_medida_a,
            capacitancia_medida_uf
          )
        `)
        .eq('ativo', true);

      if (!capacitoresData || capacitoresData.length === 0) {
        setCapacitores([]);
        setLoading(false);
        return;
      }

      // Processar cada capacitor
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
        let desvio = ultimaMedicao.desvio_percentual || 0;
        
        // Recalcular desvio se necessário
        if (ultimaMedicao.tipo_teste === 'corrente' && ultimaMedicao.corrente_medida_a && cap.tensao_nominal_v && cap.potencia_kvar) {
          const correnteTeorica = calcularCorrenteTeorica(cap.potencia_kvar, cap.tensao_nominal_v);
          if (correnteTeorica > 0) {
            desvio = ((ultimaMedicao.corrente_medida_a - correnteTeorica) / correnteTeorica) * 100;
          }
        } else if (ultimaMedicao.tipo_teste === 'capacitancia' && ultimaMedicao.capacitancia_medida_uf && cap.capacitancia_nominal_uf) {
          const capacitanciaTeorica = calcularCapacitanciaTeoricaDelta(cap.capacitancia_nominal_uf);
          if (capacitanciaTeorica > 0) {
            desvio = ((ultimaMedicao.capacitancia_medida_uf - capacitanciaTeorica) / capacitanciaTeorica) * 100;
          }
        }

        const desvioAbs = Math.abs(desvio);
        
        // Determinar status
        let status = 'ok';
        if (desvioAbs > 15) status = 'critical';
        else if (desvioAbs > 10) status = 'warning';
        
        // Calcular tendência
        const tendenciaData = calcularTendenciaCapacitor(medicoesOrdenadas);
        
        // Calcular potência efetiva e perda
        const potenciaEfetiva = calcularPotenciaEfetiva(cap.potencia_kvar || 0, desvio);
        const perdaKvar = (cap.potencia_kvar || 0) - potenciaEfetiva;
        const eficiencia = (potenciaEfetiva / (cap.potencia_kvar || 1)) * 100;
        
        const bancoInfo = bancosMap.get(cap.banco_id);
        const clienteId = bancoInfo?.cliente_id;
        
        processedData.push({
          id: cap.id,
          codigo: cap.codigo_identificacao || 'N/A',
          banco: bancoInfo?.nome || 'N/A',
          banco_id: cap.banco_id || '',
          cliente: 'Carregando...',
          cliente_id: clienteId || '',
          potencia_kvar: cap.potencia_kvar || 0,
          tensao_nominal_v: cap.tensao_nominal_v || 0,
          capacitancia_nominal_uf: cap.capacitancia_nominal_uf || 0,
          ultimo_desvio: desvio,
          ultimo_status: status,
          ultima_data: ultimaMedicao.created_at,
          tendencia: (tendenciaData?.tendencia as 'piorando' | 'melhorando' | 'estavel') || 'estavel',
          previsao_meses: tendenciaData?.previsao?.meses || null,
          previsao_data: tendenciaData?.previsao?.data || null,
          medicoes_count: medicoes.length,
          variacao: tendenciaData?.variacao || '0',
          potencia_efetiva: potenciaEfetiva,
          perda_kvar: perdaKvar,
          eficiencia: eficiencia
        });
      }

      // Buscar nomes dos clientes
      const { data: clientesData } = await supabase
        .from('clientes')
        .select('id, nome')
        .eq('ativo', true);

      const clientesMap = new Map();
      clientesData?.forEach(c => clientesMap.set(c.id, c.nome));

      // Atualizar nomes dos clientes nos dados
      processedData.forEach(cap => {
        cap.cliente = clientesMap.get(cap.cliente_id) || 'N/A';
      });

      setCapacitores(processedData);

      // ============================================
      // CALCULAR RESUMO POR CLIENTE
      // ============================================
      
      const clientesResumo: Map<string, ClienteResumo> = new Map();

      for (const cap of processedData) {
        if (!clientesResumo.has(cap.cliente_id)) {
          clientesResumo.set(cap.cliente_id, {
            id: cap.cliente_id,
            nome: cap.cliente,
            total_kvar_instalado: 0,
            total_kvar_efetivo: 0,
            deficiencia_kvar: 0,
            eficiencia_percentual: 0,
            custo_mensal_perda: 0,
            capacitores_afetados: 0,
            bancos_afetados: 0,
            bancos: []
          });
        }

        const resumo = clientesResumo.get(cap.cliente_id)!;
        resumo.total_kvar_instalado += cap.potencia_kvar;
        resumo.total_kvar_efetivo += cap.potencia_efetiva;
        if (cap.perda_kvar > 0.5) resumo.capacitores_afetados++;
      }

      // Adicionar informações de bancos por cliente
      for (const [clienteId, resumo] of clientesResumo) {
        const bancosDoCliente = new Map();
        for (const cap of processedData.filter(c => c.cliente_id === clienteId)) {
          if (!bancosDoCliente.has(cap.banco_id)) {
            bancosDoCliente.set(cap.banco_id, {
              id: cap.banco_id,
              nome: cap.banco,
              kvar_instalado: 0,
              kvar_efetivo: 0,
              deficiencia: 0
            });
          }
          const bancoResumo = bancosDoCliente.get(cap.banco_id);
          bancoResumo.kvar_instalado += cap.potencia_kvar;
          bancoResumo.kvar_efetivo += cap.potencia_efetiva;
          bancoResumo.deficiencia = bancoResumo.kvar_instalado - bancoResumo.kvar_efetivo;
        }
        resumo.bancos = Array.from(bancosDoCliente.values());
        resumo.bancos_afetados = resumo.bancos.filter(b => b.deficiencia > 5).length;
        resumo.deficiencia_kvar = resumo.total_kvar_instalado - resumo.total_kvar_efetivo;
        resumo.eficiencia_percentual = resumo.total_kvar_instalado > 0 
          ? (resumo.total_kvar_efetivo / resumo.total_kvar_instalado) * 100 
          : 100;
        resumo.custo_mensal_perda = calcularCustoIneficiencia(resumo.deficiencia_kvar);
      }

      const resumoArray = Array.from(clientesResumo.values()).filter(r => r.total_kvar_instalado > 0);
      setResumoClientes(resumoArray);

      // Calcular ineficiência total
      let totalNominal = 0;
      let totalEfetivo = 0;
      let capacitoresAfetados = 0;
      
      processedData.forEach(cap => {
        totalNominal += cap.potencia_kvar;
        totalEfetivo += cap.potencia_efetiva;
        if (cap.perda_kvar > 0.5) capacitoresAfetados++;
      });
      
      const perdaTotal = totalNominal - totalEfetivo;
      const eficienciaMedia = totalNominal > 0 ? (totalEfetivo / totalNominal) * 100 : 0;
      
      setIneficienciaTotal({
        nome: 'GERAL',
        total_nominal_kvar: totalNominal,
        total_efetivo_kvar: totalEfetivo,
        total_perda_kvar: perdaTotal,
        eficiencia_media_percent: eficienciaMedia,
        custo_mensal_perda: calcularCustoIneficiencia(perdaTotal),
        capacitores_afetados: capacitoresAfetados,
        bancos_afetados: new Set(processedData.filter(c => c.perda_kvar > 5).map(c => c.banco_id)).size,
        recomendacao_substituicao: Math.ceil(perdaTotal / 10)
      });

      // Selecionar resumo do cliente filtrado
      if (clienteFiltro !== 'todos') {
        const clienteResumo = resumoArray.find(r => r.id === clienteFiltro);
        setClienteSelecionadoResumo(clienteResumo || null);
      } else {
        setClienteSelecionadoResumo(null);
      }
      
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

  // Filtrar capacitores por status
  const filteredCapacitores = capacitores.filter(cap => {
    if (clienteFiltro !== 'todos' && cap.cliente_id !== clienteFiltro) return false;
    if (filter === 'urgente') return cap.previsao_meses !== null && parseFloat(cap.previsao_meses) <= 3;
    if (filter === 'atencao') return cap.ultimo_status === 'warning';
    return true;
  });

  const urgentes = capacitores.filter(c => c.previsao_meses !== null && parseFloat(c.previsao_meses) <= 3).length;
  const atencao = capacitores.filter(c => c.ultimo_status === 'warning').length;
  const saudaveis = capacitores.filter(c => c.ultimo_status === 'ok' && (c.previsao_meses === null || parseFloat(c.previsao_meses) > 3)).length;

  // Top 5 capacitores com maior perda de eficiência
  const topPerdaEficiencia = [...capacitores]
    .filter(c => clienteFiltro === 'todos' || c.cliente_id === clienteFiltro)
    .sort((a, b) => b.perda_kvar - a.perda_kvar)
    .slice(0, 5);

  const clienteSelecionadoObj = clientes.find(c => c.id === clienteFiltro);

  if (loading) {
    return (
      <div className="space-y-8 pb-12">
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-100" />)}
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

      {/* Resumo por Cliente */}
      {resumoClientes.length > 0 && clienteFiltro === 'todos' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-primary flex items-center gap-2">
            <Building size={20} />
            Resumo por Cliente
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {resumoClientes.map((cliente) => (
              <motion.div
                key={cliente.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer"
                onClick={() => setClienteFiltro(cliente.id)}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-primary text-lg">{cliente.nome}</h3>
                  <div className={cn(
                    "px-2 py-1 rounded-full text-xs font-bold",
                    cliente.eficiencia_percentual > 80 ? "bg-green-100 text-green-700" :
                    cliente.eficiencia_percentual > 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                  )}>
                    {cliente.eficiencia_percentual.toFixed(1)}% eficiência
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm">kVAr Instalado:</span>
                    <span className="font-bold text-primary text-xl">{cliente.total_kvar_instalado.toFixed(1)} kVAr</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm">kVAr Efetivo:</span>
                    <span className="font-bold text-amber-600">{cliente.total_kvar_efetivo.toFixed(1)} kVAr</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm">Deficiência:</span>
                    <span className="font-bold text-red-600">-{cliente.deficiencia_kvar.toFixed(1)} kVAr</span>
                  </div>
                  <div className="pt-2">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full",
                          cliente.eficiencia_percentual > 80 ? "bg-green-500" :
                          cliente.eficiencia_percentual > 60 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${cliente.eficiencia_percentual}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-400">
                  <span>🔧 {cliente.bancos_afetados} bancos com problema</span>
                  <span>⚡ {cliente.capacitores_afetados} capacitores afetados</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Detalhamento do Cliente Selecionado */}
      {clienteSelecionadoResumo && clienteFiltro !== 'todos' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-2xl p-6 border border-primary/20"
        >
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-primary">{clienteSelecionadoResumo.nome}</h2>
              <p className="text-slate-500">Análise completa do cliente</p>
            </div>
            <button
              onClick={() => setClienteFiltro('todos')}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Ver todos os clientes →
            </button>
          </div>

          {/* Cards de resumo do cliente */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500">kVAr Instalado</p>
              <p className="text-2xl font-bold text-primary">{clienteSelecionadoResumo.total_kvar_instalado.toFixed(1)} kVAr</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500">kVAr Efetivo</p>
              <p className="text-2xl font-bold text-amber-600">{clienteSelecionadoResumo.total_kvar_efetivo.toFixed(1)} kVAr</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500">Deficiência</p>
              <p className="text-2xl font-bold text-red-600">-{clienteSelecionadoResumo.deficiencia_kvar.toFixed(1)} kVAr</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500">Custo Mensal</p>
              <p className="text-2xl font-bold text-red-600">{clienteSelecionadoResumo.custo_mensal_perda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
          </div>

          {/* Barra de eficiência */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-1">
              <span>Eficiência do Sistema</span>
              <span className="font-bold">{clienteSelecionadoResumo.eficiencia_percentual.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  clienteSelecionadoResumo.eficiencia_percentual > 80 ? "bg-green-500" :
                  clienteSelecionadoResumo.eficiencia_percentual > 60 ? "bg-amber-500" : "bg-red-500"
                )}
                style={{ width: `${clienteSelecionadoResumo.eficiencia_percentual}%` }}
              />
            </div>
            {clienteSelecionadoResumo.deficiencia_kvar > 0 && (
              <p className="text-xs text-red-500 mt-2">
                ⚠️ Deficiência de {clienteSelecionadoResumo.deficiencia_kvar.toFixed(1)} kVAr detectada. 
                Recomenda-se instalar aproximadamente <strong>{Math.ceil(clienteSelecionadoResumo.deficiencia_kvar / 10)}</strong> capacitores de 10 kVAr.
              </p>
            )}
          </div>

          {/* Detalhamento por Banco */}
          <div>
            <h3 className="font-bold text-primary mb-3 flex items-center gap-2">
              <Database size={16} />
              Detalhamento por Banco de Capacitores
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-xs font-medium text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Banco</th>
                    <th className="px-4 py-2">kVAr Instalado</th>
                    <th className="px-4 py-2">kVAr Efetivo</th>
                    <th className="px-4 py-2">Deficiência</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clienteSelecionadoResumo.bancos.map((banco) => (
                    <tr key={banco.id} className="text-sm">
                      <td className="px-4 py-2 font-medium">{banco.nome}</td>
                      <td className="px-4 py-2">{banco.kvar_instalado.toFixed(1)} kVAr</td>
                      <td className="px-4 py-2 text-amber-600">{banco.kvar_efetivo.toFixed(1)} kVAr</td>
                      <td className="px-4 py-2 text-red-600">-{banco.deficiencia.toFixed(1)} kVAr</td>
                      <td className="px-4 py-2">
                        <span className={cn(
                          "px-2 py-0.5 text-xs rounded-full",
                          banco.deficiencia > 10 ? "bg-red-100 text-red-700" :
                          banco.deficiencia > 5 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                        )}>
                          {banco.deficiencia > 10 ? "Crítico" : banco.deficiencia > 5 ? "Atenção" : "Normal"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Filtrar por Cliente</label>
            <select 
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 outline-none focus:border-primary"
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
              Todos ({filteredCapacitores.length})
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
              <PieChart size={22} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase">Total Analisado</span>
          </div>
          <p className="text-3xl font-bold text-primary">{capacitores.filter(c => clienteFiltro === 'todos' || c.cliente_id === clienteFiltro).length}</p>
          <p className="text-xs text-slate-400 mt-1">Capacitores monitorados</p>
        </div>
      </div>

      {/* Ineficiência Total do Sistema */}
      {ineficienciaTotal && ineficienciaTotal.total_nominal_kvar > 0 && clienteFiltro === 'todos' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg text-red-600">
                <BatteryWarning size={22} />
              </div>
              <h3 className="font-bold text-primary">Ineficiência Total do Sistema</h3>
            </div>
            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
              Perda: {ineficienciaTotal.total_perda_kvar.toFixed(1)} kVAr
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500">Potência Instalada</p>
              <p className="text-xl font-bold text-primary">{ineficienciaTotal.total_nominal_kvar.toFixed(1)} kVAr</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Potência Disponível</p>
              <p className="text-xl font-bold text-amber-600">{ineficienciaTotal.total_efetivo_kvar.toFixed(1)} kVAr</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Perda Mensal Estimada</p>
              <p className="text-xl font-bold text-red-600">{ineficienciaTotal.custo_mensal_perda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Eficiência Média</span>
              <span className="font-bold">{ineficienciaTotal.eficiencia_media_percent.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-red-500 rounded-full"
                style={{ width: `${ineficienciaTotal.eficiencia_media_percent}%` }}
              />
            </div>
            <p className="text-xs text-amber-600 mt-2">
              💡 Recomenda-se instalar aproximadamente <strong>{ineficienciaTotal.recomendacao_substituicao}</strong> capacitores de 10 kVAr para recuperar a potência perdida.
            </p>
          </div>
        </div>
      )}

      {/* Tabela de Capacitores com Maior Ineficiência */}
      {topPerdaEficiencia.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-bold text-primary flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              Top 5 Capacitores com Maior Perda de Eficiência
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-3">Capacitor</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Potência Nominal</th>
                  <th className="px-5 py-3">Potência Efetiva</th>
                  <th className="px-5 py-3">Perda</th>
                  <th className="px-5 py-3">Eficiência</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topPerdaEficiencia.map((cap) => (
                  <tr key={cap.id} className="text-sm hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-primary">{cap.codigo}</td>
                    <td className="px-5 py-3">{cap.cliente}</td>
                    <td className="px-5 py-3">{cap.potencia_kvar.toFixed(1)} kVAr</td>
                    <td className="px-5 py-3 text-amber-600">{cap.potencia_efetiva.toFixed(1)} kVAr</td>
                    <td className="px-5 py-3 text-red-600">-{cap.perda_kvar.toFixed(1)} kVAr</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-red-500 rounded-full"
                            style={{ width: `${cap.eficiencia}%` }}
                          />
                        </div>
                        <span className="text-xs">{cap.eficiencia.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        "px-2 py-1 text-xs font-bold rounded-full",
                        cap.previsao_meses && parseFloat(cap.previsao_meses) <= 3 ? "bg-red-100 text-red-700" :
                        cap.ultimo_status === 'warning' ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                      )}>
                        {cap.previsao_meses && parseFloat(cap.previsao_meses) <= 3 ? "CRÍTICO" :
                         cap.ultimo_status === 'warning' ? "ATENÇÃO" : "OK"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="flex justify-end gap-2">
        <button
          onClick={fetchDadosManutencao}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Atualizar
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
                <th className="px-5 py-4">Desvio</th>
                <th className="px-5 py-4">Eficiência</th>
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
                    <td className="px-5 py-3">
                      <span className={cn(
                        "font-bold",
                        cap.ultimo_desvio > 0 ? "text-red-500" : "text-green-500"
                      )}>
                        {cap.ultimo_desvio > 0 ? '+' : ''}{cap.ultimo_desvio.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full",
                              cap.eficiencia > 80 ? "bg-green-500" : cap.eficiencia > 60 ? "bg-amber-500" : "bg-red-500"
                            )}
                            style={{ width: `${cap.eficiencia}%` }}
                          />
                        </div>
                        <span className="text-xs">{cap.eficiencia.toFixed(0)}%</span>
                      </div>
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
                        cap.ultimo_status === 'warning' ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
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
