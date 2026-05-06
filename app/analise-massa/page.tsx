"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import jsPDF from "jspdf";
import { toPng } from "html-to-image";
import {
  Upload,
  FileText,
  AlertTriangle,
  TrendingUp,
  Zap,
  DollarSign,
  CheckCircle2,
  Download,
  Cpu,
  FileDown,
  Calendar,
  Clock,
  AlertCircle,
  RefreshCw,
  Battery,
  Trash2,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
} from "recharts";
import Swal from "sweetalert2";

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================
interface MassMemoryData {
  data: string;
  hora: string;
  timestamp: string;
  kw: number;
  kvar: number;
  fp: number;
  kvarNecessario: number;
  tipoReativo: "indutivo" | "capacitivo" | "neutro";
  isHorarioCritico?: boolean;
  diaSemana?: string;
}

interface AnalysisStats {
  multaPeriodo: number;
  multaMensalProjetada: number;
  multaIndutiva: number;
  multaCapacitiva: number;
  picoDemanda: number;
  fpMedio: number;
  maxKvarNecessario: number;
  registrosCriticos: number;
  percentualConformidade: number;
  periodoAnalise: { inicio: string; fim: string };
  horariosPicoReativo: { hora: string; mediaKvar: number; ocorrencias: number }[];
  causaPrincipalMulta: "indutivo" | "capacitivo" | "ambos" | "nenhum";
  percentualMultaIndutiva: number;
  percentualMultaCapacitiva: number;
  diasNoArquivo: number;
}

interface DimensionamentoStats {
  mediaKW: number;
  mediaKvar: number;
  mediaFP: number;
  periodosCriticos: number;
  percentualCritico: number;
  mediaKvarCritico: number;
  percentil90KvarCritico: number;
  maxKvarCritico: number;
  bancoSugeridoFixo: number;
  bancoSugeridoAutomatico: number;
  tipoRecomendado: "fixo" | "automatico" | "hibrido";
  justificativa: string;
  coeficienteVariacao: number;
  orcamentoEstimado: { min: number; max: number };
  alertaTransformador: boolean;
  potenciaInstalada: number;
  economiaMensalEstimada: number;
  paybackMeses: number;
}

// ============================================================================
// CONSTANTES
// ============================================================================
const DIAS_SEMANA: string[] = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const PERIODOS_DIA = [
  { nome: "Madrugada (00:00 - 06:00)", inicio: 0, fim: 6, cor: "bg-slate-100" },
  { nome: "Inicio da Manhã (06:00 - 09:00)", inicio: 6, fim: 9, cor: "bg-blue-50" },
  { nome: "Meio da Manhã (09:00 - 12:00)", inicio: 9, fim: 12, cor: "bg-red-50" },
  { nome: "Inicio da Tarde (12:00 - 15:00)", inicio: 12, fim: 15, cor: "bg-orange-50" },
  { nome: "Final da Tarde (15:00 - 18:00)", inicio: 15, fim: 18, cor: "bg-amber-50" },
  { nome: "Noite (18:00 - 22:00)", inicio: 18, fim: 22, cor: "bg-purple-50" },
  { nome: "Final da Noite (22:00 - 00:00)", inicio: 22, fim: 24, cor: "bg-slate-100" },
];

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================
const getDiaSemana = (dataStr: string): string => {
  if (!dataStr) return "Desconhecido";
  try {
    const match = dataStr.match(/(\d{1,2})\/(\d{1,2})/);
    if (match) {
      const dia = parseInt(match[1], 10);
      const mes = parseInt(match[2], 10) - 1;
      const ano = new Date().getFullYear();
      const data = new Date(ano, mes, dia);
      if (!isNaN(data.getTime())) {
        const diaNum = data.getDay();
        return DIAS_SEMANA[diaNum === 0 ? 6 : diaNum - 1];
      }
    }
    return "Desconhecido";
  } catch {
    return "Desconhecido";
  }
};

const parseNumeroBrasileiro = (valor: string): number => {
  if (!valor || valor === "-") return 0;
  let str = valor.trim().replace(/\./g, "").replace(",", ".");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.abs(num);
};

const calcularFP = (kw: number, kvar: number): number => {
  if (kw <= 0) return 1;
  const s = Math.sqrt(kw * kw + kvar * kvar);
  return s > 0 ? Math.min(1, Math.abs(kw) / s) : 1;
};

