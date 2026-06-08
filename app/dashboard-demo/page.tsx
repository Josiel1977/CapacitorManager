'use client';

import React from 'react';
import { motion } from 'motion/react';
import { 
  Users, Database, Zap, ClipboardCheck, TrendingUp, 
  CheckCircle2, AlertTriangle, XCircle, DollarSign,
  Activity, Cpu, ArrowUpRight
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Bar, Pie } from 'react-chartjs-2';
import { cn } from '@/lib/utils';
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// Dados de demonstração
const MOCK_STATS = {
  clientes: 12,
  bancos: 8,
  capacitores: 47,
  medicoes: 156,
  aprovados: 38,
  atencao: 7,
  reprovados: 2,
  economiaTotal: 12500,
  eficienciaGeral: 87.5
};

const MOCK_MEDICOES = [
  { id: 1, created_at: '2024-03-15T10:00:00', clientes: { nome: 'Indústria ABC' }, capacitores: { codigo_identificacao: 'CAP-001', tensao_nominal_v: 480 }, tipo_teste: 'corrente', desvio_percentual: 3.2, status_validacao: 'aprovado' },
  { id: 2, created_at: '2024-03-14T14:30:00', clientes: { nome: 'Shopping Center' }, capacitores: { codigo_identificacao: 'CAP-002', tensao_nominal_v: 380 }, tipo_teste: 'capacitancia', desvio_percentual: -2.5, status_validacao: 'aprovado' },
  { id: 3, created_at: '2024-03-13T09:15:00', clientes: { nome: 'Hospital Regional' }, capacitores: { codigo_identificacao: 'CAP-003', tensao_nominal_v: 220 }, tipo_teste: 'corrente', desvio_percentual: 12.8, status_validacao: 'atencao' },
  { id: 4, created_at: '2024-03-12T16:45:00', clientes: { nome: 'Indústria ABC' }, capacitores: { codigo_identificacao: 'CAP-004', tensao_nominal_v: 480 }, tipo_teste: 'capacitancia', desvio_percentual: -8.2, status_validacao: 'atencao' },
  { id: 5, created_at: '2024-03-11T11:00:00', clientes: { nome: 'Condomínio Comercial' }, capacitores: { codigo_identificacao: 'CAP-005', tensao_nominal_v: 380 }, tipo_teste: 'corrente', desvio_percentual: -12.5, status_validacao: 'reprovado' }
];

function formatDesvio(desvio: number): string {
  if (desvio === null || desvio === undefined) return '---';
  return `${desvio > 0 ? '+' : ''}${desvio.toFixed(2)}%`;
}

const pieData = {
  labels: ['Aprovado', 'Atenção', 'Reprovado'],
  datasets: [{ data: [MOCK_STATS.aprovados, MOCK_STATS.atencao, MOCK_STATS.reprovados], backgroundColor: ['#2ecc71', '#f39c12', '#e74c3c'], borderWidth: 0 }],
};

const barData = {
  labels: ['Clientes', 'Bancos', 'Capacitores', 'Medições'],
  datasets: [{ label: 'Total', data: [MOCK_STATS.clientes, MOCK_STATS.bancos, MOCK_STATS.capacitores, MOCK_STATS.medicoes], backgroundColor: '#0a2b3c' }],
};

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    aprovado: { icon: CheckCircle2, color: 'bg-green-50 text-green-700', label: '✅ Aprovado' },
    atencao: { icon: AlertTriangle, color: 'bg-amber-50 text-amber-700', label: '⚠️ Atenção' },
    reprovado: { icon: XCircle, color: 'bg-red-50 text-red-700', label: '❌ Reprovado' },
  };
  const config = configs[status] || configs.atencao;
  const Icon = config.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold", config.color)}>
      <Icon size={14} />
      {config.label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <motion.div variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }} className="flex items-center gap-4 rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
      <div className={cn("rounded-xl p-3", color)}><Icon size={24} /></div>
      <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p><p className="text-2xl font-black text-slate-900">{value}</p></div>
    </motion.div>
  );
}

