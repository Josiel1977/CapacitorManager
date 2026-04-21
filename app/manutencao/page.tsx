'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  Wrench, TrendingUp, TrendingDown, Activity, AlertTriangle, 
  CheckCircle2, XCircle, Calendar, Clock, Zap, Droplets,
  DollarSign, RefreshCw, Eye, FileText, Download, Shield, Filter,
  BatteryWarning, Gauge, Building, Banknote, PieChart, Database
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

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

function calcularPotenciaEfetivaPorStatus(potenciaNominal: number, statusValidacao: string): number {
    switch (statusValidacao) {
        case 'aprovado':
            return potenciaNominal;
        case 'atencao':
            return potenciaNominal * 0.7;
        case 'reprovado':
            return 0;
        default:
            return potenciaNominal;
    }
}

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
  status_validacao: string;
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
  aprovados: number;
  atencao: number;
  reprovados: number;
  bancos: {
    id: string;
    nome: string;
    kvar_instalado: number;
    kvar_efetivo: number;
    deficiencia: number;
    aprovados: number;
    atencao: number;
    reprovados: number;
  }[];
}

export default function ManutencaoPage() {
  const router = useRouter();
  const [capacitores, setCapacitores] = useState<CapacitorManutencao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'reprovado' | 'atencao'>('todos');
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteFiltro, setClienteFiltro] = useState<string>('todos');
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

      // Buscar nomes dos clientes
      const { data: clientesData } = await supabase
        .from('clientes')
        .select('id, nome')
        .eq('ativo', true);

      const clientesMap = new Map();
      clientesData?.forEach(c => clientesMap.set(c.id, c.nome));

      const processedData: CapacitorManutencao[] = [];

      for (const cap of capacitoresData) {
        const medicoes = cap.medicoes || [];
        if (medicoes.length === 0) continue;

        const medicoesOrdenadas = [...medicoes].sort((a, b) => {
          const dateA = a.data_medicao || a.created_at;
          const dateB = b.data_medicao || b.created_at;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });

        const ultimaMedicao = medicoesOrdenadas[0];
        let desvio = ultimaMedicao.desvio_percentual || 0;
        let status = ultimaMedicao.status_validacao || 'atencao';
        
        if (ultimaMedicao.tipo_teste === 'corrente' && ultimaMedicao.corrente_medida_a && cap.tensao_nominal_v && cap.potencia_kvar) {
          const correnteTeorica = calcularCorrenteTeorica(cap.potencia_kvar, cap.tensao_nominal_v);
          if (correnteTeorica > 0) {
            desvio = ((ultimaMedicao.corrente_medida_a - correnteTeorica) / correnteTeorica) * 100;
            status = getStatusValidacao(desvio);
          }
        } else if (ultimaMedicao.tipo_teste === 'capacitancia' && ultimaMedicao.capacitancia_medida_uf && cap.capacitancia_nominal_uf) {
          const capacitanciaTeorica = calcularCapacitanciaTeoricaDelta(cap.capacitancia_nominal_uf);
          if (capacitanciaTeorica > 0) {
            desvio = ((ultimaMedicao.capacitancia_medida_uf - capacitanciaTeorica) / capacitanciaTeorica) * 100;
            status = getStatusValidacao(desvio);
          }
        }
        
        const tendenciaData = calcularTendenciaCapacitor(medicoesOrdenadas);
        
        const potenciaEfetiva = calcularPotenciaEfetivaPorStatus(cap.potencia_kvar || 0, status);
        const perdaKvar = (cap.potencia_kvar || 0) - potenciaEfetiva;
        const eficiencia = (potenciaEfetiva / (cap.potencia_kvar || 1)) * 100;
        
        const bancoInfo = bancosMap.get(cap.banco_id);
        const clienteId = bancoInfo?.cliente_id;
        const clienteNome = clientesMap.get(clienteId) || 'N/A';
        
        processedData.push({
          id: cap.id,
          codigo: cap.codigo_identificacao || 'N/A',
          banco: bancoInfo?.nome || 'N/A',
          banco_id: cap.banco_id || '',
          cliente: clienteNome,
          cliente_id: clienteId || '',
          potencia_kvar: cap.potencia_kvar || 0,
          tensao_nominal_v: cap.tensao_nominal_v || 0,
          capacitancia_nominal_uf: cap.capacitancia_nominal_uf || 0,
          ultimo_desvio: desvio,
          status_validacao: status,
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

      setCapacitores(processedData);

      // Calcular resumo por cliente
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
            aprovados: 0,
            atencao: 0,
            reprovados: 0,
            bancos: []
          });
        }

        const resumo = clientesResumo.get(cap.cliente_id)!;
        resumo.total_kvar_instalado += cap.potencia_kvar;
        resumo.total_kvar_efetivo += cap.potencia_efetiva;
        
        if (cap.status_validacao === 'aprovado') resumo.aprovados++;
        else if (cap.status_validacao === 'atencao') resumo.atencao++;
        else if (cap.status_validacao === 'reprovado') resumo.reprovados++;
      }

      for (const [clienteId, resumo] of clientesResumo) {
        const bancosDoCliente = new Map();
        for (const cap of processedData.filter(c => c.cliente_id === clienteId)) {
          if (!bancosDoCliente.has(cap.banco_id)) {
            bancosDoCliente.set(cap.banco_id, {
              id: cap.banco_id,
              nome: cap.banco,
              kvar_instalado: 0,
              kvar_efetivo: 0,
              deficiencia: 0,
              aprovados: 0,
              atencao: 0,
              reprovados: 0
            });
          }
          const bancoResumo = bancosDoCliente.get(cap.banco_id);
          bancoResumo.kvar_instalado += cap.potencia_kvar;
          bancoResumo.kvar_efetivo += cap.potencia_efetiva;
          bancoResumo.deficiencia = bancoResumo.kvar_instalado - bancoResumo.kvar_efetivo;
          
          if (cap.status_validacao === 'aprovado') bancoResumo.aprovados++;
          else if (cap.status_validacao === 'atencao') bancoResumo.atencao++;
          else if (cap.status_validacao === 'reprovado') bancoResumo.reprovados++;
        }
        resumo.bancos = Array.from(bancosDoCliente.values());
        resumo.deficiencia_kvar = resumo.total_kvar_instalado - resumo.total_kvar_efetivo;
        resumo.eficiencia_percentual = resumo.total_kvar_instalado > 0 
          ? (resumo.total_kvar_efetivo / resumo.total_kvar_instalado) * 100 
          : 100;
        resumo.custo_mensal_perda = calcularCustoIneficiencia(resumo.deficiencia_kvar);
      }

      const resumoArray = Array.from(clientesResumo.values()).filter(r => r.total_kvar_instalado > 0);
      setResumoClientes(resumoArray);

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
        text: 'Não foi possível carregar os dados.',
        icon: 'error',
        confirmButtonColor: '#0a2b3c'
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDadosManutencao();
  }, [clienteFiltro]);

  const filteredCapacitores = capacitores.filter(cap => {
    if (clienteFiltro !== 'todos' && cap.cliente_id !== clienteFiltro) return false;
    if (filter === 'reprovado') return cap.status_validacao === 'reprovado';
    if (filter === 'atencao') return cap.status_validacao === 'atencao';
    return true;
  });

  const reprovados = capacitores.filter(c => c.status_validacao === 'reprovado').length;
  const atencao = capacitores.filter(c => c.status_validacao === 'atencao').length;
  const aprovados = capacitores.filter(c => c.status_validacao === 'aprovado').length;

  const topPerdaEficiencia = [...capacitores]
    .filter(c => (clienteFiltro === 'todos' || c.cliente_id === clienteFiltro) && c.status_validacao !== 'aprovado')
    .sort((a, b) => b.perda_kvar - a.perda_kvar)
    .slice(0, 5);

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
            Acompanhe a saúde dos seus capacitores baseado nas validações técnicas.
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
                    cliente.eficiencia_percentual >= 80 ? "bg-green-100 text-green-700" :
                    cliente.eficiencia_percentual >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
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
                          cliente.eficiencia_percentual >= 80 ? "bg-green-500" :
                          cliente.eficiencia_percentual >= 50 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${cliente.eficiencia_percentual}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-xs">
                  <span className="text-green-600">✅ {cliente.aprovados} aprovados</span>
                  <span className="text-amber-600">⚠️ {cliente.atencao} atenção</span>
                  <span className="text-red-600">❌ {cliente.reprovados} reprovados</span>
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
              <p className="text-slate-500">Análise completa baseada nas validações técnicas</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/capacitores?cliente_id=${clienteFiltro}`)}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Eye size={16} />
                Ver todos os capacitores
              </button>
              <button
                onClick={() => setClienteFiltro('todos')}
                className="text-sm text-primary hover:underline"
              >
                Voltar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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
            <div className="bg-white rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500">Eficiência</p>
              <p className="text-2xl font-bold text-primary">{clienteSelecionadoResumo.eficiencia_percentual.toFixed(1)}%</p>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-sm mb-1">
              <span>Eficiência do Sistema</span>
              <span className="font-bold">{clienteSelecionadoResumo.eficiencia_percentual.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  clienteSelecionadoResumo.eficiencia_percentual >= 80 ? "bg-green-500" :
                  clienteSelecionadoResumo.eficiencia_percentual >= 50 ? "bg-amber-500" : "bg-red-500"
                )}
                style={{ width: `${clienteSelecionadoResumo.eficiencia_percentual}%` }}
              />
            </div>
          </div>

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
                    <th className="px-4 py-2">Aprovados</th>
                    <th className="px-4 py-2">Atenção</th>
                    <th className="px-4 py-2">Reprovados</th>
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
                          banco.deficiencia > 20 ? "bg-red-100 text-red-700" :
                          banco.deficiencia > 10 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                        )}>
                          {banco.deficiencia > 20 ? "Crítico" : banco.deficiencia > 10 ? "Atenção" : "Normal"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-green-600">{banco.aprovados}</td>
                      <td className="px-4 py-2 text-amber-600">{banco.atencao}</td>
                      <td className="px-4 py-2 text-red-600">{banco.reprovados}</td>
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
              onClick={() => setFilter('reprovado')}
              className={cn(
                "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                filter === 'reprovado' ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Reprovados ({reprovados})
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
              <XCircle size={22} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase">Reprovados</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{reprovados}</p>
          <p className="text-xs text-red-500 mt-1">Substituição necessária</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <AlertTriangle size={22} />
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
            <span className="text-xs font-medium text-slate-500 uppercase">Aprovados</span>
          </div>
          <p className="text-3xl font-bold text-green-600">{aprovados}</p>
          <p className="text-xs text-green-500 mt-1">Dentro da especificação</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <PieChart size={22} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase">Total</span>
          </div>
          <p className="text-3xl font-bold text-primary">{capacitores.filter(c => clienteFiltro === 'todos' || c.cliente_id === clienteFiltro).length}</p>
          <p className="text-xs text-slate-400 mt-1">Capacitores monitorados</p>
        </div>
      </div>

      {/* Tabela de Capacitores com Problema */}
      {topPerdaEficiencia.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-bold text-primary flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              Capacitores que Necessitam Atenção
            </h3>
            <p className="text-xs text-slate-400 mt-1">Baseado nas validações técnicas (Reprovados e em Atenção)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-3">Código</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Potência</th>
                  <th className="px-5 py-3">Desvio</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Perda</th>
                  <th className="px-5 py-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topPerdaEficiencia.map((cap) => (
                  <tr key={cap.id} className="text-sm hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-primary">{cap.codigo}</td>
                    <td className="px-5 py-3">{cap.cliente}</td>
                    <td className="px-5 py-3">{cap.potencia_kvar.toFixed(1)} kVAr</td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        "font-bold",
                        cap.ultimo_desvio > 0 ? "text-red-500" : "text-green-500"
                      )}>
                        {cap.ultimo_desvio > 0 ? '+' : ''}{cap.ultimo_desvio.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        "px-2 py-1 text-xs font-bold rounded-full",
                        cap.status_validacao === 'reprovado' ? "bg-red-100 text-red-700" :
                        cap.status_validacao === 'atencao' ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                      )}>
                        {cap.status_validacao === 'reprovado' ? "REPROVADO" :
                         cap.status_validacao === 'atencao' ? "ATENÇÃO" : "APROVADO"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-red-600">-{cap.perda_kvar.toFixed(1)} kVAr</td>
                    <td className="px-5 py-3">
                      {cap.status_validacao === 'reprovado' ? (
                        <span className="text-red-600 font-medium text-xs">Substituir</span>
                      ) : (
                        <span className="text-amber-600 text-xs">Monitorar</span>
                      )}
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
    </div>
  );
}
