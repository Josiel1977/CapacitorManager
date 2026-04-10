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
  XCircle 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
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
    reprovados: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentMedicoes, setRecentMedicoes] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      setLoading(true);
      
      const { count: clientesCount } = await supabase.from('clientes').select('*', { count: 'exact', head: true });
      const { count: bancosCount } = await supabase.from('bancos_capacitores').select('*', { count: 'exact', head: true });
      const { count: capacitoresCount } = await supabase.from('capacitores').select('*', { count: 'exact', head: true });
      const { count: medicoesCount } = await supabase.from('medicoes').select('*', { count: 'exact', head: true });
      
      const { data: statusData } = await supabase.from('medicoes').select('status_validacao, corrente_medida_a, tensao_medida_v');
      
      const statusCounts = (statusData || []).reduce((acc: any, curr: any) => {
        acc[curr.status_validacao] = (acc[curr.status_validacao] || 0) + 1;
        return acc;
      }, { aprovado: 0, atencao: 0, reprovado: 0 });

      const { data: recent } = await supabase
        .from('medicoes')
        .select('*, capacitores(codigo_identificacao), clientes(nome)')
        .order('created_at', { ascending: false })
        .limit(5);

      setStats({
        clientes: clientesCount || 0,
        bancos: bancosCount || 0,
        capacitores: capacitoresCount || 0,
        medicoes: medicoesCount || 0,
        aprovados: statusCounts.aprovado,
        atencao: statusCounts.atencao,
        reprovados: statusCounts.reprovado
      });
      setRecentMedicoes(recent || []);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
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
    <div className="space-y-8">
      {/* Hero Section */}
      <motion.section 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-primary p-8 text-white shadow-xl md:p-12"
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        
        <div className="relative z-10 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <span className="mb-4 inline-block rounded-full bg-secondary/20 px-4 py-1 text-xs font-bold uppercase tracking-widest text-secondary">
              CapacitorManager Pro
            </span>
            <h1 className="mb-4 text-3xl font-black md:text-5xl">
              Capacitores sob controle, resultados sob medida.
            </h1>
            <p className="text-lg text-slate-300">
              Gestão inteligente e precisa de bancos de capacitores para máxima eficiência industrial.
            </p>
          </motion.div>
        </div>
      </motion.section>

      {/* Stats Cards */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard icon={Users} label="Clientes" value={stats.clientes} color="bg-blue-600" />
        <StatCard icon={Database} label="Bancos" value={stats.bancos} color="bg-indigo-600" />
        <StatCard icon={Zap} label="Capacitores" value={stats.capacitores} color="bg-amber-600" />
        <StatCard icon={ClipboardCheck} label="Medições" value={stats.medicoes} color="bg-emerald-600" />
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
                    <StatusBadge status={med.status_validacao} />
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
      className="flex items-center gap-4 rounded-xl bg-white p-6 shadow-sm"
    >
      <div className={cn("rounded-lg p-3 text-white", color)}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-primary">{value}</p>
      </div>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    aprovado: { icon: CheckCircle2, color: 'text-success bg-success/10', label: 'Aprovado' },
    atencao: { icon: AlertTriangle, color: 'text-secondary bg-secondary/10', label: 'Atenção' },
    reprovado: { icon: XCircle, color: 'text-error bg-error/10', label: 'Reprovado' },
  };

  const config = configs[status] || configs.atencao;
  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", config.color)}>
      <Icon size={12} />
      {config.label}
    </span>
  );
}