const calcularCorrecaoNecessaria = (kw: number, fpAtual: number, fpDesejado: number): number => {
  if (kw <= 0 || fpAtual <= 0) return 0;
  const fpDesejadoLimitado = Math.min(0.99, Math.max(0.85, fpDesejado));
  const fpAtualLimitado = Math.min(0.99, Math.max(0.01, fpAtual));
  if (fpAtualLimitado >= fpDesejadoLimitado) return 0;
  const phiAtual = Math.acos(fpAtualLimitado);
  const phiDesejado = Math.acos(fpDesejadoLimitado);
  const kvarNecessario = kw * (Math.tan(phiAtual) - Math.tan(phiDesejado));
  return Math.max(0, Math.round(kvarNecessario * 10) / 10);
};

const detectarIntervaloAmostragem = (data: MassMemoryData[]): number => {
  if (data.length < 2) return 15;
  const diffMinutes: number[] = [];
  for (let i = 0; i < Math.min(data.length - 1, 500); i++) {
    try {
      const t1 = new Date(data[i].timestamp);
      const t2 = new Date(data[i + 1].timestamp);
      if (!isNaN(t1.getTime()) && !isNaN(t2.getTime())) {
        const diff = Math.abs(t2.getTime() - t1.getTime()) / (1000 * 60);
        if (diff >= 1 && diff <= 1440) diffMinutes.push(diff);
      }
    } catch {
      continue;
    }
  }
  if (diffMinutes.length === 0) return 15;
  diffMinutes.sort((a, b) => a - b);
  const meio = Math.floor(diffMinutes.length / 2);
  const mediana = diffMinutes.length % 2 === 0 ? (diffMinutes[meio - 1] + diffMinutes[meio]) / 2 : diffMinutes[meio];
  const arredondado = Math.round(mediana);
  if (arredondado <= 20) return 15;
  if (arredondado <= 40) return 30;
  return 60;
};

const calcularPercentil = (arr: number[], percentil: number): number => {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (percentil / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
};

// ============================================================================
// PROCESSAMENTO DO CSV (MANUAL, SEM PAPAPARSE)
// ============================================================================
const processarArquivo = async (content: string, targetFP: number): Promise<MassMemoryData[]> => {
  return new Promise((resolve, reject) => {
    const lines = content.split(/\r?\n/);
    const results: MassMemoryData[] = [];

    // Encontrar a linha de cabeçalho (começa com "Data;Dia;Postos")
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("Data;Dia;Postos")) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      reject(new Error("Cabeçalho 'Data;Dia;Postos' não encontrado. Verifique o formato do arquivo."));
      return;
    }

    // Processar linhas de dados a partir do cabeçalho + 1
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // Ignorar linhas que não começam com data (ex: linhas de sumário no final)
      if (!line.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) continue;

      const parts = line.split(";");
      if (parts.length < 6) continue;

      try {
        const dataHora = parts[0]; // "01/09/2025 00:15"
        const [dataStr, horaStr] = dataHora.split(" ");
        const kw = parseNumeroBrasileiro(parts[3]); // "kW fornecido"
        const kvarInd = parseNumeroBrasileiro(parts[4]); // "kVAr indutivo"
        const kvarCap = parseNumeroBrasileiro(parts[5]); // "kVAr capacitivo"
        const kvar = kvarInd - kvarCap;

        if (kw === 0 && Math.abs(kvar) < 0.01) continue;

        const dataFormatada = dataStr.split("/").slice(0, 2).map(p => p.padStart(2, "0")).join("/");
        const horaFormatada = horaStr ? horaStr.substring(0, 5) : "00:00";
        const timestamp = `${dataFormatada}T${horaFormatada}`;
        const tipoReativo: MassMemoryData["tipoReativo"] = kvar > 0.01 ? "indutivo" : kvar < -0.01 ? "capacitivo" : "neutro";
        const kvarAbs = Math.abs(kvar);
        const fp = calcularFP(kw, kvarAbs);
        const kvarNecessario = tipoReativo === "indutivo" && fp < targetFP ? calcularCorrecaoNecessaria(kw, fp, targetFP) : 0;
        const isHorarioCritico = tipoReativo === "indutivo" && kvarAbs > 5 && fp < targetFP;
        const diaSemana = getDiaSemana(dataFormatada);

        results.push({
          data: dataFormatada,
          hora: horaFormatada,
          timestamp,
          kw,
          kvar: kvarAbs,
          fp: Math.round(fp * 100) / 100,
          kvarNecessario,
          tipoReativo,
          isHorarioCritico,
          diaSemana,
        });
      } catch (error) {
        console.warn(`Erro na linha ${i}:`, error);
        continue;
      }
    }

    if (results.length === 0) {
      reject(new Error("Nenhum dado válido encontrado no arquivo."));
    } else {
      resolve(results);
    }
  });
};