export default function DashboardDemo() {
  return (
    <div className="space-y-8 pb-12">
      <motion.section initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl bg-primary p-8 text-white shadow-xl md:p-16">
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="max-w-2xl">
            <h1 className="mb-6 text-4xl font-bold leading-tight md:text-6xl">Gestão Inteligente de <span className="text-secondary">Capacitores</span></h1>
            <p className="text-lg text-white/80 md:text-xl">Monitore, valide e otimize seus bancos de capacitores com precisão técnica e relatórios profissionais.</p>
          </div>
          <div className="flex flex-col gap-4 min-w-[280px]">
            <div className="rounded-2xl bg-white/10 p-6 backdrop-blur-md border border-white/10">
              <div className="flex items-center gap-3 mb-2"><div className="rounded-lg bg-secondary/20 p-2"><DollarSign className="text-secondary" size={20} /></div><span className="text-sm font-medium text-white/70">Economia Estimada</span></div>
              <p className="text-3xl font-bold text-white">{formatCurrency(MOCK_STATS.economiaTotal)}</p>
              <p className="text-xs text-white/50 mt-1">Projeção mensal baseada em medições</p>
            </div>
          </div>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4"><div className="rounded-xl bg-green-50 p-3 text-green-600"><Activity size={24} /></div><span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">LIVE</span></div>
          <h3 className="text-sm font-medium text-slate-500 mb-1">Eficiência do Banco</h3>
          <div className="flex items-end gap-2"><p className="text-3xl font-black text-slate-900">{MOCK_STATS.eficienciaGeral.toFixed(1)}%</p><ArrowUpRight className="text-green-500 mb-1" size={20} /></div>
          <div className="mt-4 h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${MOCK_STATS.eficienciaGeral}%` }} /></div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4"><div className="rounded-xl bg-blue-50 p-3 text-blue-600"><Cpu size={24} /></div><div className="flex items-center gap-1.5"><div className="h-2 w-2 animate-ping rounded-full bg-blue-500" /><span className="text-xs font-bold text-blue-600">ATIVO</span></div></div>
          <h3 className="text-sm font-medium text-slate-500 mb-1">Status do Cérebro</h3>
          <p className="text-xl font-bold text-slate-900">{MOCK_STATS.reprovados > 0 ? 'Manutenção Necessária' : 'Otimização de Custos'}</p>
          <p className="text-xs text-slate-500 mt-2">{MOCK_STATS.reprovados > 0 ? `IA sugere trocar ${MOCK_STATS.reprovados} capacitores para evitar multas.` : 'IA analisando 24/7 para manter o fator de potência ideal.'}</p>
        </div>
        <div className="rounded-2xl bg-primary p-6 shadow-lg text-white">
          <div className="flex items-center justify-between mb-4"><div className="rounded-xl bg-white/10 p-3"><Zap size={24} /></div><span className="text-xs font-bold bg-white/10 px-2 py-1 rounded-md">SISTEMA</span></div>
          <h3 className="text-sm font-medium text-slate-300 mb-1">Capacitores Monitorados</h3>
          <p className="text-3xl font-black">{MOCK_STATS.capacitores}</p>
          <p className="text-xs text-slate-400 mt-2">Total em todos os bancos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Clientes Ativos" value={MOCK_STATS.clientes} color="bg-blue-50 text-blue-600" />
        <StatCard icon={Database} label="Bancos de Capacitores" value={MOCK_STATS.bancos} color="bg-purple-50 text-purple-600" />
        <StatCard icon={ClipboardCheck} label="Total de Medições" value={MOCK_STATS.medicoes} color="bg-green-50 text-green-600" />
        <StatCard icon={TrendingUp} label="Taxa de Sucesso" value={`${MOCK_STATS.eficienciaGeral.toFixed(0)}%`} color="bg-amber-50 text-amber-600" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm"><h2 className="mb-6 text-xl font-semibold text-primary">Distribuição de Status</h2><div className="flex h-64 justify-center"><Pie data={pieData} options={{ maintainAspectRatio: false }} /></div></div>
        <div className="rounded-xl bg-white p-6 shadow-sm"><h2 className="mb-6 text-xl font-semibold text-primary">Resumo Geral</h2><div className="h-64"><Bar data={barData} options={{ maintainAspectRatio: false }} /></div></div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-semibold text-primary">Últimas Medições</h2><TrendingUp className="text-slate-400" /></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="border-b border-slate-100 text-sm font-medium text-slate-500"><th className="pb-4">Data</th><th className="pb-4">Cliente</th><th className="pb-4">Capacitor</th><th className="pb-4">Tensão</th><th className="pb-4">Tipo</th><th className="pb-4">Desvio</th><th className="pb-4">Status</th></tr></thead>
            <tbody className="divide-y divide-slate-50">
              {MOCK_MEDICOES.map((med) => (
                <tr key={med.id} className="text-sm text-slate-700"><td className="py-4">{new Date(med.created_at).toLocaleDateString('pt-BR')}</td><td className="py-4 font-medium">{med.clientes.nome}</td><td className="py-4 font-bold text-primary">{med.capacitores.codigo_identificacao}</td><td className="py-4"><span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">⚡ {med.capacitores.tensao_nominal_v}V</span></td><td className="py-4 capitalize">{med.tipo_teste === 'corrente' ? 'Corrente' : 'Capacitância'}</td><td className="py-4"><span className={cn("font-bold", med.desvio_percentual > 0 ? "text-red-600" : med.desvio_percentual < 0 ? "text-amber-600" : "text-slate-600")}>{formatDesvio(med.desvio_percentual)}</span></td><td className="py-4"><StatusBadge status={med.status_validacao} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-center"><a href="/demo" className="text-sm text-primary hover:underline">Experimente o simulador de validação →</a></div>
      </div>
    </div>
  );
}

