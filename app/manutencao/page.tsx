"use client";

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Wrench,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  Zap,
  Droplets,
  DollarSign,
  RefreshCw,
  Eye,
  FileText,
  Download,
  Shield,
  Filter,
  BatteryWarning,
  Gauge,
  Building,
  Banknote,
  PieChart,
  Database,
  ClipboardList,
  AlertOctagon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import Swal from "sweetalert2";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { calculateDeltaCapacitance, calculateExpectedCapacitorCurrent, classifyDeviation } from "@/lib/domain/capacitorAnalysis";
import { withTimeout } from "@/lib/with-timeout";

interface CapacitorInfo {
  id: string;
  codigo: string;
  banco: string;
  banco_id: string;
  cliente: string;
  cliente_id: string;
  potencia_kvar: number;
  tensao_nominal_v: number;
  capacitancia_nominal_uf: number;
  status_validacao: string;
  ultimo_desvio: number;
  ultima_data: string;
  tem_medicao: boolean;
  data_ultima_medicao?: string;
}

interface ClienteResumo {
  id: string;
  nome: string;
  total_kvar_instalado: number;
  total_testado_kvar: number;
  aprovados: number;
  atencao: number;
  reprovados: number;
  sem_medicao: number;
  bancos: Array<{
    id: string;
    nome: string;
    kvar_instalado: number;
    aprovados: number;
    atencao: number;
    reprovados: number;
    sem_medicao: number;
  }>;
  capacitores_sem_medicao: CapacitorInfo[];
}