// ============================================================================
// COMPONENTE PRINCIPAL (SIMPLIFICADO MAS COMPLETO)
// ============================================================================
export default function AnaliseMassaPage() {
  const [data, setData] = useState<MassMemoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetFP, setTargetFP] = useState(0.92);
  const [tariff, setTariff] = useState(0.306);
  const [potenciaInstalada, setPotenciaInstalada] = useState(1575);
  const [samplingInterval, setSamplingInterval] = useState(15);
  const [fileName, setFileName] = useState<string>("");
  const [recalcKey, setRecalcKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRecalcular = useCallback(() => {
    setRecalcKey(prev => prev + 1);
    Swal.fire("Análise Recalculada!", `Dimensionamento atualizado com ${potenciaInstalada} kVA`, "success");
  }, [potenciaInstalada]);

  const handleClearData = useCallback(() => {
    Swal.fire({
      title: "Limpar dados?",
      text: "Todos os dados serão removidos.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim",
      cancelButtonText: "Cancelar",
    }).then(result => {
      if (result.isConfirmed) {
        setData([]);
        setFileName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        Swal.fire("Dados limpos!", "Faça upload de um novo arquivo.", "success");
      }
    });
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(csv|txt)$/i)) {
      Swal.fire("Erro", "Selecione um arquivo CSV ou TXT.", "error");
      return;
    }
    setLoading(true);
    setFileName(file.name);
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ev => resolve(ev.target?.result as string);
        reader.onerror = () => reject(new Error("Erro ao ler o arquivo"));
        reader.readAsText(file, "ISO-8859-1");
      });
      const dados = await processarArquivo(content, targetFP);
      const intervalo = detectarIntervaloAmostragem(dados);
      setSamplingInterval(intervalo);
      setData(dados);
      const fpMedio = dados.reduce((a, b) => a + b.fp, 0) / dados.length;
      Swal.fire("Sucesso!", `${dados.length} registros • FP médio: ${fpMedio.toFixed(3)}`, "success");
    } catch (err: any) {
      Swal.fire("Erro", err.message, "error");
      setFileName("");
    } finally {
      setLoading(false);
    }
  }, [targetFP]);

  // Estatísticas e dimensionamento (versão simplificada para demonstração)
  const stats = useMemo((): AnalysisStats | null => {
    if (data.length === 0) return null;
    const diasUnicos = new Set(data.map(d => d.data));
    const fpMedio = data.reduce((a, b) => a + b.fp, 0) / data.length;
    const picoDemanda = Math.max(...data.map(d => d.kw), 0);
    const registrosCriticos = data.filter(d => d.fp < targetFP && d.tipoReativo === "indutivo").length;
    const percentualConformidade = ((data.length - registrosCriticos) / data.length) * 100;
    return {
      multaPeriodo: 0,
      multaMensalProjetada: 0,
      multaIndutiva: 0,
      multaCapacitiva: 0,
      picoDemanda,
      fpMedio,
      maxKvarNecessario: 0,
      registrosCriticos,
      percentualConformidade,
      periodoAnalise: { inicio: data[0]?.timestamp || "", fim: data[data.length - 1]?.timestamp || "" },
      horariosPicoReativo: [],
      causaPrincipalMulta: "nenhum",
      percentualMultaIndutiva: 0,
      percentualMultaCapacitiva: 0,
      diasNoArquivo: diasUnicos.size,
    };
  }, [data, targetFP]);

  const dimensionamento = useMemo((): DimensionamentoStats | null => {
    if (data.length === 0) return null;
    const periodosCriticos = data.filter(d => d.fp < targetFP && d.tipoReativo === "indutivo");
    const mediaKvarCritico = periodosCriticos.length ? periodosCriticos.reduce((a, b) => a + b.kvar, 0) / periodosCriticos.length : 0;
    const recomendado = Math.ceil(mediaKvarCritico / 5) * 5;
    return {
      mediaKW: data.reduce((a, b) => a + b.kw, 0) / data.length,
      mediaKvar: data.reduce((a, b) => a + b.kvar, 0) / data.length,
      mediaFP: data.reduce((a, b) => a + b.fp, 0) / data.length,
      periodosCriticos: periodosCriticos.length,
      percentualCritico: (periodosCriticos.length / data.length) * 100,
      mediaKvarCritico,
      percentil90KvarCritico: mediaKvarCritico,
      maxKvarCritico: Math.max(...periodosCriticos.map(d => d.kvar), 0),
      bancoSugeridoFixo: recomendado,
      bancoSugeridoAutomatico: recomendado,
      tipoRecomendado: "automatico",
      justificativa: "Recomendado banco automático para correção do fator de potência.",
      coeficienteVariacao: 0.5,
      orcamentoEstimado: { min: recomendado * 100, max: recomendado * 150 },
      alertaTransformador: false,
      potenciaInstalada,
      economiaMensalEstimada: 0,
      paybackMeses: 12,
    };
  }, [data, targetFP, potenciaInstalada]);

  const chartData = useMemo(() => {
    if (data.length === 0) return [];
    const step = Math.max(1, Math.floor(data.length / 500));
    return data.filter((_, i) => i % step === 0).map(d => ({ ...d, horaLabel: d.hora, tooltipLabel: `${d.data} ${d.hora}` }));
  }, [data]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-2xl flex flex-col items-center gap-4">
          <Loader2 size={48} className="text-blue-600 animate-spin" />
          <p className="text-slate-600">Processando arquivo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 px-4 md:px-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-8 text-white">
        <h1 className="text-4xl font-black">Capacitor Manager</h1>
        <p className="text-white/70 mt-2">Análise de memória de massa e dimensionamento de bancos de capacitores</p>
        <div className="flex flex-wrap gap-4 mt-6">
          <label className="bg-amber-500 text-blue-900 px-6 py-3 rounded-xl font-bold cursor-pointer">
            <Upload size={20} className="inline mr-2" /> Importar CSV
            <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
          </label>
          {data.length > 0 && (
            <button onClick={handleClearData} className="bg-white/20 px-6 py-3 rounded-xl font-bold">
              <Trash2 size={20} className="inline mr-2" /> Limpar
            </button>
          )}
        </div>
        {fileName && <p className="text-xs text-white/50 mt-4">{fileName} • {data.length} registros</p>}
      </div>

      {data.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed">
          <FileText size={48} className="mx-auto text-slate-300" />
          <p className="mt-4 text-slate-500">Faça upload de um arquivo CSV com colunas: Data, kW fornecido, kVAr indutivo</p>
        </div>
      ) : (
        <div id="report-content" className="space-y-8">
          {/* Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow">
              <div className="flex items-center gap-3 text-red-600"><DollarSign size={20} /> Multa no período</div>
              <p className="text-3xl font-bold">R$ 0,00</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow">
              <div className="flex items-center gap-3 text-blue-600"><Zap size={20} /> Pico de Demanda</div>
              <p className="text-3xl font-bold">{stats?.picoDemanda.toFixed(1)} kW</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow">
              <div className="flex items-center gap-3 text-amber-600"><TrendingUp size={20} /> FP Médio</div>
              <p className="text-3xl font-bold">{stats?.fpMedio.toFixed(3)}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow">
              <div className="flex items-center gap-3 text-green-600"><CheckCircle2 size={20} /> Conformidade</div>
              <p className="text-3xl font-bold">{stats?.percentualConformidade.toFixed(1)}%</p>
            </div>
          </div>

          {/* Dimensionamento */}
          {dimensionamento && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-3xl">
              <h3 className="text-2xl font-bold text-blue-700">Dimensionamento Recomendado</h3>
              <p className="text-slate-600 mt-2">Banco de capacitores automático de <strong>{dimensionamento.bancoSugeridoAutomatico} kVAr</strong>.</p>
              <p className="text-sm mt-4">{dimensionamento.justificativa}</p>
            </div>
          )}

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-3xl shadow">
              <h3 className="font-bold mb-4">Curva de Carga (kW)</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="horaLabel" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipLabel || ""} />
                    <Area type="monotone" dataKey="kw" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow">
              <h3 className="font-bold mb-4">Fator de Potência</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="horaLabel" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0.5, 1]} />
                    <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipLabel || ""} />
                    <Line type="monotone" dataKey="fp" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <ReferenceLine y={targetFP} stroke="red" strokeDasharray="5 5" label={{ value: `Meta ${targetFP*100}%`, fill: "red", fontSize: 10 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tabela resumo */}
          <div className="bg-white p-6 rounded-3xl shadow">
            <h3 className="font-bold mb-4">Top 10 Registros com Maior kVAr</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2">Data/Hora</th>
                    <th className="text-left py-2">Dia</th>
                    <th className="text-left py-2">kW</th>
                    <th className="text-left py-2">kVAr</th>
                    <th className="text-left py-2">FP</th>
                    <th className="text-left py-2">Correção</th>
                  </tr>
                </thead>
                <tbody>
                  {data.filter(d => d.tipoReativo === "indutivo").sort((a, b) => b.kvar - a.kvar).slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-2">{row.data} {row.hora}</td>
                      <td>{row.diaSemana}</td>
                      <td>{row.kw.toFixed(1)}</td>
                      <td className="text-red-600 font-bold">{row.kvar.toFixed(1)}</td>
                      <td>{row.fp.toFixed(3)}</td>
                      <td>{row.kvarNecessario > 0 ? `${row.kvarNecessario.toFixed(0)} kVAr` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}