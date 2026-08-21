'use client';

import React, { useEffect, useState } from "react";
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
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import { countCurrentCapacitorStatuses } from "@/lib/current-capacitor-status";
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
import { calculateDeltaCapacitance, calculateExpectedCapacitorCurrent, classifyDeviation } from "@/lib/domain/capacitorAnalysis";
import { withTimeout } from "@/lib/with-timeout";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
);

export default function DashboardReal() {
  const [stats, setStats] = useState({
    clientes: 0,
    bancos: 0,
    capacitores: 0,
    medicoes: 0,
    aprovados: 0,
    atencao: 0,
    reprovados: 0,
    economiaTotal: 0,
    eficienciaGeral: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentMedicoes, setRecentMedicoes] = useState<any[]>([]);
  const [maxEconomiaMensal, setMaxEconomiaMensal] = useState(2500);
  const [fatorEficiencia, setFatorEficiencia] = useState(0.65);

  useEffect(() => {
    fetchStats();
  }, []);

  function recalcularMedicao(med: any) {
    let desvio = med.desvio_percentual;
    let status = med.status_validacao;
    const capacitor = med.capacitores;
    if (capacitor) {
      const tensao = capacitor.tensao_nominal_v;
      if (med.tipo_teste === "corrente" && med.corrente_medida_a) {
        const teorico = calculateExpectedCapacitorCurrent(
          capacitor.potencia_kvar,
          tensao,
          med.tensao_medida_v || tensao,
          60,
          med.frequencia_medida_hz || 60,
        );
        if (teorico > 0) {
          desvio = ((med.corrente_medida_a - teorico) / teorico) * 100;
          status = classifyDeviation(desvio);
        }
      } else if (med.tipo_teste === "capacitancia" && med.capacitancia_medida_uf) {
        const teorico = calculateDeltaCapacitance(capacitor.capacitancia_nominal_uf);
        if (teorico > 0) {
          desvio = ((med.capacitancia_medida_uf - teorico) / teorico) * 100;
          status = classifyDeviation(desvio);
        }
      }
    }
    return {
      ...med,
      desvio_percentual: desvio,
      status_validacao: status,
      tensao_capacitor: capacitor?.tensao_nominal_v,
      capacitor,
    };
  }

  async function fetchStats() {
    try {
      setLoading(true);
      const [clientesResult, bancosResult, capacitoresResult, medicoesResult, parametrosResult] = await withTimeout(
        Promise.all([
          supabase.from("clientes").select("id", { count: "exact", head: true }),
          supabase.from("bancos_capacitores").select("id", { count: "exact", head: true }),
          supabase.from("capacitores").select("id", { count: "exact", head: true }),
          supabase
            .from("medicoes")
            .select(
              `*, capacitores!inner(id, codigo_identificacao, potencia_kvar, capacitancia_nominal_uf, tensao_nominal_v), clientes(id, nome)`,
            )
            .order("created_at", { ascending: false }),
          supabase
            .from("parametros_sistema")
            .select("chave, valor")
            .in("chave", ["economia_max_mensal", "fator_eficiencia_capacitores"]),
        ]),
        12_000,
        "Tempo limite ao carregar o dashboard.",
      );

      const firstError = clientesResult.error
        || bancosResult.error
        || capacitoresResult.error
        || medicoesResult.error;
      if (firstError) throw firstError;

      const clientesCount = clientesResult.count;
      const bancosCount = bancosResult.count;
      const capacitoresCount = capacitoresResult.count;
      const medicoesData = medicoesResult.data;
      const parametros = new Map<string, number>(
        (parametrosResult.data || []).map((item) => [item.chave, Number(item.valor)] as const),
      );
      const configuredMax = parametros.get("economia_max_mensal");
      const configuredEfficiency = parametros.get("fator_eficiencia_capacitores");
      const currentMaxEconomia = Number.isFinite(configuredMax) ? configuredMax! : 2500;
      const currentFatorEficiencia = Number.isFinite(configuredEfficiency) ? configuredEfficiency! : 0.65;
      setMaxEconomiaMensal(currentMaxEconomia);
      setFatorEficiencia(currentFatorEficiencia);

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
          eficienciaGeral: 0,
        });
        setRecentMedicoes([]);
        setLoading(false);
        return;
      }

      const processed = medicoesData.map(recalcularMedicao);
      // Estado atual por ativo: usa a medição mais recente de cada tipo de teste
      // e conta cada capacitor uma única vez.
      const statusCounts = countCurrentCapacitorStatuses(processed);
      const totalMedicoes = processed.length;
      const totalCapacitoresAvaliados =
        statusCounts.aprovado + statusCounts.atencao + statusCounts.reprovado;
      const percAprovado = totalCapacitoresAvaliados
        ? statusCounts.aprovado / totalCapacitoresAvaliados
        : 0;

      const economiaEstimada = currentMaxEconomia * percAprovado * currentFatorEficiencia;

      const eficienciaGeral = totalCapacitoresAvaliados
        ? (statusCounts.aprovado / totalCapacitoresAvaliados) * 100
        : 0;

      setStats({
        clientes: clientesCount || 0,
        bancos: bancosCount || 0,
        capacitores: capacitoresCount || 0,
        medicoes: totalMedicoes,
        aprovados: statusCounts.aprovado,
        atencao: statusCounts.atencao,
        reprovados: statusCounts.reprovado,
        economiaTotal: economiaEstimada,
        eficienciaGeral,
      });
      setRecentMedicoes(processed.slice(0, 5));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível carregar o dashboard.';
      console.warn(`[Dashboard] ${message}`);
    } finally {
      setLoading(false);
    }
  }

  function formatDesvio(d: number) {
    return d === null || d === undefined
      ? "---"
      : `${d > 0 ? "+" : ""}${d.toFixed(2)}%`;
  }

  const pieData = {
    labels: ["Aprovado", "Atenção", "Reprovado"],
    datasets: [
      {
        data: [stats.aprovados, stats.atencao, stats.reprovados],
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
        data: [stats.clientes, stats.bancos, stats.capacitores, stats.medicoes],
        backgroundColor: "#0a2b3c",
      },
    ],
  };
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { staggerChildren: 0.1 },
  };
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  const softwareMessage = stats.reprovados === 1
    ? "⚠️ 1 capacitor apresenta reprovação no estado atual. Realize reteste técnico antes de decidir pela substituição."
    : stats.reprovados > 1
      ? `⚠️ ${stats.reprovados} capacitores apresentam reprovação no estado atual. Realize retestes técnicos e priorize a inspeção.`
      : stats.atencao > 0
        ? `⚠️ ${stats.atencao} capacitor(es) em atenção. Acompanhe a tendência e programe nova medição.`
        : "✅ Capacitores avaliados dentro dos limites configurados.";

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
              Monitore, valide e otimize seus bancos de capacitores com precisão
              técnica e relatórios profissionais.
            </p>
          </div>
          <div className="flex flex-col gap-4 min-w-[280px]">
            <div className="rounded-2xl bg-white/10 p-6 backdrop-blur-md border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-secondary/20 p-2">
                  <DollarSign className="text-secondary" size={20} />
                </div>
                <span className="text-sm font-medium text-white/70">
                  Economia Estimada
                </span>
              </div>
              <p className="text-3xl font-bold text-white">
                {formatCurrency(stats.economiaTotal)}
              </p>
              <p className="text-xs text-white/50 mt-1">
                Mensal (limite: R$ {maxEconomiaMensal.toFixed(0)}) | Eficiência:{" "}
                {(fatorEficiencia * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Indicadores de impacto */}
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
            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">
              LIVE
            </span>
          </div>
          <h3 className="text-sm font-medium text-slate-500 mb-1">
            Eficiência do Banco
          </h3>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-black text-slate-900">
              {stats.eficienciaGeral.toFixed(1)}%
            </p>
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
          className={cn(
            "rounded-2xl p-6 shadow-sm border",
            stats.reprovados > 0
              ? "bg-red-50 border-red-200"
              : "bg-white border-slate-100"
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <div className={cn(
              "rounded-xl p-3",
              stats.reprovados > 0 ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-600"
            )}>
              <Cpu size={24} />
            </div>
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "h-2 w-2 rounded-full",
                stats.reprovados > 0 ? "bg-red-500 animate-pulse" : "bg-blue-500 animate-ping"
              )} />
              <span className={cn(
                "text-xs font-bold",
                stats.reprovados > 0 ? "text-red-700" : "text-blue-600"
              )}>
                {stats.reprovados > 0 ? "ALERTA" : "ATIVO"}
              </span>
            </div>
          </div>
          <h3 className="text-sm font-medium text-slate-500 mb-1">
            Status do Sistema
          </h3>
          <p className="text-xl font-bold text-slate-900">
            {stats.reprovados > 0 ? "Confirmação técnica necessária" : "Otimização de Custos"}
          </p>
          <p className={cn(
            "text-xs mt-2 font-medium",
            stats.reprovados > 0 ? "text-red-700" : "text-slate-500"
          )}>
            {softwareMessage}
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
            <span className="text-xs font-bold bg-white/10 px-2 py-1 rounded-md">
              SISTEMA
            </span>
          </div>
          <h3 className="text-sm font-medium text-slate-300 mb-1">
            Capacitores Monitorados
          </h3>
          <p className="text-3xl font-black">{stats.capacitores}</p>
          <p className="text-xs text-slate-400 mt-2">
            Total em todos os bancos
          </p>
        </motion.div>
      </div>

      {/* Cards de estatísticas */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          icon={Users}
          label="Clientes Ativos"
          value={stats.clientes}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={Database}
          label="Bancos de Capacitores"
          value={stats.bancos}
          color="bg-purple-50 text-purple-600"
        />
        <StatCard
          icon={ClipboardCheck}
          label="Total de Medições"
          value={stats.medicoes}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          icon={TrendingUp}
          label="Taxa de Sucesso"
          value={`${stats.eficienciaGeral.toFixed(0)}%`}
          color="bg-amber-50 text-amber-600"
        />
      </motion.div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="rounded-xl bg-white p-6 shadow-sm"
        >
          <h2 className="mb-6 text-xl font-semibold text-primary">
            Distribuição de Status
          </h2>
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
          <h2 className="mb-6 text-xl font-semibold text-primary">
            Resumo Geral
          </h2>
          <div className="h-64">
            <Bar data={barData} options={{ maintainAspectRatio: false }} />
          </div>
        </motion.div>
      </div>

      {/* Tabela de últimas medições */}
      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        className="rounded-xl bg-white p-6 shadow-sm"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-primary">
            Últimas Medições
          </h2>
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
                  <td className="py-4">
                    {new Date(med.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="py-4 font-medium">
                    {med.clientes?.nome || "-"}
                  </td>
                  <td className="py-4 font-bold text-primary">
                    {med.capacitores?.codigo_identificacao || "-"}
                  </td>
                  <td className="py-4">
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">
                      ⚡{" "}
                      {med.tensao_capacitor ||
                        med.capacitores?.tensao_nominal_v ||
                        "?"}
                      V
                    </span>
                  </td>
                  <td className="py-4 capitalize">
                    {med.tipo_teste === "corrente" ? "Corrente" : "Capacitância"}
                  </td>
                  <td className="py-4">
                    <span
                      className={cn(
                        "font-bold",
                        med.desvio_percentual !== null &&
                          med.desvio_percentual > 0
                          ? "text-red-600"
                          : med.desvio_percentual !== null &&
                              med.desvio_percentual < 0
                            ? "text-amber-600"
                            : "text-slate-600",
                      )}
                    >
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
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Nenhuma medição encontrada
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Carregando...
                  </td>
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
        visible: { y: 0, opacity: 1 },
      }}
      className="flex items-center gap-4 rounded-2xl bg-white p-6 shadow-sm border border-slate-100"
    >
      <div className={cn("rounded-xl p-3", color)}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-2xl font-black text-slate-900">{value}</p>
      </div>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    aprovado: {
      icon: CheckCircle2,
      color: "bg-green-50 text-green-700",
      label: "✅ Aprovado",
    },
    atencao: {
      icon: AlertTriangle,
      color: "bg-amber-50 text-amber-700",
      label: "⚠️ Atenção",
    },
    reprovado: {
      icon: XCircle,
      color: "bg-red-50 text-red-700",
      label: "❌ Reprovado",
    },
  };
  const config = configs[status?.toLowerCase()] || configs.atencao;
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
        config.color,
      )}
    >
      <Icon size={14} />
      {config.label}
    </span>
  );
}
