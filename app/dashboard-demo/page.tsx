'use client';

import React from "react";
import { motion } from "motion/react";
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
  ArrowUpRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Bar, Pie } from "react-chartjs-2";
import { cn } from "@/lib/utils";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
);

// Dados mockados para demonstração
const mockStats = {
  clientes: 8,
  bancos: 12,
  capacitores: 45,
  medicoes: 156,
  aprovados: 112,
  atencao: 32,
  reprovados: 12,
  economiaTotal: 1850, // R$ 1.850,00
  eficienciaGeral: 71.8,
};

export default function DashboardDemo() {
  const pieData = {
    labels: ["Aprovado", "Atenção", "Reprovado"],
    datasets: [
      {
        data: [mockStats.aprovados, mockStats.atencao, mockStats.reprovados],
        backgroundColor: ["#2ecc71", "#f39c12", "#e74c3c"],
        borderWidth: 0,
      },
    ],
  };
  const barData = {
    labels: ["Clientes", "Bancos", "Capacitores", "Medições"],
    datasets: [
      {
        label: "Total",
        data: [mockStats.clientes, mockStats.bancos, mockStats.capacitores, mockStats.medicoes],
        backgroundColor: "#0a2b3c",
      },
    ],
  };

  const iaMessage = mockStats.reprovados === 1
    ? "IA sugere trocar 1 capacitor para evitar multas."
    : mockStats.reprovados > 1
    ? `IA sugere trocar ${mockStats.reprovados} capacitores para evitar multas.`
    : "IA analisando 24/7 para manter o fator de potência ideal.";

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
              Gestão Inteligente de{" "}
              <span className="text-secondary">Capacitores</span>
            </h1>
            <p className="text-lg text-white/80 md:text-xl">
              Versão demonstrativa. Conecte-se para ver dados reais.
            </p>
          </div>
          <div className="flex flex-col gap-4 min-w-[280px]">
            <div className="rounded-2xl bg-white/10 p-6 backdrop-blur-md border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-secondary/20 p-2">
                  <DollarSign className="text-secondary" size={20} />
                </div>
                <span className="text-sm font-medium text-white/70">
                  Economia Estimada (demo)
                </span>
              </div>
              <p className="text-3xl font-bold text-white">
                {formatCurrency(mockStats.economiaTotal)}
              </p>
              <p className="text-xs text-white/50 mt-1">
                Mensal (simulação realista)
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Indicadores de impacto */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* ... similar ao DashboardReal, mas com dados mockados ... */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="rounded-xl bg-green-50 p-3 text-green-600"><Activity size={24} /></div>
            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">DEMO</span>
          </div>
          <h3 className="text-sm font-medium text-slate-500 mb-1">Eficiência do Banco</h3>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-black text-slate-900">{mockStats.eficienciaGeral.toFixed(1)}%</p>
            <ArrowUpRight className="text-green-500 mb-1" size={20} />
          </div>
          <div className="mt-4 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500" style={{ width: `${mockStats.eficienciaGeral}%` }} />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600"><Cpu size={24} /></div>
            <div className="flex items-center gap-1.5"><div className="h-2 w-2 animate-ping rounded-full bg-blue-500" /><span className="text-xs font-bold text-blue-600">DEMO</span></div>
          </div>
          <h3 className="text-sm font-medium text-slate-500 mb-1">Status do Cérebro</h3>
          <p className="text-xl font-bold text-slate-900">{mockStats.reprovados > 0 ? "Manutenção Necessária" : "Otimização de Custos"}</p>
          <p className="text-xs text-slate-500 mt-2">{iaMessage}</p>
        </div>

        <div className="rounded-2xl bg-primary p-6 shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="rounded-xl bg-white/10 p-3"><Zap size={24} /></div>
            <span className="text-xs font-bold bg-white/10 px-2 py-1 rounded-md">DEMO</span>
          </div>
          <h3 className="text-sm font-medium text-slate-300 mb-1">Capacitores Monitorados</h3>
          <p className="text-3xl font-black">{mockStats.capacitores}</p>
          <p className="text-xs text-slate-400 mt-2">Total em todos os bancos</p>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-4 rounded-2xl bg-white p-6 shadow-sm border border-slate-100"><div className="rounded-xl p-3 bg-blue-50 text-blue-600"><Users size={24} /></div><div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Clientes Ativos</p><p className="text-2xl font-black text-slate-900">{mockStats.clientes}</p></div></div>
        <div className="flex items-center gap-4 rounded-2xl bg-white p-6 shadow-sm border border-slate-100"><div className="rounded-xl p-3 bg-purple-50 text-purple-600"><Database size={24} /></div><div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Bancos de Capacitores</p><p className="text-2xl font-black text-slate-900">{mockStats.bancos}</p></div></div>
        <div className="flex items-center gap-4 rounded-2xl bg-white p-6 shadow-sm border border-slate-100"><div className="rounded-xl p-3 bg-green-50 text-green-600"><ClipboardCheck size={24} /></div><div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total de Medições</p><p className="text-2xl font-black text-slate-900">{mockStats.medicoes}</p></div></div>
        <div className="flex items-center gap-4 rounded-2xl bg-white p-6 shadow-sm border border-slate-100"><div className="rounded-xl p-3 bg-amber-50 text-amber-600"><TrendingUp size={24} /></div><div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Taxa de Sucesso</p><p className="text-2xl font-black text-slate-900">{mockStats.eficienciaGeral.toFixed(0)}%</p></div></div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm"><h2 className="mb-6 text-xl font-semibold text-primary">Distribuição de Status</h2><div className="flex h-64 justify-center"><Pie data={pieData} options={{ maintainAspectRatio: false }} /></div></div>
        <div className="rounded-xl bg-white p-6 shadow-sm"><h2 className="mb-6 text-xl font-semibold text-primary">Resumo Geral</h2><div className="h-64"><Bar data={barData} options={{ maintainAspectRatio: false }} /></div></div>
      </div>
    </div>
  );
}
