'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Database, 
  Zap, 
  ClipboardCheck, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  DollarSign,
  Activity,
  Cpu,
  ArrowUpRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { 
  formatCurrency 
} from '@/lib/utils';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement 
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { cn } from '@/lib/utils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// Funções de cálculo locais (para garantir independência)
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

export default function Dashboard() {
  const [stats, setStats] = useState({
    clientes: 0,
    bancos: 0,
    capacitores: 0,
    medicoes: 0,
    aprovados: 0,
    atencao: 0,
    reprovados: 0,
    economiaTotal: 0,
    eficienciaGeral: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentMedicoes, setRecentMedicoes] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
  }, []);

  // Função para recalcular uma medição individual com os dados corretos
  async function recalcularMedicao(med: any) {
    let desvio = med.desvio_percentual;
    let status = med.status_validacao;
    
    // Buscar dados completos do capacitor se não estiverem disponíveis
    let capacitor = med.capacitores;
    if (!capacitor && med.capacitor_id) {
      const { data } = await supabase
        .from('capacitores')
        .select('*')
        .eq('id', med.capacitor_id)
        .single();
      capacitor = data;
    }

    if (capacitor) {
      const tensaoNominal = capacitor.tensao_nominal_v;
      
      if (med.tipo_teste === 'corrente') {
        const correnteMedida = med.corrente_medida_a;
        const correnteTeorica = calcularCorrenteTeorica(capacitor.potencia_kvar, tensaoNominal);
        
        if (correnteMedida && correnteTeorica > 0) {
          desvio = ((correnteMedida - correnteTeorica) / correnteTeorica) * 100;
          status = getStatusValidacao(desvio);
        }
      } else if (med.tipo_teste === 'capacitancia') {
        const capacitanciaMedida = med.capacitancia_medida_uf;
        const capacitanciaTeorica = calcularCapacitanciaTeoricaDelta(capacitor.capacitancia_nominal_uf);
        
        if (capacitanciaMedida && capacitanciaTeorica > 0) {
          desvio = ((capacitanciaMedida - capacitanciaTeorica) / capacitanciaTeorica) * 100;
          status = getStatusValidacao(desvio);
        }
      }
    }

    return {
      ...med,
      desvio_percentual: desvio,
      status_validacao: status,
      tensao_capacitor: capacitor?.tensao_nominal_v,
      capacitor: capacitor
    };
  }

  async function fetchStats() {
    try {
      setLoading(true);
      
      // Buscar contagens básicas
      const { count: clientesCount } = await supabase.from('clientes').select('*', { count: 'exact', head: true });
      const { count: bancosCount } = await supabase.from('bancos_capacitores').select('*', { count: 'exact', head: true });
      const { count: capacitoresCount } = await supabase.from('capacitores').select('*', { count: 'exact', head: true });
      
      // Buscar todas as medições com dados dos capacitores
      const { data: medicoesData } = await supabase
        .from('medicoes')
        .select(`
          *,
          capacitores!inner(
            id, 
            codigo_identificacao, 
            potencia_kvar, 
            capacitancia_nominal_uf, 
            tensao_nominal_v
          ),
          clientes(id, nome)
        `)
        .order('created_at', { ascending: false });

      if (!medicoesData || medicoesData.length === 0) {
        setStats({
          clientes: clientesCount || 0,
          bancos: bancosCount || 0,
          capacitores: capacitoresCount || 0,
          medicoes: 0,
          aprovados: 0,
          atencao: 0,
          reprovados: 0,
          economiaTotal: 0,
          eficienciaGeral: 0
        });
        setRecentMedicoes([]);
        setLoading(false);
        return;
      }

      // Recalcular cada medição individualmente
      const processedMedicoes = await Promise.all(medicoesData.map(recalcularMedicao));

      // Calcular estatísticas com os dados corrigidos
      const statusCounts = processedMedicoes.reduce((acc: any, curr: any) => {
        acc[curr.status_validacao] = (acc[curr.status_validacao] || 0) + 1;
        return acc;
      }, { aprovado: 0, atencao: 0, reprovado: 0 });

      // Cálculo de Economia Estimada
      const totalKvarAprovado = processedMedicoes
        .filter(m => m.status_validacao === 'aprovado' && m.capacitores?.potencia_kvar)
        .reduce((acc, m) => acc + (m.capacitores.potencia_kvar || 0), 0);
      
      const economiaEstimada = totalKvarAprovado * 0.5 * 24 * 30 * 0.95;
      const eficiencia = processedMedicoes.length > 0 
        ? (statusCounts.aprovado / processedMedicoes.length) * 100 
        : 0;

      // Pegar as 5 últimas medições já corrigidas
      const processedRecent = processedMedicoes.slice(0, 5);

      setStats({
        clientes: clientesCount || 0,
        bancos: bancosCount || 0,
        capacitores: capacitoresCount || 0,
        medicoes: processedMedicoes.length,
        aprovados: statusCounts.aprovado,
        atencao: statusCounts.atencao,
        reprovados: statusCounts.reprovado,
        economiaTotal: economiaEstimada,
        eficienciaGeral: eficiencia
      });
      setRecentMedicoes(processedRecent);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }

  // Função para formatar desvio
  function formatDesvio(desvio: number): string {
    if (desvio === null || desvio === undefined) return '---';
    return `${desvio > 0 ? '+' : ''}${desvio.toFixed(2)}%`;
  }

  const pieData = {
    labels: ['Aprovado', 'Atenção', 'Reprovado'],
    datasets: [
      {
        data: [stats.aprovados, stats.atencao, stats.reprovados],
        backgroundColor: ['#2ecc71', '#f39c12', '#e74c3c'],
        borderWidth: 0,
      },
    ],
  };

  const barData = {
    labels: ['Clientes', 'Bancos', 'Capacitores', 'Medições'],
    datasets: [
      {
        label: 'Total',
        data: [stats.clientes, stats.bancos, stats.capacitores, stats.medicoes],
        backgroundColor: '#0a2b3c',
      },
    ],
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Section Premium */}
      <motion.section 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-slate-950 p-8 text-white shadow-2xl md:p-16"
      >
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-yellow-500/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
             v
      {/* High Impact Indicators */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="rounded-xl bg-green-50 p-3 text-green-600">
              <Activity size={24} />
            </div>
            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">LIVE</span>
          </div>
          <h3 className="text-sm font-medium text-slate-500 mb-1">Eficiência do Banco</h3>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-black text-slate-900">{stats.eficienciaGeral.toFixed(1)}%</p>
            <ArrowUpRight className="text-green-500 mb-1" size={20} />
          </div>
          <div className="mt-4 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${stats.eficienciaGeral}%` }}
              className="h-full bg-green-500"
            />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Cpu size={24} />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 animate-ping rounded-full bg-blue-500" />
              <span className="text-xs font-bold text-blue-600">ATIVO</span>
            </div>
          </div>
          <h3 className="text-sm font-medium text-slate-500 mb-1">Status do Cérebro</h3>
          <p className="text-xl font-bold text-slate-900">
            {stats.reprovados > 0 ? 'Manutenção Necessária' : 'Otimização de Custos'}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {stats.reprovados > 0 
              ? `IA sugere trocar ${stats.reprovados} capacitores para evitar multas.` 
              : 'IA analisando 24/7 para manter o fator de potência ideal.'}
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-2xl bg-primary p-6 shadow-lg text-white"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="rounded-xl bg-white/10 p-3">
              <Zap size={24} />
            </div>
            <span className="text-xs font-bold bg-white/10 px-2 py-1 rounded-md">SISTEMA</span>
          </div>
          <h3 className="text-sm font-medium text-slate-300 mb-1">Capacitores Monitorados</h3>
          <p className="text-3xl font-black">{stats.capacitores}</p>
          <p className="text-xs text-slate-400 mt-2">Total em todos os bancos</p>
        </motion.div>
      </div>

      {/* Stats Cards Grid */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard icon={Users} label="Clientes Ativos" value={stats.clientes} color="bg-slate-100 text-slate-600" />
        <StatCard icon={Database} label="Bancos de Capacitores" value={stats.bancos} color="bg-slate-100 text-slate-600" />
        <StatCard icon={ClipboardCheck} label="Total de Medições" value={stats.medicoes} color="bg-slate-100 text-slate-600" />
        <StatCard icon={TrendingUp} label="Taxa de Sucesso" value={`${stats.eficienciaGeral.toFixed(0)}%`} color="bg-slate-100 text-slate-600" />
      </motion.div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Charts */}
        <motion.div 
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="rounded-xl bg-white p-6 shadow-sm"
        >
          <h2 className="mb-6 text-xl font-semibold text-primary">Distribuição de Status</h2>
          <div className="flex h-64 justify-center">
            <Pie data={pieData} options={{ maintainAspectRatio: false }} />
          </div>
        </motion.div>

        <motion.div 
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="rounded-xl bg-white p-6 shadow-sm"
        >
          <h2 className="mb-6 text-xl font-semibold text-primary">Resumo Geral</h2>
          <div className="h-64">
            <Bar data={barData} options={{ maintainAspectRatio: false }} />
          </div>
        </motion.div>
      </div>

      {/* Recent Medicoes - CORRIGIDO */}
      <motion.div 
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        className="rounded-xl bg-white p-6 shadow-sm"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-primary">Últimas Medições</h2>
          <TrendingUp className="text-slate-400" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 text-sm font-medium text-slate-500">
                <th className="pb-4">Data</th>
                <th className="pb-4">Cliente</th>
                <th className="pb-4">Capacitor</th>
                <th className="pb-4">Tensão</th>
                <th className="pb-4">Tipo</th>
                <th className="pb-4">Desvio</th>
                <th className="pb-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentMedicoes.map((med) => (
                <tr key={med.id} className="text-sm text-slate-700">
                  <td className="py-4">{new Date(med.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="py-4 font-medium">{med.clientes?.nome || '-'}</td>
                  <td className="py-4 font-bold text-primary">{med.capacitores?.codigo_identificacao || '-'}</td>
                  <td className="py-4">
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">
                      ⚡ {med.tensao_capacitor || med.capacitores?.tensao_nominal_v || '?'}V
                    </span>
                  </td>
                  <td className="py-4 capitalize">{med.tipo_teste === 'corrente' ? 'Corrente' : 'Capacitância'}</td>
                  <td className="py-4">
                    <span className={cn(
                      "font-bold",
                      med.desvio_percentual !== null && med.desvio_percentual > 0 ? "text-red-600" : 
                      med.desvio_percentual !== null && med.desvio_percentual < 0 ? "text-amber-600" : "text-slate-600"
                    )}>
                      {formatDesvio(med.desvio_percentual)}
                    </span>
                  </td>
                  <td className="py-4">
                    <StatusBadge status={med.status_validacao} />
                  </td>
                </tr>
              ))}
              {recentMedicoes.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Nenhuma medição encontrada</td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Carregando...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <motion.div 
      variants={{
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
      }}
      className="flex items-center gap-4 rounded-2xl bg-white p-6 shadow-sm border border-slate-100"
    >
      <div className={cn("rounded-xl p-3", color)}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-black text-slate-900">{value}</p>
      </div>
    </motion.div>
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
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold", config.color)}>
      <Icon size={14} />
      {config.label}
    </span>
  );
}
