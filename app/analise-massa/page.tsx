"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import Papa from "papaparse";
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

const parseNumeroBrasileiro = (valor: unknown): number => {
  if (valor === undefined || valor === null) return 0;
  if (typeof valor === "number" && !isNaN(valor)) return Math.abs(valor);
  const str = String(valor).trim();
  if (!str || str === "-" || str === "#VALOR!" || str === "#DIV/0!") return 0;
  let numeroStr = str.replace(/\./g, "");
  numeroStr = numeroStr.replace(",", ".");
  const match = numeroStr.match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;
  const num = parseFloat(match[0]);
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

const calcularMultaANEELDetalhada = (
  registros: MassMemoryData[],
  tarifa: number,
  fpMinimo: number,
  samplesPerHour: number
): { total: number; indutiva: number; capacitiva: number } => {
  let totalIndutivo = 0;
  let totalCapacitivo = 0;
  for (const reg of registros) {
    if (reg.fp >= fpMinimo || reg.kw <= 0.01) continue;
    const fpCalculo = Math.max(0.01, Math.min(0.99, reg.fp));
    const fatorAjuste = Math.max(0, fpMinimo / fpCalculo - 1);
    const kvarhIntervalo = Math.abs(reg.kvar) / samplesPerHour;
    const multaParcial = kvarhIntervalo * tarifa * fatorAjuste;
    if (reg.tipoReativo === "indutivo") totalIndutivo += multaParcial;
    else if (reg.tipoReativo === "capacitivo") totalCapacitivo += multaParcial;
  }
  return { total: totalIndutivo + totalCapacitivo, indutiva: totalIndutivo, capacitiva: totalCapacitivo };
};

const detectarIntervaloAmostragem = (data: MassMemoryData[]): number => {
  if (data.length < 2) return 15;
  const diffMinutes: number[] = [];
  const limite = Math.min(data.length - 1, 500);
  for (let i = 0; i < limite; i++) {
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

const estimarOrcamento = (kvar: number, tipo: "fixo" | "automatico" | "hibrido"): { min: number; max: number } => {
  if (kvar <= 0) return { min: 0, max: 0 };
  const PRECO_KVAR_FIXO = 90;
  const PRECO_KVAR_AUTO = 180;
  const CUSTO_CONTROLADOR = 2500;
  const MARGEM = 0.2;
  if (tipo === "fixo") {
    const base = kvar * PRECO_KVAR_FIXO;
    return { min: Math.round(base * (1 - MARGEM)), max: Math.round(base * (1 + MARGEM)) };
  } else {
    const base = kvar * PRECO_KVAR_AUTO + CUSTO_CONTROLADOR;
    return { min: Math.round(base * (1 - MARGEM)), max: Math.round(base * (1 + MARGEM)) };
  }
};

const analisarHorariosCriticos = (data: MassMemoryData[]): { hora: string; mediaKvar: number; ocorrencias: number }[] => {
  const horariosMap = new Map<string, { somaKvar: number; count: number }>();
  for (const registro of data) {
    if (registro.tipoReativo === "indutivo" && registro.kvar > 5 && registro.fp < 0.92) {
      const horaBase = registro.hora.substring(0, 5);
      const existing = horariosMap.get(horaBase);
      if (existing) {
        existing.somaKvar += registro.kvar;
        existing.count++;
      } else {
        horariosMap.set(horaBase, { somaKvar: registro.kvar, count: 1 });
      }
    }
  }
  return Array.from(horariosMap.entries())
    .map(([hora, { somaKvar, count }]) => ({ hora, mediaKvar: somaKvar / count, ocorrencias: count }))
    .sort((a, b) => b.mediaKvar - a.mediaKvar)
    .slice(0, 10);
};

const analisarPeriodosCriticos = (data: MassMemoryData[], targetFP: number) => {
  return PERIODOS_DIA.map((periodo) => {
    const registrosPeriodo = data.filter((reg) => {
      const hora = parseInt(reg.hora.split(":")[0], 10);
      if (isNaN(hora)) return false;
      return hora >= periodo.inicio && hora < periodo.fim;
    });
    if (registrosPeriodo.length === 0) {
      return {
        ...periodo,
        totalRegistros: 0,
        registrosCriticos: 0,
        percentualCritico: 0,
        fpMedio: 0,
        kvarMedio: 0,
        nivelCriticidade: "NORMAL" as const,
      };
    }
    const registrosCriticos = registrosPeriodo.filter((reg) => reg.fp < targetFP && reg.tipoReativo === "indutivo");
    const fpMedio = registrosPeriodo.reduce((acc, reg) => acc + reg.fp, 0) / registrosPeriodo.length;
    const kvarMedio = registrosPeriodo.reduce((acc, reg) => acc + Math.abs(reg.kvar), 0) / registrosPeriodo.length;
    const percentualCritico = (registrosCriticos.length / registrosPeriodo.length) * 100;
    let nivelCriticidade: "NORMAL" | "ATENCAO" | "CRITICO" = "NORMAL";
    if (percentualCritico > 50) nivelCriticidade = "CRITICO";
    else if (percentualCritico > 25) nivelCriticidade = "ATENCAO";
    return {
      ...periodo,
      totalRegistros: registrosPeriodo.length,
      registrosCriticos: registrosCriticos.length,
      percentualCritico,
      fpMedio,
      kvarMedio,
      nivelCriticidade,
    };
  }).sort((a, b) => b.percentualCritico - a.percentualCritico);
};

const analisarDimensionamento = (
  data: MassMemoryData[],
  targetFP: number,
  potenciaInstalada: number,
  multaMensal: number = 0
): DimensionamentoStats => {
  const periodosCriticos = data.filter((d) => d.fp < targetFP && d.tipoReativo === "indutivo");
  const mediaKW = data.reduce((acc, d) => acc + d.kw, 0) / data.length;
  const mediaKvar = data.reduce((acc, d) => acc + Math.abs(d.kvar), 0) / data.length;
  const mediaFP = data.reduce((acc, d) => acc + d.fp, 0) / data.length;
  const kvarCriticos = periodosCriticos.map((d) => d.kvarNecessario).filter((v) => v > 0);
  const mediaKvarCritico = kvarCriticos.length ? kvarCriticos.reduce((a, b) => a + b, 0) / kvarCriticos.length : 0;
  const percentil90KvarCritico = calcularPercentil(kvarCriticos, 90);
  const maxKvarCritico = Math.max(...kvarCriticos, 0);
  const variancia =
    periodosCriticos.length > 1
      ? periodosCriticos.reduce((acc, d) => acc + Math.pow(d.kvar - mediaKvar, 2), 0) / periodosCriticos.length
      : 0;
  const desvioPadrao = Math.sqrt(variancia);
  const coeficienteVariacao = mediaKvar > 0 ? desvioPadrao / mediaKvar : 0;
  const percentualTempoCritico = (periodosCriticos.length / data.length) * 100;

  let tipoRecomendado: DimensionamentoStats["tipoRecomendado"];
  let justificativa: string;
  if (periodosCriticos.length === 0) {
    tipoRecomendado = "fixo";
    justificativa = "Sistema já está conforme. Nenhum banco adicional necessário.";
  } else if (percentualTempoCritico > 70 && coeficienteVariacao < 0.3) {
    tipoRecomendado = "fixo";
    justificativa = `Carga estável (CV=${coeficienteVariacao.toFixed(2)}) com FP baixo constante (${percentualTempoCritico.toFixed(1)}% do tempo). Banco fixo é mais econômico.`;
  } else if (coeficienteVariacao > 0.6 || percentualTempoCritico < 40) {
    tipoRecomendado = "automatico";
    justificativa = `Alta variabilidade (CV=${coeficienteVariacao.toFixed(2)}) ou ocorrência intermitente. Banco automático com múltiplos estágios evita sobrecorreção.`;
  } else {
    tipoRecomendado = "hibrido";
    justificativa = `Variabilidade moderada (CV=${coeficienteVariacao.toFixed(2)}). Banco híbrido (fixo + automático) oferece melhor relação custo-benefício.`;
  }

  let bancoSugeridoFixo = Math.ceil(Math.max(mediaKvarCritico, percentil90KvarCritico * 0.6) / 5) * 5;
  let bancoSugeridoAutomatico = Math.ceil(percentil90KvarCritico / 5) * 5;
  const limiteInstalado = potenciaInstalada > 0 ? potenciaInstalada * 0.4 : Infinity;
  const alertaTransformador = bancoSugeridoAutomatico > limiteInstalado;
  if (alertaTransformador) {
    bancoSugeridoAutomatico = Math.floor(limiteInstalado / 5) * 5;
    bancoSugeridoFixo = Math.min(bancoSugeridoFixo, bancoSugeridoAutomatico);
    justificativa += ` ATENÇÃO: O dimensionamento excedia 40% da potência instalada (${potenciaInstalada} kVA). Valor limitado por segurança.`;
  }
  const orcamentoEstimado = estimarOrcamento(
    tipoRecomendado === "fixo" ? bancoSugeridoFixo : bancoSugeridoAutomatico,
    tipoRecomendado
  );
  const paybackMeses = multaMensal > 0 && bancoSugeridoAutomatico > 0 ? Math.ceil(orcamentoEstimado.max / multaMensal) : 0;

  return {
    mediaKW,
    mediaKvar,
    mediaFP,
    periodosCriticos: periodosCriticos.length,
    percentualCritico: percentualTempoCritico,
    mediaKvarCritico,
    percentil90KvarCritico,
    maxKvarCritico,
    bancoSugeridoFixo,
    bancoSugeridoAutomatico,
    tipoRecomendado,
    justificativa,
    coeficienteVariacao,
    orcamentoEstimado,
    alertaTransformador,
    potenciaInstalada,
    economiaMensalEstimada: multaMensal,
    paybackMeses,
  };
};

const gerarEstagiosCapacitores = (totalKvar: number): number[] => {
  if (totalKvar <= 0) return [];
  const estagios: number[] = [];
  let restante = totalKvar;
  let tamanhoEstagio: number;
  if (totalKvar <= 30) tamanhoEstagio = 5;
  else if (totalKvar <= 90) tamanhoEstagio = 10;
  else if (totalKvar <= 200) tamanhoEstagio = 20;
  else tamanhoEstagio = 30;
  while (restante > 0) {
    const estagio = Math.min(tamanhoEstagio, restante);
    estagios.push(estagio);
    restante -= estagio;
  }
  if (estagios.length > 1 && estagios[estagios.length - 1] < tamanhoEstagio / 2) {
    const ultimo = estagios.pop() || 0;
    if (estagios.length) estagios[estagios.length - 1] += ultimo;
    else estagios.push(ultimo);
  }
  return estagios.sort((a, b) => a - b);
};

// ============================================================================
// PROCESSAMENTO DO CSV
// ============================================================================
const processarArquivo = async (content: string, targetFP: number): Promise<MassMemoryData[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      encoding: "ISO-8859-1",
      complete: (result: Papa.ParseResult<Record<string, string>>) => {
        const rows = result.data;
        const results: MassMemoryData[] = [];
        if (rows.length === 0) {
          resolve(results);
          return;
        }
        const colunas = Object.keys(rows[0] || {}).map((k) => k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
        const mapearColuna = (possibilidades: string[]): string | null => {
          for (const poss of possibilidades) {
            const normalized = poss.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const encontrada = colunas.find((c) => c.includes(normalized));
            if (encontrada) return encontrada;
          }
          return null;
        };
        const colData = mapearColuna(["data", "date", "medicao data"]);
        const colHora = mapearColuna(["hora", "time", "horario", "hora medicao"]);
        const colKW = mapearColuna(["kw fornecido", "ativa(kw)", "kw", "ativa", "demanda ativa", "potencia ativa"]);
        const colKvarInd = mapearColuna(["kvar indutivo", "kvarind", "kvar ind"]);
        const colKvarCap = mapearColuna(["kvar capacitivo", "kvarcap", "kvar cap"]);
        if (!colKW) {
          reject(new Error("Coluna de kW não encontrada"));
          return;
        }
        for (const row of rows) {
          try {
            const kw = parseNumeroBrasileiro(row[colKW]);
            let kvar = 0;
            if (colKvarInd && colKvarCap) {
              const kvarInd = parseNumeroBrasileiro(row[colKvarInd]);
              const kvarCap = parseNumeroBrasileiro(row[colKvarCap]);
              kvar = kvarInd - kvarCap;
            } else {
              const colKvar = mapearColuna(["kvar", "reativa(kvar)", "reativa", "potencia reativa"]);
              if (colKvar) kvar = parseNumeroBrasileiro(row[colKvar]);
            }
            if (kw === 0 && Math.abs(kvar) < 0.01) continue;
            let dataStr = colData ? row[colData] : "";
            let horaStr = colHora ? row[colHora] : "00:00";
            if (dataStr && dataStr.includes(" ") && !horaStr) {
              const parts = dataStr.split(" ");
              dataStr = parts[0];
              horaStr = parts[1] || "00:00";
            }
            const dataFormatada = dataStr.split("/").slice(0, 2).map((p: string) => p.padStart(2, "0")).join("/");
            const horaFormatada = horaStr.includes(":")
              ? horaStr.split(":").slice(0, 2).map((p: string) => p.padStart(2, "0")).join(":")
              : "00:00";
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
            console.warn("Erro ao processar linha:", error);
            continue;
          }
        }
        resolve(results);
      },
      error: (error: Error) => reject(error),
    });
  });
};