export default function ManutencaoPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [capacitores, setCapacitores] = useState<CapacitorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "todos" | "reprovado" | "atencao" | "sem_medicao"
  >("todos");
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteFiltro, setClienteFiltro] = useState<string>("todos");
  const [resumoClientes, setResumoClientes] = useState<ClienteResumo[]>([]);
  const [clienteSelecionadoResumo, setClienteSelecionadoResumo] =
    useState<ClienteResumo | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  // ... resto do código (agora sem `mode`)

  async function fetchDadosReais() {
    setLoading(true);
    try {
      const [bancosResult, capacitoresResult, medicoesResult, clientesResult] = await withTimeout(
        Promise.all([
          supabase.from("bancos_capacitores").select("id, nome_banco, cliente_id").eq("ativo", true),
          supabase.from("capacitores").select("id, codigo_identificacao, potencia_kvar, tensao_nominal_v, capacitancia_nominal_uf, banco_id").eq("ativo", true),
          // Usa * para manter compatibilidade com bases anteriores à inclusão
          // de frequencia_medida_hz. A data oficial da medição é created_at.
          supabase.from("medicoes").select("*").order("created_at", { ascending: false }),
          supabase.from("clientes").select("id, nome").eq("ativo", true).order("nome"),
        ]),
        15_000,
        "Tempo limite ao carregar a manutenção preditiva.",
      );
      const firstError = bancosResult.error || capacitoresResult.error || medicoesResult.error || clientesResult.error;
      if (firstError) throw firstError;

      const bancosData = bancosResult.data || [];
      const todosCapacitores = capacitoresResult.data || [];
      const medicoesData = medicoesResult.data || [];
      const clientesData = clientesResult.data || [];
      setClientes(clientesData);

      const bancosMap = new Map();
      bancosData.forEach((banco) =>
        bancosMap.set(banco.id, {
          nome: banco.nome_banco,
          cliente_id: banco.cliente_id,
        }),
      );

      // Mantém a medição mais recente de cada tipo para cada capacitor.
      const ultimasPorTipo = new Map<string, any>();
      const ultimasPorCapacitor = new Map<string, any[]>();
      medicoesData.forEach((med) => {
        if (!med.capacitor_id || !med.tipo_teste) return;
        const key = `${med.capacitor_id}:${med.tipo_teste}`;
        if (!ultimasPorTipo.has(key)) {
          ultimasPorTipo.set(key, med);
          const atuais = ultimasPorCapacitor.get(med.capacitor_id) || [];
          atuais.push(med);
          ultimasPorCapacitor.set(med.capacitor_id, atuais);
        }
      });

      const clientesMap = new Map();
      clientesData.forEach((c) => clientesMap.set(c.id, c.nome));

      const processedData: CapacitorInfo[] = [];
      for (const cap of todosCapacitores) {
        const medicoesAtuais = ultimasPorCapacitor.get(cap.id) || [];
        const temMedicao = medicoesAtuais.length > 0;
        const avaliadas = medicoesAtuais.map((med) => {
          let desvio = med.desvio_percentual || 0;
          let status = med.status_validacao || "atencao";
          if (
            med.tipo_teste === "corrente" &&
            med.corrente_medida_a !== null && med.corrente_medida_a !== undefined &&
            cap.tensao_nominal_v &&
            cap.potencia_kvar
          ) {
            const teorico = calculateExpectedCapacitorCurrent(
              cap.potencia_kvar,
              cap.tensao_nominal_v,
              med.tensao_medida_v || cap.tensao_nominal_v,
              60,
              med.frequencia_medida_hz || 60,
            );
            if (teorico > 0) {
              desvio = ((med.corrente_medida_a - teorico) / teorico) * 100;
              status = classifyDeviation(desvio);
            }
          } else if (
            med.tipo_teste === "capacitancia" &&
            med.capacitancia_medida_uf !== null && med.capacitancia_medida_uf !== undefined &&
            cap.capacitancia_nominal_uf
          ) {
            const teorico = calculateDeltaCapacitance(
              cap.capacitancia_nominal_uf,
            );
            if (teorico > 0) {
              desvio = ((med.capacitancia_medida_uf - teorico) / teorico) * 100;
              status = classifyDeviation(desvio);
            }
          }
          return { ...med, desvio_calculado: desvio, status_calculado: status };
        });
        const severidade: Record<string, number> = {
          aprovado: 0,
          atencao: 1,
          reprovado: 2,
        };
        const estadoAtual = avaliadas.sort(
          (a, b) =>
            (severidade[b.status_calculado] ?? 1) -
              (severidade[a.status_calculado] ?? 1) ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )[0];
        const ultimaData = avaliadas
          .map((med) => med.created_at)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
        const desvio = estadoAtual?.desvio_calculado ?? 0;
        const status = estadoAtual?.status_calculado ?? "sem_medicao";
        const bancoInfo = bancosMap.get(cap.banco_id);
        const clienteId = bancoInfo?.cliente_id;
        const clienteNome = clientesMap.get(clienteId) || "N/A";
        processedData.push({
          id: cap.id,
          codigo: cap.codigo_identificacao || "N/A",
          banco: bancoInfo?.nome || "N/A",
          banco_id: cap.banco_id || "",
          cliente: clienteNome,
          cliente_id: clienteId || "",
          potencia_kvar: cap.potencia_kvar || 0,
          tensao_nominal_v: cap.tensao_nominal_v || 0,
          capacitancia_nominal_uf: cap.capacitancia_nominal_uf || 0,
          status_validacao: status,
          ultimo_desvio: desvio,
          ultima_data: ultimaData || "",
          tem_medicao: temMedicao,
          data_ultima_medicao: ultimaData,
        });
      }
      setCapacitores(processedData);
      processarResumo(processedData);
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Não foi possível carregar os dados.";
      console.warn("[Manutenção] Não foi possível carregar os dados.", error);
      Swal.fire({
        title: "Erro",
        text: message,
        icon: "error",
        confirmButtonColor: "#0a2b3c",
      });
    } finally {
      setLoading(false);
    }
  }

  function processarResumo(data: CapacitorInfo[]) {
    const clientesResumo: Map<string, ClienteResumo> = new Map();
    for (const cap of data) {
      if (!clientesResumo.has(cap.cliente_id))
        clientesResumo.set(cap.cliente_id, {
          id: cap.cliente_id,
          nome: cap.cliente,
          total_kvar_instalado: 0,
          total_testado_kvar: 0,
          aprovados: 0,
          atencao: 0,
          reprovados: 0,
          sem_medicao: 0,
          bancos: [],
          capacitores_sem_medicao: [],
        });
      const resumo = clientesResumo.get(cap.cliente_id)!;
      resumo.total_kvar_instalado += cap.potencia_kvar;
      if (cap.tem_medicao) {
        resumo.total_testado_kvar += cap.potencia_kvar;
        if (cap.status_validacao === "aprovado") resumo.aprovados++;
        else if (cap.status_validacao === "atencao") resumo.atencao++;
        else if (cap.status_validacao === "reprovado") resumo.reprovados++;
      } else {
        resumo.sem_medicao++;
        resumo.capacitores_sem_medicao.push(cap);
      }
    }
    for (const [clienteId, resumo] of clientesResumo) {
      const bancosDoCliente = new Map();
      for (const cap of data.filter((c) => c.cliente_id === clienteId)) {
        if (!bancosDoCliente.has(cap.banco_id))
          bancosDoCliente.set(cap.banco_id, {
            id: cap.banco_id,
            nome: cap.banco,
            kvar_instalado: 0,
            aprovados: 0,
            atencao: 0,
            reprovados: 0,
            sem_medicao: 0,
          });
        const bancoResumo = bancosDoCliente.get(cap.banco_id);
        bancoResumo.kvar_instalado += cap.potencia_kvar;
        if (!cap.tem_medicao) bancoResumo.sem_medicao++;
        else if (cap.status_validacao === "aprovado") bancoResumo.aprovados++;
        else if (cap.status_validacao === "atencao") bancoResumo.atencao++;
        else if (cap.status_validacao === "reprovado") bancoResumo.reprovados++;
      }
      resumo.bancos = Array.from(bancosDoCliente.values());
    }
    const resumoArray = Array.from(clientesResumo.values()).filter(
      (r) => r.total_kvar_instalado > 0,
    );
    setResumoClientes(resumoArray);
  }

  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) {
      fetchDadosReais();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    setClienteSelecionadoResumo(
      clienteFiltro === "todos"
        ? null
        : resumoClientes.find((resumo) => resumo.id === clienteFiltro) || null,
    );
  }, [clienteFiltro, resumoClientes]);

  const filteredCapacitores = capacitores.filter((cap) => {
    if (clienteFiltro !== "todos" && cap.cliente_id !== clienteFiltro)
      return false;
    if (filter === "reprovado") return cap.status_validacao === "reprovado";
    if (filter === "atencao") return cap.status_validacao === "atencao";
    if (filter === "sem_medicao") return !cap.tem_medicao;
    return true;
  });

  const reprovados = capacitores.filter(
    (c) => c.status_validacao === "reprovado",
  ).length;
  const atencao = capacitores.filter(
    (c) => c.status_validacao === "atencao",
  ).length;
  const aprovados = capacitores.filter(
    (c) => c.status_validacao === "aprovado",
  ).length;
  const semMedicao = capacitores.filter((c) => !c.tem_medicao).length;

  if (authLoading || loading) {
    return (
      <div className="space-y-8 pb-12">
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl bg-slate-100"
            />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
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
            <span className="text-sm font-medium text-white/80">
              Manutenção Preditiva
            </span>
          </div>
          <h1 className="mb-4 text-4xl font-bold leading-tight md:text-5xl">
            Análise de <span className="text-secondary">Capacitores</span>
          </h1>
          <p className="text-lg text-white/80 md:text-xl max-w-2xl">
            Acompanhe a saúde dos seus capacitores baseado nas validações
            técnicas.
          </p>
        </div>
      </motion.section>

      {semMedicao > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-50 to-amber-100 rounded-2xl p-6 border border-amber-200"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500 rounded-lg text-white">
              <AlertOctagon size={22} />
            </div>
            <div>
              <h3 className="font-bold text-amber-800 text-lg">
                ⚠️ Capacitores Aguardando Teste
              </h3>
              <p className="text-sm text-amber-700">
                Existem {semMedicao} capacitores que ainda não foram testados.
                Realize os testes para obter análise completa.
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilter("sem_medicao")}
            className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
          >
            <ClipboardList size={16} /> Ver capacitores pendentes ({semMedicao})
          </button>
        </motion.div>
      )}

      {resumoClientes.length > 0 && clienteFiltro === "todos" && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-primary flex items-center gap-2">
            <Building size={20} /> Resumo por Cliente
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
                  <h3 className="font-bold text-primary text-lg">
                    {cliente.nome}
                  </h3>
                  {cliente.sem_medicao > 0 && (
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                      {cliente.sem_medicao} pendentes
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm">
                      kVAr Instalado:
                    </span>
                    <span className="font-bold text-primary text-xl">
                      {cliente.total_kvar_instalado.toFixed(1)} kVAr
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm">
                      kVAr Testados:
                    </span>
                    <span className="font-bold text-amber-600">
                      {cliente.total_testado_kvar.toFixed(1)} kVAr
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm">Cobertura:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{
                            width: `${(cliente.total_testado_kvar / cliente.total_kvar_instalado) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium">
                        {(
                          (cliente.total_testado_kvar /
                            cliente.total_kvar_instalado) *
                          100
                        ).toFixed(0)}
                        %
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-xs flex-wrap gap-2">
                  <span className="text-green-600">✅ {cliente.aprovados}</span>
                  <span className="text-amber-600">⚠️ {cliente.atencao}</span>
                  <span className="text-red-600">❌ {cliente.reprovados}</span>
                  {cliente.sem_medicao > 0 && (
                    <span className="text-slate-400">
                      📋 {cliente.sem_medicao} p/ testar
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {clienteSelecionadoResumo && clienteFiltro !== "todos" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-2xl p-6 border border-primary/20"
        >
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-primary">
                {clienteSelecionadoResumo.nome}
              </h2>
              <p className="text-slate-500">
                Análise completa baseada nas validações técnicas
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  router.push(`/capacitores?cliente_id=${clienteFiltro}`)
                }
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Eye size={16} /> Ver todos os capacitores
              </button>
              <button
                onClick={() => setClienteFiltro("todos")}
                className="text-sm text-primary hover:underline"
              >
                Voltar
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500">kVAr Instalado</p>
              <p className="text-2xl font-bold text-primary">
                {clienteSelecionadoResumo.total_kvar_instalado.toFixed(1)} kVAr
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500">kVAr Testados</p>
              <p className="text-2xl font-bold text-amber-600">
                {clienteSelecionadoResumo.total_testado_kvar.toFixed(1)} kVAr
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500">Cobertura</p>
              <p className="text-2xl font-bold text-green-600">
                {(
                  (clienteSelecionadoResumo.total_testado_kvar /
                    clienteSelecionadoResumo.total_kvar_instalado) *
                  100
                ).toFixed(0)}
                %
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500">Pendentes</p>
              <p className="text-2xl font-bold text-amber-600">
                {clienteSelecionadoResumo.sem_medicao}
              </p>
            </div>
          </div>

          {clienteSelecionadoResumo.capacitores_sem_medicao.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold text-amber-700 mb-3 flex items-center gap-2">
                <ClipboardList size={16} /> Capacitores que precisam ser
                testados (
                {clienteSelecionadoResumo.capacitores_sem_medicao.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-amber-50 text-xs font-medium text-amber-700">
                    <tr>
                      <th className="px-4 py-2">Código</th>
                      <th className="px-4 py-2">Banco</th>
                      <th className="px-4 py-2">Potência</th>
                      <th className="px-4 py-2">Tensão</th>
                      <th className="px-4 py-2">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clienteSelecionadoResumo.capacitores_sem_medicao.map(
                      (cap) => (
                        <tr
                          key={cap.id}
                          className="text-sm hover:bg-amber-50/30"
                        >
                          <td className="px-4 py-2 font-bold text-primary">
                            {cap.codigo}
                          </td>
                          <td className="px-4 py-2">{cap.banco}</td>
                          <td className="px-4 py-2">
                            {cap.potencia_kvar} kVAr
                          </td>
                          <td className="px-4 py-2">
                            {cap.tensao_nominal_v} V
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() =>
                                router.push(`/medicoes?capacitor_id=${cap.id}`)
                              }
                              className="px-3 py-1 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700 transition-colors"
                            >
                              Realizar Teste
                            </button>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <h3 className="font-bold text-primary mb-3 flex items-center gap-2">
              <Database size={16} /> Detalhamento por Banco de Capacitores
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-xs font-medium text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Banco</th>
                    <th className="px-4 py-2">kVAr Instalado</th>
                    <th className="px-4 py-2">Aprovados</th>
                    <th className="px-4 py-2">Atenção</th>
                    <th className="px-4 py-2">Reprovados</th>
                    <th className="px-4 py-2">Pendentes</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clienteSelecionadoResumo.bancos.map((banco) => (
                    <tr key={banco.id} className="text-sm">
                      <td className="px-4 py-2 font-medium">{banco.nome}</td>
                      <td className="px-4 py-2">
                        {banco.kvar_instalado.toFixed(1)} kVAr
                      </td>
                      <td className="px-4 py-2 text-green-600">
                        {banco.aprovados}
                      </td>
                      <td className="px-4 py-2 text-amber-600">
                        {banco.atencao}
                      </td>
                      <td className="px-4 py-2 text-red-600">
                        {banco.reprovados}
                      </td>
                      <td className="px-4 py-2 text-amber-600">
                        {banco.sem_medicao}
                      </td>
                      <td className="px-4 py-2">
                        {banco.sem_medicao > 0 ? (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                            Testes Pendentes
                          </span>
                        ) : banco.reprovados > 0 ? (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
                            Crítico
                          </span>
                        ) : banco.atencao > 0 ? (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                            Atenção
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                            Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Filtrar por Cliente
            </label>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 outline-none focus:border-primary"
              value={clienteFiltro}
              onChange={(e) => setClienteFiltro(e.target.value)}
            >
              <option value="todos">📋 Todos os clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  🏢 {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 items-end">
            <button
              onClick={() => setFilter("todos")}
              className={cn(
                "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                filter === "todos"
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              Todos ({filteredCapacitores.length})
            </button>
            <button
              onClick={() => setFilter("reprovado")}
              className={cn(
                "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                filter === "reprovado"
                  ? "bg-red-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              Reprovados ({reprovados})
            </button>
            <button
              onClick={() => setFilter("atencao")}
              className={cn(
                "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                filter === "atencao"
                  ? "bg-amber-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              Atenção ({atencao})
            </button>
            {semMedicao > 0 && (
              <button
                onClick={() => setFilter("sem_medicao")}
                className={cn(
                  "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  filter === "sem_medicao"
                    ? "bg-amber-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                Pendentes ({semMedicao})
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <XCircle size={22} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase">
              Reprovados
            </span>
          </div>
          <p className="text-3xl font-bold text-red-600">{reprovados}</p>
          <p className="text-xs text-red-500 mt-1">Substituição necessária</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <AlertTriangle size={22} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase">
              Atenção
            </span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{atencao}</p>
          <p className="text-xs text-amber-500 mt-1">Monitorar mensalmente</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <CheckCircle2 size={22} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase">
              Aprovados
            </span>
          </div>
          <p className="text-3xl font-bold text-green-600">{aprovados}</p>
          <p className="text-xs text-green-500 mt-1">Dentro da especificação</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <ClipboardList size={22} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase">
              Pendentes
            </span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{semMedicao}</p>
          <p className="text-xs text-amber-500 mt-1">Aguardando teste</p>
        </div>
      </div>

      {filteredCapacitores.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-3">Código</th>
                  <th className="px-5 py-3">Cliente / Banco</th>
                  <th className="px-5 py-3">Potência</th>
                  <th className="px-5 py-3">Desvio</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCapacitores.map((cap) => (
                  <tr key={cap.id} className="text-sm hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-primary">
                      {cap.codigo}
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium">{cap.cliente}</div>
                      <div className="text-xs text-slate-400">{cap.banco}</div>
                    </td>
                    <td className="px-5 py-3">
                      {cap.potencia_kvar.toFixed(1)} kVAr
                    </td>
                    <td className="px-5 py-3">
                      {cap.tem_medicao ? (
                        <span
                          className={cn(
                            "font-bold",
                            cap.ultimo_desvio > 0
                              ? "text-red-500"
                              : "text-green-500",
                          )}
                        >
                          {cap.ultimo_desvio > 0 ? "+" : ""}
                          {cap.ultimo_desvio.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-amber-600 font-medium">
                          Não testado
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {!cap.tem_medicao ? (
                        <span className="px-2 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-700">
                          PENDENTE
                        </span>
                      ) : cap.status_validacao === "reprovado" ? (
                        <span className="px-2 py-1 text-xs font-bold rounded-full bg-red-100 text-red-700">
                          REPROVADO
                        </span>
                      ) : cap.status_validacao === "atencao" ? (
                        <span className="px-2 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-700">
                          ATENÇÃO
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-bold rounded-full bg-green-100 text-green-700">
                          APROVADO
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {!cap.tem_medicao ? (
                        <button
                          onClick={() =>
                            router.push(`/medicoes?capacitor_id=${cap.id}`)
                          }
                          className="px-3 py-1 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700 transition-colors"
                        >
                          Realizar Teste
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            router.push(`/historico?capacitor_id=${cap.id}`)
                          }
                          className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-lg hover:bg-primary/20 transition-colors"
                        >
                          Ver Histórico
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-100">
          <Wrench size={48} className="mx-auto mb-3 opacity-50" />
          <p>Nenhum capacitor encontrado com o filtro selecionado</p>
        </div>
      )}

      <div className="flex justify-end gap-2">
  <button onClick={fetchDadosReais} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
    <RefreshCw size={16} /> Atualizar
  </button>
</div>
    </div>
  );
}
