'use client';

import React, { useEffect, useState, useCallback } from 'react';
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
  Activity
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { 
  calculateCorrenteTeorica, 
  calculateCapacitanciaTeoricaDelta, 
  getStatusValidacao,
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


  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      
      const { count: clientesCount } = await supabase.from('clientes').select('*', { count: 'exact', head: true });
      const { count: bancosCount } = await supabase.from('bancos_capacitores').select('*', { count: 'exact', head: true });
      const { count: capacitoresCount } = await supabase.from('capacitores').select('*', { count: 'exact', head: true });
      const { count: medicoesCount } = await supabase.from('medicoes').select('*', { count: 'exact', head: true });
      
      // Buscar todas as medições para recalcular estatísticas reais
      const { data: statusData } = await supabase
        .from('medicoes')
        .select(`
          *,
          capacitores(potencia_kvar, capacitancia_nominal_uf, tensao_nominal_v)
        `);
      
      // Processar e recalcular dados inconsistentes para o Dashboard
      const processedMedicoes = (statusData || []).map(med => {
        let desvio = med.desvio_percentual;
        let status = med.status_validacao;
        
        const precisaRecalcular = desvio === null || desvio === undefined || 
          (status === 'reprovado' && med.corrente_medida_a && med.corrente_teorica_a);
        
        if (precisaRecalcular) {
          if (med.tipo_teste === 'corrente' && med.corrente_medida_a && med.capacitores?.potencia_kvar) {
            const tensao = med.tensao_medida_v || med.capacitores.tensao_nominal_v;
            const teorica = calculateCorrenteTeorica(med.capacitores.potencia_kvar, tensao);
            desvio = ((med.corrente_medida_a - teorica) / teorica) * 100;
            status = getStatusValidacao(desvio);
          } else if (med.tipo_teste === 'capacitancia' && med.capacitancia_medida_uf && med.capacitores?.capacitancia_nominal_uf) {
            const teorica = calculateCapacitanciaTeoricaDelta(med.capacitores.capacitancia_nominal_uf);
            desvio = ((med.capacitancia_medida_uf - teorica) / teorica) * 100;
            status = getStatusValidacao(desvio);
          }
        }
        return { ...med, status_validacao: status, desvio_percentual: desvio };
      });

      const statusCounts = processedMedicoes.reduce((acc: any, curr: any) => {
        acc[curr.status_validacao] = (acc[curr.status_validacao] || 0) + 1;
        return acc;
      }, { aprovado: 0, atencao: 0, reprovado: 0 });

      // Cálculo de Economia Estimada (Simulado baseado em KVAR gerenciado)
      const totalKvarAprovado = processedMedicoes
        .filter(m => m.status_validacao === 'aprovado')
        .reduce((acc, m) => acc + (m.capacitores?.potencia_kvar || 0), 0);
      
      // Estimativa: Cada 1 KVAR aprovado economiza aprox. 0.5 kWh de perdas/multas por hora
      const economiaEstimada = totalKvarAprovado * 0.5 * 24 * 30 * 0.95;

      const eficiencia = medicoesCount && medicoesCount > 0 
        ? (statusCounts.aprovado / medicoesCount) * 100 
        : 0;

      const { data: recent } = await supabase
        .from('medicoes')
        .select('*, capacitores(codigo_identificacao), clientes(nome)')
        .order('created_at', { ascending: false })
        .limit(5);

      const processedRecent = (recent || []).map(med => {
        const found = processedMedicoes.find(pm => pm.id === med.id);
        return found ? { ...med, ...found } : med;
      });

      setStats({
        clientes: clientesCount || 0,
        bancos: bancosCount || 0,
        capacitores: capacitoresCount || 0,
        medicoes: medicoesCount || 0,
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
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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
      {/* Hero Section */}
      <motion.section 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-primary p-8 text-white shadow-xl md:p-16"
      >
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="max-w-2xl">
            <h1 className="mb-6 text-4xl font-bold leading-tight md:text-6xl">
              Gestão Inteligente de <span className="text-secondary">Capacitores</span>
            </h1>
            <p className="text-lg text-white/80 md:text-xl">
              Monitore, valide e otimize seus bancos de capacitores com precisão técnica e relatórios profissionais.
            </p>
          </div>

          <div className="flex flex-col gap-4 min-w-[280px]">
            <div className="rounded-2xl bg-white/10 p-6 backdrop-blur-md border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-secondary/20 p-2">
                  <DollarSign className="text-secondary" size={20} />
                </div>
                <span className="text-sm font-medium text-white/70">Economia Estimada</span>
              </div>
              <p className="text-3xl font-bold text-white">{formatCurrency(stats.economiaTotal)}</p>
              <p className="text-xs text-white/50 mt-1">Projeção mensal baseada em medições</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Stats Cards Grid */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard icon={Users} label="Clientes Ativos" value={stats.clientes} color="bg-blue-50 text-blue-600" />
        <StatCard icon={Database} label="Bancos de Capacitores" value={stats.bancos} color="bg-purple-50 text-purple-600" />
        <StatCard icon={ClipboardCheck} label="Total de Medições" value={stats.medicoes} color="bg-green-50 text-green-600" />
        <StatCard icon={TrendingUp} label="Taxa de Sucesso" value={`${stats.eficienciaGeral.toFixed(0)}%`} color="bg-amber-50 text-amber-600" />
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

      {/* Recent Medicoes */}
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
                <th className="pb-4">Tipo</th>
                <th className="pb-4">Desvio</th>
                <th className="pb-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentMedicoes.map((med) => (
                <tr key={med.id} className="text-sm text-slate-700">
                  <td className="py-4">{new Date(med.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="py-4 font-medium">{med.clientes?.nome}</td>
                  <td className="py-4">{med.capacitores?.codigo_identificacao}</td>
                  <td className="py-4 capitalize">{med.tipo_teste}</td>
                  <td className="py-4">
                    <span className={cn(
                      Number(med.desvio_percentual ?? 0) > 0 ? "text-blue-600" : 
                      Number(med.desvio_percentual ?? 0) < 0 ? "text-amber-600" : "text-slate-700"
                    )}>
                      {med.desvio_percentual !== null && med.desvio_percentual !== undefined
                        ? `${Number(med.desvio_percentual).toFixed(2)}%` 
                        : '---'}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={med.status_validacao} />
                      {med.status_validacao === 'aprovado' && (
                        <Zap size={14} className="text-yellow-500 fill-yellow-500" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {recentMedicoes.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">Nenhuma medição encontrada</td>
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
    aprovado: { icon: CheckCircle2, color: 'text-green-700 bg-green-50', label: '✅ Aprovado' },
    atencao: { icon: AlertTriangle, color: 'text-amber-700 bg-amber-50', label: '⚠️ Atenção' },
    reprovado: { icon: XCircle, color: 'text-red-700 bg-red-50', label: '❌ Reprovado' },
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