// ============================================================================
// COMPONENTE PRINCIPAL
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
    setRecalcKey((prev) => prev + 1);
    Swal.fire({
      title: "Análise Recalculada!",
      text: `Dimensionamento atualizado com potência instalada de ${potenciaInstalada} kVA`,
      icon: "success",
      timer: 2000,
      showConfirmButton: false,
    });
  }, [potenciaInstalada]);

  const handleClearData = useCallback(() => {
    Swal.fire({
      title: "Limpar dados?",
      text: "Todos os dados serão removidos do sistema.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, limpar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    }).then((result) => {
      if (result.isConfirmed) {
        setData([]);
        setFileName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        Swal.fire("Dados limpos!", "Faça upload de um novo arquivo.", "success");
      }
    });
  }, []);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.match(/\.(csv|txt)$/i)) {
        Swal.fire("Erro", "Por favor, selecione um arquivo CSV ou TXT.", "error");
        return;
      }
      setLoading(true);
      setFileName(file.name);
      try {
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = () => reject(new Error("Erro ao ler o arquivo"));
          reader.readAsText(file, "ISO-8859-1");
        });
        const dados = await processarArquivo(content, targetFP);
        if (dados.length === 0) {
          throw new Error("Nenhum dado válido encontrado. Verifique o formato do arquivo.");
        }
        const intervalo = detectarIntervaloAmostragem(dados);
        setSamplingInterval(intervalo);
        setData(dados);
        const fpMedio = dados.reduce((a, b) => a + b.fp, 0) / dados.length;
        Swal.fire({
          title: "Arquivo processado!",
          html: `${dados.length.toLocaleString()} registros<br>Intervalo: ${intervalo} min<br>FP médio: ${fpMedio.toFixed(3)}`,
          icon: "success",
          timer: 3000,
        });
      } catch (error: any) {
        console.error(error);
        Swal.fire("Erro", error.message || "Falha no processamento do arquivo.", "error");
        setFileName("");
      } finally {
        setLoading(false);
      }
    },
    [targetFP]
  );

  const exportToPDF = async () => {
    const element = document.getElementById("report-content");
    if (!element) return;
    setLoading(true);
    try {
      const dataUrl = await toPng(element, { quality: 0.95, backgroundColor: "#ffffff", pixelRatio: 2, cacheBust: true });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });
      const ratio = pdfWidth / img.width;
      const imgHeight = img.height * ratio;
      pdf.addImage(dataUrl, "PNG", 0, 10, pdfWidth, imgHeight);
      const dataAtual = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
      pdf.save(`Relatorio_Capacitor_${dataAtual}.pdf`);
      Swal.fire("Sucesso", "Relatório PDF exportado com sucesso!", "success");
    } catch (error) {
      console.error(error);
      Swal.fire("Erro", "Falha ao gerar o PDF. Tente novamente.", "error");
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = useCallback(() => {
    if (data.length === 0) return;
    const csvData = data.map((d) => ({
      Data: d.data,
      "Dia Semana": d.diaSemana || "-",
      Hora: d.hora,
      kW: d.kw.toFixed(2).replace(".", ","),
      kVAr: d.kvar.toFixed(2).replace(".", ","),
      "Tipo Reativo": d.tipoReativo === "indutivo" ? "Indutivo" : d.tipoReativo === "capacitivo" ? "Capacitivo" : "Neutro",
      "FP Medido": d.fp.toFixed(3).replace(".", ","),
      "Horário Crítico": d.isHorarioCritico ? "SIM" : "NÃO",
      "Correção Necessária (kVAr)": d.kvarNecessario.toFixed(1).replace(".", ","),
    }));
    const csv = Papa.unparse(csvData, { delimiter: ";", header: true });
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `analise_fp_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    Swal.fire("Sucesso", "CSV exportado com sucesso!", "success");
  }, [data]);

  const horariosCriticos = useMemo(() => (data.length ? analisarHorariosCriticos(data) : []), [data]);
  const periodosAnalise = useMemo(() => (data.length ? analisarPeriodosCriticos(data, targetFP) : []), [data, targetFP]);
  const analiseDiasSemana = useMemo(() => {
    if (data.length === 0) return [];
    const samplesPerHour = 60 / samplingInterval;
    const diasMap = new Map<string, { somaKvar: number; count: number; multa: number }>();
    DIAS_SEMANA.forEach((dia) => diasMap.set(dia, { somaKvar: 0, count: 0, multa: 0 }));
    for (const reg of data) {
      const dia = reg.diaSemana || getDiaSemana(reg.data);
      const info = diasMap.get(dia);
      if (info) {
        info.somaKvar += reg.kvar;
        info.count++;
        if (reg.fp < targetFP && reg.tipoReativo === "indutivo") {
          const fpCalculo = Math.max(0.01, reg.fp);
          const fatorAjuste = Math.max(0, targetFP / fpCalculo - 1);
          const kvarh = reg.kvar / samplesPerHour;
          info.multa += kvarh * tariff * fatorAjuste;
        }
      }
    }
    return DIAS_SEMANA.map((dia) => {
      const info = diasMap.get(dia)!;
      return { dia, kvarMedio: info.count > 0 ? info.somaKvar / info.count : 0, count: info.count, multa: info.multa };
    }).filter((d) => d.count > 0);
  }, [data, targetFP, tariff, samplingInterval]);

  const stats = useMemo((): AnalysisStats | null => {
    if (data.length === 0) return null;
    const samplesPerHour = 60 / samplingInterval;
    const multaDetalhada = calcularMultaANEELDetalhada(data, tariff, targetFP, samplesPerHour);
    const diasUnicos = new Set(data.map((d) => d.data));
    const diasNoArquivo = diasUnicos.size;
    const fatorProjecao = diasNoArquivo > 0 ? Math.min(30 / diasNoArquivo, 1) : 1;
    const multaMensalProjetada = multaDetalhada.total * fatorProjecao;
    const picoDemanda = Math.max(...data.map((d) => d.kw), 0);
    const fpMedio = data.reduce((acc, curr) => acc + curr.fp, 0) / data.length;
    const maxKvarNecessario = Math.max(...data.map((d) => d.kvarNecessario), 0);
    const registrosCriticos = data.filter((d) => d.fp < targetFP && d.tipoReativo === "indutivo").length;
    const percentualConformidade = ((data.length - registrosCriticos) / data.length) * 100;
    const periodoAnalise = { inicio: `${data[0].data} ${data[0].hora}`, fim: `${data[data.length - 1].data} ${data[data.length - 1].hora}` };
    const percentualMultaIndutiva = multaDetalhada.total > 0 ? (multaDetalhada.indutiva / multaDetalhada.total) * 100 : 0;
    const percentualMultaCapacitiva = multaDetalhada.total > 0 ? (multaDetalhada.capacitiva / multaDetalhada.total) * 100 : 0;
    let causaPrincipalMulta: AnalysisStats["causaPrincipalMulta"] = "nenhum";
    if (multaDetalhada.total > 0) {
      if (percentualMultaIndutiva > 70) causaPrincipalMulta = "indutivo";
      else if (percentualMultaCapacitiva > 70) causaPrincipalMulta = "capacitivo";
      else causaPrincipalMulta = "ambos";
    }
    return {
      multaPeriodo: multaDetalhada.total,
      multaMensalProjetada,
      multaIndutiva: multaDetalhada.indutiva,
      multaCapacitiva: multaDetalhada.capacitiva,
      picoDemanda,
      fpMedio,
      maxKvarNecessario,
      registrosCriticos,
      percentualConformidade,
      periodoAnalise,
      horariosPicoReativo: horariosCriticos,
      causaPrincipalMulta,
      percentualMultaIndutiva,
      percentualMultaCapacitiva,
      diasNoArquivo,
    };
  }, [data, tariff, targetFP, samplingInterval, horariosCriticos]);

  const dimensionamento = useMemo((): DimensionamentoStats | null => {
    if (data.length === 0) return null;
    return analisarDimensionamento(data, targetFP, potenciaInstalada, stats?.multaMensalProjetada || 0);
  }, [data, targetFP, potenciaInstalada, stats?.multaMensalProjetada, recalcKey]);

  const chartData = useMemo(() => {
    if (data.length === 0) return [];
    const step = Math.max(1, Math.floor(data.length / 1000));
    const sampled = data.filter((_, idx) => idx % step === 0);
    let prevDate = "";
    return sampled.map((d, idx) => {
      const showFullLabel = d.data !== prevDate || idx % 4 === 0;
      prevDate = d.data;
      return { ...d, horaLabel: showFullLabel ? d.hora : "", tooltipLabel: `${d.data} ${d.hora}` };
    });
  }, [data]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-2xl flex flex-col items-center gap-4 shadow-2xl">
          <Loader2 size={48} className="text-blue-600 animate-spin" />
          <p className="text-slate-600 font-medium">Processando arquivo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 px-4 md:px-6">
      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-8 md:p-12 text-white shadow-2xl"
      >
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-amber-500/20 to-transparent pointer-events-none rounded-r-3xl" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-amber-300 text-xs font-bold tracking-wider uppercase">
            <Cpu size={14} /> Análise Avançada • ANEEL 414/2010
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">Capacitor Manager</h1>
          <p className="text-lg text-white/70 leading-relaxed">
            Transforme dados brutos em economia real. Detectamos reativo excedente, calculamos multas conforme ANEEL e sugerimos a correção exata para sua instalação.
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <label className="flex items-center gap-2 bg-amber-500 text-blue-900 px-6 py-3 rounded-xl font-bold shadow-lg shadow-amber-500/20 cursor-pointer hover:scale-105 transition-transform">
              <Upload size={20} /> Importar CSV
              <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
            </label>
            {data.length > 0 && (
              <>
                <button onClick={exportToPDF} className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors">
                  <FileDown size={20} /> PDF
                </button>
                <button onClick={downloadCSV} className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors">
                  <Download size={20} /> CSV
                </button>
                <button onClick={handleClearData} className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 rounded-xl font-bold hover:bg-red-500/20 transition-colors">
                  <Trash2 size={20} /> Limpar
                </button>
              </>
            )}
          </div>
          {fileName && (
            <p className="text-xs text-white/50 flex items-center gap-2">
              <FileText size={12} /> {fileName} • {data.length.toLocaleString()} registros • Amostragem: {samplingInterval}min • {stats?.diasNoArquivo || 0} dias
            </p>
          )}
        </div>
      </motion.section>

      <AnimatePresence mode="wait">
        {data.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200"
          >
            <div className="bg-slate-50 p-6 rounded-full mb-6">
              <FileText size={48} className="text-slate-300" />
            </div>
            <h2 className="text-xl font-semibold text-slate-700 mb-2">Aguardando dados...</h2>
            <p className="text-slate-500 max-w-md text-center mb-6">Faça upload do CSV da sua concessionária com colunas de kW e kVAr.</p>
            <div className="bg-slate-50 p-4 rounded-xl max-w-lg text-sm text-slate-500">
              <p className="font-semibold mb-2">Formatos suportados:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Landis+Gyr (Memória de Massa)</li>
                <li>Equatorial (Demanda)</li>
                <li>CSV padrão com colunas: Data, Hora, kW, kVAr</li>
                <li>Separadores: ponto e vírgula (;) ou vírgula (,)</li>
                <li>Números no formato brasileiro (1.234,56)</li>
              </ul>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            id="report-content"
            className="space-y-8"
          >
            {/* Alertas de multa */}
            {stats && stats.multaIndutiva > 0 && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl mb-6">
                <div className="flex items-start gap-3">
                  <Zap size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-red-800">ATENÇÃO: Multa por Reativo Indutivo Detectada!</p>
                    <p className="text-sm text-red-700 mt-1">
                      O reativo indutivo está gerando multa de <strong>R$ {stats.multaIndutiva.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> no período analisado.
                    </p>
                    <p className="text-xs text-red-600 mt-2">Solução: Instale um banco de capacitores para corrigir o fator de potência.</p>
                  </div>
                </div>
              </div>
            )}
            {stats && stats.multaCapacitiva > 0 && (
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl mb-6">
                <div className="flex items-start gap-3">
                  <Battery size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-blue-800">ATENÇÃO: Multa por Reativo Capacitivo Detectada!</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Sua instalação está com <strong>SOBRECORREÇÃO</strong>. O reativo capacitivo está gerando multa de{" "}
                      <strong>R$ {stats.multaCapacitiva.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> no período analisado.
                    </p>
                    <p className="text-xs text-blue-600 mt-2">Solução: Desligue ou reduza o banco de capacitores existente. NÃO adicione mais capacitores.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Horários críticos */}
            {horariosCriticos.length > 0 && (
              <div className="bg-gradient-to-br from-red-50 to-orange-50 p-8 rounded-3xl border border-red-200">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                  <h3 className="text-2xl font-bold text-red-800 flex items-center gap-2"><AlertCircle size={24} /> Horários de Baixo Fator de Potência</h3>
                  <span className="text-xs bg-red-200 text-red-700 px-3 py-1 rounded-full font-bold">Multa aplicável pela ANEEL</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {horariosCriticos.map((horario, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2"><Clock size={16} className="text-red-500" /><span className="font-mono text-lg font-bold text-red-700">{horario.hora}</span></div>
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{horario.ocorrencias} ocorrências</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm"><span className="text-slate-500">Média de Reativo:</span><span className="font-bold text-red-600">{horario.mediaKvar.toFixed(1)} kVAr</span></div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5"><div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (horario.mediaKvar / 100) * 100)}%` }} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dias da semana */}
            {analiseDiasSemana.length > 0 && (
              <div className="bg-gradient-to-br from-green-50 to-teal-50 p-8 rounded-3xl border border-green-200">
                <h3 className="text-2xl font-bold text-blue-700 mb-6 flex items-center gap-2"><Calendar size={24} /> Análise por Dia da Semana</h3>
                <div className="space-y-3">
                  {analiseDiasSemana.map((dia, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl shadow-sm">
                      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
                        <span className="font-bold text-slate-700 w-24">{dia.dia}</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">kVAr Médio</span><span className="text-red-600 font-bold">{dia.kvarMedio.toFixed(1)} kVAr</span></div>
                          <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-red-500 h-2 rounded-full" style={{ width: `${Math.min(100, (dia.kvarMedio / 50) * 100)}%` }} /></div>
                        </div>
                        <div className="text-right min-w-[100px]"><p className="text-xs text-slate-500">Multa Estimada</p><p className="text-sm font-bold text-red-600">R$ {dia.multa.toFixed(2)}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-red-50 rounded-lg text-red-600"><DollarSign size={20} /></div><span className="text-sm font-medium text-slate-500">Multa no período</span></div>
                <p className="text-3xl font-bold text-slate-900">R$ {stats?.multaPeriodo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-slate-400 mt-1">Projetado 30 dias: <strong>R$ {stats?.multaMensalProjetada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Zap size={20} /></div><span className="text-sm font-medium text-slate-500">Pico de Demanda</span></div>
                <p className="text-3xl font-bold text-slate-900">{stats?.picoDemanda.toFixed(1)} kW</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-amber-50 rounded-lg text-amber-600"><TrendingUp size={20} /></div><span className="text-sm font-medium text-slate-500">FP Médio</span></div>
                <p className="text-3xl font-bold text-slate-900">{stats?.fpMedio.toFixed(3)}</p>
                <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${(stats?.fpMedio || 0) < targetFP ? "bg-red-500" : "bg-green-500"}`} style={{ width: `${(stats?.fpMedio || 0) * 100}%` }} /></div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-green-50 rounded-lg text-green-600"><CheckCircle2 size={20} /></div><span className="text-sm font-medium text-slate-500">Conformidade</span></div>
                <p className="text-3xl font-bold text-slate-900">{stats?.percentualConformidade.toFixed(1)}%</p>
              </div>
            </div>

            {/* Dimensionamento */}
            {dimensionamento && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-3xl border border-blue-200">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-blue-700 flex items-center gap-2"><Cpu size={24} /> Dimensionamento do Banco</h3>
                  <button onClick={handleRecalcular} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"><RefreshCw size={16} /> Recalcular</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white p-6 rounded-2xl">
                    <h4 className="text-sm font-bold text-slate-400 uppercase mb-4">Médias Gerais</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between"><span className="text-slate-600">kW Médio:</span><span className="font-bold text-blue-700">{dimensionamento.mediaKW.toFixed(1)} kW</span></div>
                      <div className="flex justify-between"><span className="text-slate-600">kVAr Médio:</span><span className="font-bold text-blue-700">{dimensionamento.mediaKvar.toFixed(1)} kVAr</span></div>
                      <div className="flex justify-between"><span className="text-slate-600">FP Médio:</span><span className={`font-bold ${dimensionamento.mediaFP >= targetFP ? "text-green-600" : "text-red-600"}`}>{dimensionamento.mediaFP.toFixed(3)}</span></div>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl">
                    <h4 className="text-sm font-bold text-slate-400 uppercase mb-4">Períodos Críticos</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between"><span className="text-slate-600">Ocorrências:</span><span className="font-bold text-red-600">{dimensionamento.periodosCriticos}</span></div>
                      <div className="flex justify-between"><span className="text-slate-600">% do Total:</span><span className="font-bold text-red-600">{dimensionamento.percentualCritico.toFixed(1)}%</span></div>
                      <div className="flex justify-between"><span className="text-slate-600">Variabilidade (CV):</span><span className="font-bold">{dimensionamento.coeficienteVariacao.toFixed(2)}</span></div>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border-2 border-amber-500">
                    <h4 className="text-sm font-bold text-amber-600 uppercase mb-4">Recomendação</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center"><span className="text-slate-600">Tipo:</span><span className="px-2 py-1 rounded text-xs font-bold uppercase bg-blue-100 text-blue-700">{dimensionamento.tipoRecomendado === "fixo" ? "Fixo" : dimensionamento.tipoRecomendado === "automatico" ? "Automático" : "Híbrido"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-600">Capacidade:</span><span className="font-bold text-2xl text-blue-700">{dimensionamento.bancoSugeridoAutomatico} kVAr</span></div>
                      {dimensionamento.paybackMeses > 0 && <div className="flex justify-between"><span className="text-slate-600">Payback:</span><span className="font-bold text-green-600">{dimensionamento.paybackMeses} meses</span></div>}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl"><p className="text-slate-700 leading-relaxed">{dimensionamento.justificativa}</p></div>
                {dimensionamento.tipoRecomendado !== "fixo" && dimensionamento.bancoSugeridoAutomatico > 0 && (
                  <div className="mt-6 bg-white p-6 rounded-2xl">
                    <h4 className="text-sm font-bold text-slate-400 uppercase mb-4">Estágios Recomendados</h4>
                    <div className="flex flex-wrap gap-3">
                      {gerarEstagiosCapacitores(dimensionamento.bancoSugeridoAutomatico).map((estagio, idx) => (
                        <div key={idx} className="bg-blue-50 px-4 py-2 rounded-lg"><span className="text-xs">Estágio {idx + 1}:</span><span className="font-bold text-blue-700 ml-2">{estagio} kVAr</span></div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-6 bg-white p-6 rounded-2xl border-2 border-green-500">
                  <h4 className="text-sm font-bold text-green-600 uppercase mb-4">Orçamento Estimado</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><div className="flex justify-between items-center"><span className="text-slate-600">Investimento:</span><span className="font-bold text-lg">R$ {dimensionamento.orcamentoEstimado.min.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} - R$ {dimensionamento.orcamentoEstimado.max.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div></div>
                    <div><div className="flex justify-between items-center"><span className="text-slate-600">Economia Mensal:</span><span className="font-bold text-green-600 text-lg">R$ {dimensionamento.economiaMensalEstimada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div></div>
                  </div>
                </div>
              </div>
            )}

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-blue-700 mb-6">Curva de Carga (kW)</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="horaLabel" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis domain={[0, "auto"]} />
                      <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipLabel || ""} />
                      <Area type="monotone" dataKey="kw" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-blue-700 mb-6">Fator de Potência</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="horaLabel" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis domain={[0.5, 1]} />
                      <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipLabel || ""} />
                      <Line type="monotone" dataKey="fp" stroke="#f59e0b" strokeWidth={2} dot={false} />
                      <ReferenceLine y={targetFP} stroke="#ef4444" strokeDasharray="5 5" label={{ value: `Meta ${targetFP * 100}%`, fill: "#ef4444", fontSize: 10 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Tabela top 10 */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-blue-700 mb-6 flex items-center gap-2"><AlertTriangle size={18} className="text-red-500" /> Top 10 Registros com Maior kVAr</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100">
                      <th className="pb-4">Data/Hora</th>
                      <th className="pb-4">Dia</th>
                      <th className="pb-4">kW</th>
                      <th className="pb-4">kVAr</th>
                      <th className="pb-4">FP</th>
                      <th className="pb-4">Correção</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data
                      .filter((d) => d.fp < targetFP && d.tipoReativo === "indutivo")
                      .sort((a, b) => b.kvar - a.kvar)
                      .slice(0, 10)
                      .map((row, idx) => (
                        <tr key={idx} className="text-sm hover:bg-slate-50 transition-colors">
                          <td className="py-3 font-medium text-slate-700">{row.data} {row.hora}</td>
                          <td className="py-3 text-slate-600">{row.diaSemana || "-"}</td>
                          <td className="py-3 text-slate-600">{row.kw.toFixed(1)}</td>
                          <td className="py-3 font-bold text-red-600">{row.kvar.toFixed(1)}</td>
                          <td className="py-3 font-bold text-red-500">{row.fp.toFixed(3)}</td>
                          <td className="py-3 text-slate-600">{row.kvarNecessario > 0 ? `${row.kvarNecessario.toFixed(0)} kVAr` : "-"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}