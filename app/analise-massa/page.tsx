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
  TrendingDown,
  Zap,
  DollarSign,
  Info,
  CheckCircle2,
  Download,
  Activity,
  Cpu,
  ArrowUpRight,
  FileDown,
  Settings,
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
import { cn } from "@/lib/utils";
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
  horariosPicoReativo?: {
    hora: string;
    mediaKvar: number;
    ocorrencias: number;
  }[];
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

interface PeriodoAnalise {
  nome: string;
  inicio: number;
  fim: number;
  cor: string;
  totalRegistros: number;
  registrosCriticos: number;
  percentualCritico: number;
  fpMedio: number;
  kvarMedio: number;
  nivelCriticidade: "NORMAL" | "ATENCAO" | "CRITICO";
}

interface AnaliseDiaSemana {
  dia: string;
  kvarMedio: number;
  count: number;
  multa: number;
}

interface ProcessamentoResultado {
  dados: MassMemoryData[];
  intervaloAmostragem: number;
  totalRegistros: number;
}

// ============================================================================
// CONSTANTES
// ============================================================================
const DIAS_SEMANA = [
  "Segunda",
  "Terca",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sabado",
  "Domingo",
];

const PERIODOS_DIA = [
  { nome: "Madrugada (00:00 - 06:00)", inicio: 0, fim: 6, cor: "bg-slate-100" },
  { nome: "Inicio da Manha (06:00 - 09:00)", inicio: 6, fim: 9, cor: "bg-blue-50" },
  { nome: "Meio da Manha (09:00 - 12:00)", inicio: 9, fim: 12, cor: "bg-red-50" },
  { nome: "Inicio da Tarde (12:00 - 15:00)", inicio: 12, fim: 15, cor: "bg-orange-50" },
  { nome: "Final da Tarde (15:00 - 18:00)", inicio: 15, fim: 18, cor: "bg-amber-50" },
  { nome: "Noite (18:00 - 22:00)", inicio: 18, fim: 22, cor: "bg-purple-50" },
  { nome: "Final da Noite (22:00 - 00:00)", inicio: 22, fim: 24, cor: "bg-slate-100" },
];

// ============================================================================
// FUNCOES UTILITARIAS
// ============================================================================

const getDiaSemana = (dataStr: string): string => {
  if (!dataStr || dataStr === "") return "Desconhecido";
  
  try {
    const matchData = dataStr.match(/(\d{1,2})\/(\d{1,2})/);
    if (matchData) {
      const dia = parseInt(matchData[1]);
      const mes = parseInt(matchData[2]) - 1;
      const ano = new Date().getFullYear();
      const data = new Date(ano, mes, dia);
      
      if (!isNaN(data.getTime())) {
        const diaNum = data.getDay();
        return DIAS_SEMANA[diaNum === 0 ? 6 : diaNum - 1];
      }
    }
    
    const data = new Date(dataStr);
    if (!isNaN(data.getTime())) {
      const diaNum = data.getDay();
      return DIAS_SEMANA[diaNum === 0 ? 6 : diaNum - 1];
    }
    
    return "Desconhecido";
  } catch {
    return "Desconhecido";
  }
};

const parseNumeroBrasileiro = (valor: any): number => {
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

const calcularCorrecaoNecessaria = (
  kw: number,
  fpAtual: number,
  fpDesejado: number,
): number => {
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
  samplesPerHour: number,
): { total: number; indutiva: number; capacitiva: number } => {
  let totalIndutivo = 0;
  let totalCapacitivo = 0;

  for (const reg of registros) {
    if (reg.fp >= fpMinimo || reg.kw <= 0.01) continue;

    const fpCalculo = Math.max(0.01, Math.min(0.99, reg.fp));
    const fatorAjuste = Math.max(0, (fpMinimo / fpCalculo) - 1);
    
    const kvarhIntervalo = (Math.abs(reg.kvar) / samplesPerHour);
    const multaParcial = kvarhIntervalo * tarifa * fatorAjuste;

    if (reg.tipoReativo === "indutivo") {
      totalIndutivo += multaParcial;
    } else if (reg.tipoReativo === "capacitivo") {
      totalCapacitivo += multaParcial;
    }
  }

  return {
    total: totalIndutivo + totalCapacitivo,
    indutiva: totalIndutivo,
    capacitiva: totalCapacitivo,
  };
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
        if (diff >= 1 && diff <= 1440) {
          diffMinutes.push(diff);
        }
      }
    } catch {
      continue;
    }
  }

  if (diffMinutes.length === 0) return 15;
  
  diffMinutes.sort((a, b) => a - b);
  const meio = Math.floor(diffMinutes.length / 2);
  const mediana = diffMinutes.length % 2 === 0
    ? (diffMinutes[meio - 1] + diffMinutes[meio]) / 2
    : diffMinutes[meio];
    
  const valorArredondado = Math.round(mediana);
  if (valorArredondado <= 10) return 15;
  if (valorArredondado <= 20) return 15;
  if (valorArredondado <= 40) return 30;
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

const estimarOrcamento = (
  kvar: number,
  tipo: "fixo" | "automatico" | "hibrido",
): { min: number; max: number } => {
  if (kvar <= 0) return { min: 0, max: 0 };
  
  const PRECO_KVAR_FIXO = 90;
  const PRECO_KVAR_AUTO = 180;
  const CUSTO_CONTROLADOR = 2500;
  const MARGEM = 0.2;

  if (tipo === "fixo") {
    const base = kvar * PRECO_KVAR_FIXO;
    return {
      min: Math.round(base * (1 - MARGEM)),
      max: Math.round(base * (1 + MARGEM)),
    };
  } else {
    const base = kvar * PRECO_KVAR_AUTO + CUSTO_CONTROLADOR;
    return {
      min: Math.round(base * (1 - MARGEM)),
      max: Math.round(base * (1 + MARGEM)),
    };
  }
};

const analisarHorariosCriticos = (
  data: MassMemoryData[],
): { hora: string; mediaKvar: number; ocorrencias: number }[] => {
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
    .map(([hora, { somaKvar, count }]) => ({
      hora,
      mediaKvar: somaKvar / count,
      ocorrencias: count,
    }))
    .sort((a, b) => b.mediaKvar - a.mediaKvar)
    .slice(0, 10);
};

const analisarPeriodosCriticos = (
  data: MassMemoryData[],
  targetFP: number,
): PeriodoAnalise[] => {
  return PERIODOS_DIA
    .map((periodo) => {
      const registrosPeriodo = data.filter((reg) => {
        const hora = parseInt(reg.hora.split(":")[0]);
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

      const registrosCriticos = registrosPeriodo.filter(
        (reg) => reg.fp < targetFP && reg.tipoReativo === "indutivo",
      );

      const fpMedio = registrosPeriodo.reduce((acc, reg) => acc + reg.fp, 0) / registrosPeriodo.length;
      const kvarMedio = registrosPeriodo.reduce((acc, reg) => acc + Math.abs(reg.kvar), 0) / registrosPeriodo.length;
      const percentualCritico = (registrosCriticos.length / registrosPeriodo.length) * 100;

      let nivelCriticidade: PeriodoAnalise["nivelCriticidade"] = "NORMAL";
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
    })
    .sort((a, b) => b.percentualCritico - a.percentualCritico);
};

const analisarDimensionamento = (
  data: MassMemoryData[],
  targetFP: number,
  potenciaInstalada: number,
  multaMensal: number = 0,
): DimensionamentoStats => {
  const periodosCriticos = data.filter(
    (d) => d.fp < targetFP && d.tipoReativo === "indutivo",
  );

  const mediaKW = data.reduce((acc, d) => acc + d.kw, 0) / data.length;
  const mediaKvar = data.reduce((acc, d) => acc + Math.abs(d.kvar), 0) / data.length;
  const mediaFP = data.reduce((acc, d) => acc + d.fp, 0) / data.length;

  const kvarCriticos = periodosCriticos.map((d) => d.kvarNecessario).filter(v => v > 0);
  const mediaKvarCritico = kvarCriticos.length > 0
    ? kvarCriticos.reduce((a, b) => a + b, 0) / kvarCriticos.length
    : 0;
  const percentil90KvarCritico = calcularPercentil(kvarCriticos, 90);
  const maxKvarCritico = Math.max(...kvarCriticos, 0);

  const variancia = periodosCriticos.length > 1
    ? periodosCriticos.reduce((acc, d) => acc + Math.pow(d.kvar - mediaKvar, 2), 0) / periodosCriticos.length
    : 0;
  const desvioPadrao = Math.sqrt(variancia);
  const coeficienteVariacao = mediaKvar > 0 ? desvioPadrao / mediaKvar : 0;

  let tipoRecomendado: DimensionamentoStats["tipoRecomendado"];
  let justificativa: string;
  const percentualTempoCritico = (periodosCriticos.length / data.length) * 100;

  if (periodosCriticos.length === 0) {
    tipoRecomendado = "fixo";
    justificativa = "Sistema ja esta conforme. Nenhum banco adicional necessario.";
  } else if (percentualTempoCritico > 70 && coeficienteVariacao < 0.3) {
    tipoRecomendado = "fixo";
    justificativa = `Carga estavel (CV=${coeficienteVariacao.toFixed(2)}) com FP baixo constante (${percentualTempoCritico.toFixed(1)}% do tempo). Banco fixo e mais economico.`;
  } else if (coeficienteVariacao > 0.6 || percentualTempoCritico < 40) {
    tipoRecomendado = "automatico";
    justificativa = `Alta variabilidade (CV=${coeficienteVariacao.toFixed(2)}) ou ocorrencia intermitente. Banco automatico com multiplos estagios evita sobrecorrecao.`;
  } else {
    tipoRecomendado = "hibrido";
    justificativa = `Variabilidade moderada (CV=${coeficienteVariacao.toFixed(2)}). Banco hibrido (fixo + automatico) oferece melhor relacao custo-beneficio.`;
  }

  let bancoSugeridoFixo = Math.ceil(Math.max(mediaKvarCritico, percentil90KvarCritico * 0.6) / 5) * 5;
  let bancoSugeridoAutomatico = Math.ceil(percentil90KvarCritico / 5) * 5;
  
  const limiteInstalado = potenciaInstalada > 0 ? potenciaInstalada * 0.4 : Infinity;
  const alertaTransformador = bancoSugeridoAutomatico > limiteInstalado;

  if (alertaTransformador) {
    bancoSugeridoAutomatico = Math.floor(limiteInstalado / 5) * 5;
    bancoSugeridoFixo = Math.min(bancoSugeridoFixo, bancoSugeridoAutomatico);
    justificativa += ` ATENCAO: O dimensionamento excedia 40% da potencia instalada (${potenciaInstalada} kVA). Valor limitado por seguranca.`;
  }

  const orcamentoEstimado = estimarOrcamento(
    tipoRecomendado === "fixo" ? bancoSugeridoFixo : bancoSugeridoAutomatico,
    tipoRecomendado,
  );

  const paybackMeses = multaMensal > 0 && bancoSugeridoAutomatico > 0
    ? Math.ceil(orcamentoEstimado.max / multaMensal)
    : 0;

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
    if (estagios.length > 0) {
      estagios[estagios.length - 1] += ultimo;
    } else {
      estagios.push(ultimo);
    }
  }
  
  return estagios.sort((a, b) => a - b);
};

// ============================================================================
// PARSING DE ARQUIVOS - VERSÃO UNIFICADA E ROBUSTA
// ============================================================================

/**
 * Detecta o formato do arquivo baseado nas primeiras linhas
 */
const detectarFormato = (content: string): "landis" | "equatorial" | "padrao" => {
  const firstLines = content.split("\n").slice(0, 50).join(" ").toLowerCase();
  
  // Landis+Gyr: contém "reg.;data;hora;kw" ou "landis+gyr"
  if (firstLines.includes("landis+gyr") || 
      firstLines.includes("reg.;data;hora;kw") ||
      (firstLines.includes("reg.") && firstLines.includes("kvarind"))) {
    return "landis";
  }
  
  // Equatorial: contém "kw fornecido" e "kvar indutivo" e "data" no cabeçalho
  if (firstLines.includes("kw fornecido") && firstLines.includes("kvar indutivo")) {
    return "equatorial";
  }
  
  // Padrão: tenta tratar como CSV genérico
  return "padrao";
};

/**
 * Encontra a linha de cabeçalho real ignorando linhas de comentário e vazias
 */
const encontrarLinhaCabecalho = (lines: string[], palavrasChave: string[]): number => {
  for (let i = 0; i < Math.min(lines.length, 100); i++) {
    const line = lines[i].toLowerCase();
    if (line.startsWith("'") || line.trim() === "") continue;
    if (palavrasChave.some(keyword => line.includes(keyword))) {
      return i;
    }
  }
  return -1;
};

/**
 * Processa qualquer arquivo usando PapaParse com detecção dinâmica de colunas
 */
const processarArquivoUniversal = async (
  content: string,
  targetFP: number,
): Promise<ProcessamentoResultado> => {
  return new Promise((resolve) => {
    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      encoding: "ISO-8859-1",
      complete: (parseResult: Papa.ParseResult<any>) => {
        const rows = parseResult.data as any[];
        const results: MassMemoryData[] = [];
        
        // Identificar colunas disponíveis (normalizando nomes)
        const colunas = Object.keys(rows[0] || {}).map(k => k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
        
        const mapearColuna = (possibilidades: string[]): string | null => {
          for (const poss of possibilidades) {
            const normalized = poss.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const encontrada = colunas.find(c => c.includes(normalized));
            if (encontrada) return encontrada;
          }
          return null;
        };
        
        const colData = mapearColuna(["data", "date", "medicao data"]);
        const colHora = mapearColuna(["hora", "time", "horario", "hora medicao"]);
        const colKW = mapearColuna(["kw fornecido", "ativa(kw)", "kw", "ativa", "demanda ativa", "potencia ativa"]);
        const colKvarInd = mapearColuna(["kvar indutivo", "kvarind", "kvar ind"]);
        const colKvarCap = mapearColuna(["kvar capacitivo", "kvarcap", "kvar cap"]);
        const colKvar = mapearColuna(["kvar", "reativa(kvar)", "reativa", "potencia reativa"]);
        const colFP = mapearColuna(["fp", "fator potencia", "fator de potencia"]);
        
        if (!colKW) {
          console.warn("Coluna de kW não encontrada");
          resolve({ dados: [], intervaloAmostragem: 15, totalRegistros: 0 });
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
            } else if (colKvar) {
              kvar = parseNumeroBrasileiro(row[colKvar]);
            }
            
            if (kw === 0 && Math.abs(kvar) < 0.01) continue;
            
            let dataStr = colData ? row[colData] : "";
            let horaStr = colHora ? row[colHora] : "00:00";
            
            if (dataStr && dataStr.includes(" ") && !horaStr) {
              const parts = dataStr.split(" ");
              dataStr = parts[0];
              horaStr = parts[1] || "00:00";
            }
            
            let dataFormatada = dataStr;
            if (dataStr && dataStr.includes("/")) {
              const partes = dataStr.split("/");
              if (partes.length >= 2) {
                dataFormatada = `${partes[0].padStart(2, "0")}/${partes[1].padStart(2, "0")}`;
              }
            }
            
            let horaFormatada = horaStr;
            if (horaStr && horaStr.includes(":")) {
              const [h, m] = horaStr.split(":");
              horaFormatada = `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
            }
            
            const tipoReativo: MassMemoryData["tipoReativo"] =
              kvar > 0.01 ? "indutivo" : kvar < -0.01 ? "capacitivo" : "neutro";
            
            const kvarAbs = Math.abs(kvar);
            const fpCalculado = calcularFP(kw, kvarAbs);
            
            let fpFinal = fpCalculado;
            if (colFP) {
              let fpValor = parseNumeroBrasileiro(row[colFP]);
              if (typeof row[colFP] === "string") {
                const match = row[colFP].match(/(\d+)/);
                if (match) fpValor = parseInt(match[1]);
              }
              if (fpValor > 1 && fpValor <= 100) fpValor = fpValor / 100;
              if (fpValor > 0 && fpValor <= 1) fpFinal = fpValor;
            }
            
            const timestamp = `${dataFormatada}T${horaFormatada}`;
            const diaSemana = getDiaSemana(dataFormatada);
            const kvarNecessario = tipoReativo === "indutivo" && fpFinal < targetFP
              ? calcularCorrecaoNecessaria(kw, fpFinal, targetFP)
              : 0;
            const isHorarioCritico = tipoReativo === "indutivo" && kvarAbs > 5 && fpFinal < targetFP;
            
            results.push({
              data: dataFormatada,
              hora: horaFormatada,
              timestamp,
              kw,
              kvar: kvarAbs,
              fp: Math.round(fpFinal * 100) / 100,
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
        
        const intervalo = detectarIntervaloAmostragem(results);
        resolve({
          dados: results,
          intervaloAmostragem: intervalo,
          totalRegistros: results.length,
        });
      },
      error: (error: any) => {
        console.error("Erro no parsing universal:", error);
        resolve({ dados: [], intervaloAmostragem: 15, totalRegistros: 0 });
      },
    });
  });
};

/**
 * Processamento específico para arquivos Landis+Gyr (fallback se o universal falhar)
 */
const processarArquivoLandis = (
  content: string,
  targetFP: number,
): ProcessamentoResultado => {
  const results: MassMemoryData[] = [];
  const lines = content.split("\n");
  
  let headerLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (line.includes("reg.;data;hora;kw") || 
        (line.includes("reg.") && line.includes("kvarind"))) {
      headerLineIndex = i;
      break;
    }
  }
  
  if (headerLineIndex === -1) {
    return { dados: [], intervaloAmostragem: 15, totalRegistros: 0 };
  }
  
  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("'") || line.startsWith("Disponibilidades") || 
        line.startsWith("Total") || line.startsWith("Sumariza")) {
      continue;
    }
    
    const parts = line.split(";");
    if (parts.length < 5) continue;
    
    try {
      let idxData = 1, idxHora = 2, idxKW = 3;
      let idxKvarInd = 5, idxKvarCap = 7, idxFP = 11;
      
      if (parts.length <= idxKvarInd) {
        idxData = 1; idxHora = 2; idxKW = 3; idxKvarInd = 4; idxKvarCap = 5; idxFP = 6;
      }
      
      const dataRaw = idxData < parts.length ? parts[idxData] : "";
      const horaRaw = idxHora < parts.length ? parts[idxHora] : "00:00";
      const kw = parseNumeroBrasileiro(parts[idxKW]);
      const kvarInd = parseNumeroBrasileiro(parts[idxKvarInd]);
      const kvarCap = parseNumeroBrasileiro(idxKvarCap < parts.length ? parts[idxKvarCap] : "0");
      
      if (kw === 0 && kvarInd === 0 && kvarCap === 0) continue;
      
      let kvar = kvarInd - kvarCap;
      
      const tipoReativo: MassMemoryData["tipoReativo"] =
        kvar > 0.01 ? "indutivo" : kvar < -0.01 ? "capacitivo" : "neutro";
      
      const kvarAbs = Math.abs(kvar);
      const fpCalculado = calcularFP(kw, kvarAbs);
      
      let fpFinal = fpCalculado;
      if (idxFP < parts.length && parts[idxFP]) {
        let fpValor = parseNumeroBrasileiro(parts[idxFP]);
        if (fpValor > 1 && fpValor <= 100) fpValor = fpValor / 100;
        if (fpValor > 0 && fpValor <= 1) fpFinal = fpValor;
      }
      
      let dataFormatada = dataRaw;
      if (dataRaw && dataRaw.includes("/")) {
        const partes = dataRaw.split("/");
        if (partes.length >= 2) {
          dataFormatada = `${partes[0].padStart(2, "0")}/${partes[1].padStart(2, "0")}`;
        }
      }
      
      let horaFormatada = horaRaw;
      if (horaRaw && !horaRaw.includes(":")) {
        horaFormatada = `${horaRaw.padStart(2, "0")}:00`;
      } else if (horaRaw && horaRaw.split(":").length === 2) {
        const [h, m] = horaRaw.split(":");
        horaFormatada = `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
      }
      
      const timestamp = `${dataFormatada}T${horaFormatada}`;
      const diaSemana = getDiaSemana(dataFormatada);
      const kvarNecessario = tipoReativo === "indutivo" && fpFinal < targetFP
        ? calcularCorrecaoNecessaria(kw, fpFinal, targetFP)
        : 0;
      const isHorarioCritico = tipoReativo === "indutivo" && kvarAbs > 5 && fpFinal < targetFP;
      
      results.push({
        data: dataFormatada,
        hora: horaFormatada,
        timestamp,
        kw,
        kvar: kvarAbs,
        fp: Math.round(fpFinal * 100) / 100,
        kvarNecessario,
        tipoReativo,
        isHorarioCritico,
        diaSemana,
      });
    } catch (error) {
      console.warn(`Erro ao processar linha ${i}:`, error);
      continue;
    }
  }
  
  const intervalo = detectarIntervaloAmostragem(results);
  return {
    dados: results,
    intervaloAmostragem: intervalo,
    totalRegistros: results.length,
  };
};

/**
 * Processamento específico para Equatorial (fallback)
 */
const processarArquivoEquatorial = (
  content: string,
  targetFP: number,
): ProcessamentoResultado => {
  const results: MassMemoryData[] = [];
  const lines = content.split("\n");
  
  let headerLineIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    const line = lines[i].toLowerCase();
    if (line.includes("data") && line.includes("kw fornecido") && line.includes("kvar indutivo")) {
      headerLineIndex = i;
      break;
    }
  }
  
  if (headerLineIndex === -1) {
    return { dados: [], intervaloAmostragem: 15, totalRegistros: 0 };
  }
  
  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("'") || line.startsWith("Disponibilidades") || 
        line.startsWith("Total") || line.startsWith("Sumariza") || line.startsWith(";")) {
      continue;
    }
    
    const parts = line.split(";");
    if (parts.length < 6) continue;
    
    try {
      const dataRaw = parts[0] || "";
      const horaRaw = parts[2] || "00:00";
      const kw = parseNumeroBrasileiro(parts[3]);
      const kvarInd = parseNumeroBrasileiro(parts[4]);
      const kvarCap = parseNumeroBrasileiro(parts[5] || "0");
      
      if (kw === 0 && kvarInd === 0 && kvarCap === 0) continue;
      
      let kvar = kvarInd - kvarCap;
      
      const tipoReativo: MassMemoryData["tipoReativo"] =
        kvar > 0.01 ? "indutivo" : kvar < -0.01 ? "capacitivo" : "neutro";
      
      const kvarAbs = Math.abs(kvar);
      const fp = calcularFP(kw, kvarAbs);
      
      let dataFormatada = dataRaw;
      if (dataRaw && dataRaw.includes("/")) {
        const partes = dataRaw.split("/");
        if (partes.length >= 2) {
          dataFormatada = `${partes[0].padStart(2, "0")}/${partes[1].padStart(2, "0")}`;
        }
      }
      
      let horaFormatada = horaRaw;
      if (horaRaw && horaRaw.includes(":")) {
        const [h, m] = horaRaw.split(":");
        horaFormatada = `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
      }
      
      const timestamp = `${dataFormatada}T${horaFormatada}`;
      const diaSemana = getDiaSemana(dataFormatada);
      const kvarNecessario = tipoReativo === "indutivo" && fp < targetFP
        ? calcularCorrecaoNecessaria(kw, fp, targetFP)
        : 0;
      const isHorarioCritico = tipoReativo === "indutivo" && kvarAbs > 5 && fp < targetFP;
      
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
      console.warn(`Erro ao processar linha ${i}:`, error);
      continue;
    }
  }
  
  const intervalo = detectarIntervaloAmostragem(results);
  return {
    dados: results,
    intervaloAmostragem: intervalo,
    totalRegistros: results.length,
  };
};

/**
 * Função principal de processamento - tenta universal primeiro, fallback para específicos
 */
const processarArquivo = async (
  content: string,
  targetFP: number,
): Promise<ProcessamentoResultado> => {
  const formato = detectarFormato(content);
  console.log("Formato detectado:", formato);
  
  // Tentar primeiro o parser universal (mais robusto)
  let resultado = await processarArquivoUniversal(content, targetFP);
  
  // Se falhar ou retornar poucos dados, tentar parser específico
  if (resultado.dados.length === 0) {
    console.log("Parser universal falhou, tentando parser específico...");
    if (formato === "landis") {
      resultado = processarArquivoLandis(content, targetFP);
    } else if (formato === "equatorial") {
      resultado = processarArquivoEquatorial(content, targetFP);
    }
  }
  
  return resultado;
};

// ============================================================================
// COMPONENTES DE ALERTA
// ============================================================================

const AlertaMultaCapacitiva = ({ multaCapacitiva }: { multaCapacitiva: number }) => {
  if (multaCapacitiva <= 0) return null;
  
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl mb-6"
    >
      <div className="flex items-start gap-3">
        <Battery size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-blue-800">
            ATENCAO: Multa por Reativo Capacitivo Detectada!
          </p>
          <p className="text-sm text-blue-700 mt-1">
            Sua instalacao esta com <strong>SOBRECORRECAO</strong>. O reativo
            capacitivo esta gerando multa de{" "}
            <strong>
              R$ {multaCapacitiva.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </strong>{" "}
            no periodo analisado.
          </p>
          <p className="text-xs text-blue-600 mt-2">
            Solucao: Desligue ou reduza o banco de capacitores existente. NAO adicione mais capacitores.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

const AlertaMultaIndutiva = ({ multaIndutiva }: { multaIndutiva: number }) => {
  if (multaIndutiva <= 0) return null;
  
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl mb-6"
    >
      <div className="flex items-start gap-3">
        <Zap size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-red-800">
            ATENCAO: Multa por Reativo Indutivo Detectada!
          </p>
          <p className="text-sm text-red-700 mt-1">
            O reativo indutivo esta gerando multa de{" "}
            <strong>
              R$ {multaIndutiva.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </strong>{" "}
            no periodo analisado.
          </p>
          <p className="text-xs text-red-600 mt-2">
            Solucao: Instale um banco de capacitores para corrigir o fator de potencia.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

const LoadingOverlay = ({ mensagem }: { mensagem?: string }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-white p-8 rounded-2xl flex flex-col items-center gap-4 shadow-2xl min-w-[280px]"
    >
      <Loader2 size={48} className="text-primary animate-spin" />
      <p className="text-slate-600 font-medium">{mensagem || "Processando arquivo..."}</p>
      <p className="text-xs text-slate-400">Isso pode levar alguns segundos</p>
    </motion.div>
  </div>
);

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function AnaliseMassaPage() {
  const [data, setData] = useState<MassMemoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetFP, setTargetFP] = useState(0.92);
  const [tariff, setTariff] = useState(0.306);
  const [potenciaInstalada, setPotenciaInstalada] = useState<number>(1575);
  const [samplingInterval, setSamplingInterval] = useState(15);
  const [fileName, setFileName] = useState<string>("");
  const [recalcKey, setRecalcKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRecalcular = useCallback(() => {
    setRecalcKey((prev) => prev + 1);
    Swal.fire({
      title: "Analise Recalculada!",
      text: `Dimensionamento atualizado com potencia instalada de ${potenciaInstalada} kVA`,
      icon: "success",
      timer: 2000,
      showConfirmButton: false,
    });
  }, [potenciaInstalada]);

  const handleClearData = useCallback(() => {
    Swal.fire({
      title: "Limpar dados?",
      text: "Todos os dados serao removidos do sistema.",
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
        Swal.fire("Dados limpos!", "Faça upload de um novo arquivo.", "success");
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
        
        const resultado = await processarArquivo(content, targetFP);
        
        if (resultado.dados.length === 0) {
          throw new Error("Nenhum dado valido encontrado. Verifique o formato do arquivo.");
        }
        
        setSamplingInterval(resultado.intervaloAmostragem);
        setData(resultado.dados);
        
        const fpMedio = resultado.dados.reduce((a, b) => a + b.fp, 0) / resultado.dados.length;
        
        Swal.fire({
          title: "Arquivo processado!",
          html: `${resultado.totalRegistros.toLocaleString()} registros<br>Intervalo: ${resultado.intervaloAmostragem} min<br>FP medio: ${fpMedio.toFixed(3)}`,
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
    [targetFP],
  );

  const exportToPDF = async () => {
    const element = document.getElementById("report-content");
    if (!element) return;
    
    setLoading(true);
    try {
      const dataUrl = await toPng(element, {
        quality: 0.95,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
      });
      
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const img = new Image();
      img.src = dataUrl;
      
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      
      const ratio = pdfWidth / img.width;
      const imgHeight = img.height * ratio;
      
      pdf.addImage(dataUrl, "PNG", 0, 10, pdfWidth, imgHeight);
      
      const dataAtual = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
      pdf.save(`Relatorio_Capacitor_${dataAtual}.pdf`);
      
      Swal.fire("Sucesso", "Relatorio PDF exportado com sucesso!", "success");
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
      "Horario Critico": d.isHorarioCritico ? "SIM" : "NAO",
      "Correcao Necessaria (kVAr)": d.kvarNecessario.toFixed(1).replace(".", ","),
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

  const horariosCriticos = useMemo(
    () => (data.length ? analisarHorariosCriticos(data) : []),
    [data],
  );
  
  const periodosAnalise = useMemo(
    () => (data.length ? analisarPeriodosCriticos(data, targetFP) : []),
    [data, targetFP],
  );

  const analiseDiasSemana = useMemo((): AnaliseDiaSemana[] => {
    if (data.length === 0) return [];
    
    const diasMap = new Map<string, { somaKvar: number; count: number; multa: number }>();
    const samplesPerHour = 60 / samplingInterval;
    
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
    
    return DIAS_SEMANA
      .map((dia) => {
        const info = diasMap.get(dia)!;
        return {
          dia,
          kvarMedio: info.count > 0 ? info.somaKvar / info.count : 0,
          count: info.count,
          multa: info.multa,
        };
      })
      .filter((d) => d.count > 0);
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
    
    const periodoAnalise = {
      inicio: `${data[0].data} ${data[0].hora}`,
      fim: `${data[data.length - 1].data} ${data[data.length - 1].hora}`,
    };
    
    const percentualMultaIndutiva = multaDetalhada.total > 0
      ? (multaDetalhada.indutiva / multaDetalhada.total) * 100
      : 0;
    const percentualMultaCapacitiva = multaDetalhada.total > 0
      ? (multaDetalhada.capacitiva / multaDetalhada.total) * 100
      : 0;
    
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
      return {
        ...d,
        horaLabel: showFullLabel ? d.hora : "",
        tooltipLabel: `${d.data} ${d.hora}`,
      };
    });
  }, [data]);

  const piorPeriodo = periodosAnalise.length > 0 ? periodosAnalise[0] : null;
  
  if (loading) return <LoadingOverlay mensagem="Processando arquivo..." />;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 px-4 md:px-6">
      {/* HERO SECTION */}
      <motion.section
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-primary to-primary/90 rounded-3xl p-8 md:p-12 text-white shadow-2xl"
      >
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-secondary/20 to-transparent pointer-events-none rounded-r-3xl" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-secondary text-xs font-bold tracking-wider uppercase">
            <Cpu size={14} />
            Analise Avancada • ANEEL 414/2010
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
            Capacitor Manager
          </h1>
          <p className="text-lg text-white/70 leading-relaxed">
            Transforme dados brutos em economia real. Detectamos reativo
            excedente, calculamos multas conforme ANEEL e sugerimos a correcao
            exata para sua instalacao.
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <label className="flex items-center gap-2 bg-secondary text-primary px-6 py-3 rounded-xl font-bold shadow-lg shadow-secondary/20 cursor-pointer hover:scale-105 transition-transform">
              <Upload size={20} />
              Importar CSV
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
            {data.length > 0 && (
              <>
                <button
                  onClick={exportToPDF}
                  className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors"
                >
                  <FileDown size={20} /> PDF
                </button>
                <button
                  onClick={downloadCSV}
                  className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors"
                >
                  <Download size={20} /> CSV
                </button>
                <button
                  onClick={handleClearData}
                  className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 rounded-xl font-bold hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={20} /> Limpar
                </button>
              </>
            )}
          </div>
          {fileName && (
            <p className="text-xs text-white/50 flex items-center gap-2">
              <FileText size={12} />
              {fileName} • {data.length.toLocaleString()} registros • 
              Amostragem: {samplingInterval}min • {stats?.diasNoArquivo || 0} dias
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
            <h2 className="text-xl font-semibold text-slate-700 mb-2">
              Aguardando dados...
            </h2>
            <p className="text-slate-500 max-w-md text-center mb-6">
              Faça upload do CSV da sua concessionaria com colunas de kW e kVAr.
            </p>
            <div className="bg-slate-50 p-4 rounded-xl max-w-lg text-sm text-slate-500">
              <p className="font-semibold mb-2">Formatos suportados:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Landis+Gyr (Memoria de Massa)</li>
                <li>Equatorial (Demanda)</li>
                <li>CSV padrao com colunas: Data, Hora, kW, kVAr</li>
                <li>Separadores: ponto e virgula (;) ou virgula (,)</li>
                <li>Numeros no formato brasileiro (1.234,56)</li>
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
            <AlertaMultaIndutiva multaIndutiva={stats?.multaIndutiva || 0} />
            <AlertaMultaCapacitiva multaCapacitiva={stats?.multaCapacitiva || 0} />

            {horariosCriticos.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-red-50 to-orange-50 p-8 rounded-3xl border border-red-200"
              >
                <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                  <h3 className="text-2xl font-bold text-red-800 flex items-center gap-2">
                    <AlertCircle size={24} /> Horarios de Baixo Fator de Potencia
                  </h3>
                  <span className="text-xs bg-red-200 text-red-700 px-3 py-1 rounded-full font-bold">
                    Multa aplicavel pela ANEEL
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {horariosCriticos.map((horario, idx) => (
                    <div
                      key={idx}
                      className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Clock size={16} className="text-red-500" />
                          <span className="font-mono text-lg font-bold text-red-700">
                            {horario.hora}
                          </span>
                        </div>
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                          {horario.ocorrencias} ocorrencias
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Media de Reativo:</span>
                          <span className="font-bold text-red-600">
                            {horario.mediaKvar.toFixed(1)} kVAr
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                          <div
                            className="bg-red-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, (horario.mediaKvar / 100) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        Recomendacao: Instalar banco de capacitores automatico
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {analiseDiasSemana.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-green-50 to-teal-50 p-8 rounded-3xl border border-green-200"
              >
                <h3 className="text-2xl font-bold text-primary mb-6 flex items-center gap-2">
                  <Calendar size={24} /> Analise por Dia da Semana
                </h3>
                <div className="space-y-3">
                  {analiseDiasSemana.map((dia, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl shadow-sm">
                      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
                        <span className="font-bold text-slate-700 w-24">{dia.dia}</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">kVAr Medio</span>
                            <span className="text-red-600 font-bold">
                              {dia.kvarMedio.toFixed(1)} kVAr
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2">
                            <div
                              className="bg-red-500 h-2 rounded-full"
                              style={{ width: `${Math.min(100, (dia.kvarMedio / 50) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right min-w-[100px]">
                          <p className="text-xs text-slate-500">Multa Estimada</p>
                          <p className="text-sm font-bold text-red-600">
                            R$ {dia.multa.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {periodosAnalise.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-3xl border border-blue-200"
              >
                <h3 className="text-2xl font-bold text-primary mb-6 flex items-center gap-2">
                  <Clock size={24} /> Analise por Periodo do Dia
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {periodosAnalise.map((periodo, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "rounded-xl p-4 border-2 transition-all",
                        periodo.nivelCriticidade === "CRITICO"
                          ? "border-red-400 bg-red-50"
                          : periodo.nivelCriticidade === "ATENCAO"
                          ? "border-amber-400 bg-amber-50"
                          : "border-green-400 bg-green-50",
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-slate-700 text-sm">
                          {periodo.nome}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-bold px-2 py-1 rounded-full",
                            periodo.nivelCriticidade === "CRITICO"
                              ? "bg-red-500 text-white"
                              : periodo.nivelCriticidade === "ATENCAO"
                              ? "bg-amber-500 text-white"
                              : "bg-green-500 text-white",
                          )}
                        >
                          {periodo.nivelCriticidade}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">FP Medio:</span>
                          <span
                            className={cn(
                              "font-bold",
                              periodo.fpMedio < targetFP ? "text-red-600" : "text-green-600",
                            )}
                          >
                            {(periodo.fpMedio * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">kVAr Medio:</span>
                          <span className="font-bold text-primary">
                            {periodo.kvarMedio.toFixed(1)} kVAr
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Registros Criticos:</span>
                          <span className="font-bold text-red-600">
                            {periodo.registrosCriticos} / {periodo.totalRegistros}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {piorPeriodo && (
                  <div className="mt-6 p-4 bg-white rounded-xl border border-blue-200">
                    <h4 className="font-bold text-primary mb-2 flex items-center gap-2">
                      <Zap size={18} className="text-secondary" /> Recomendacao
                    </h4>
                    {piorPeriodo.nivelCriticidade === "CRITICO" ? (
                      <p className="text-sm text-slate-700">
                        O periodo mais critico e <strong>{piorPeriodo.nome}</strong> com{" "}
                        <strong className="text-red-600">{piorPeriodo.percentualCritico.toFixed(1)}%</strong>{" "}
                        do tempo com FP abaixo de {targetFP * 100}%.<br />
                        Recomenda-se instalar banco de capacitores <strong>automatico</strong>.
                      </p>
                    ) : (
                      <p className="text-sm text-slate-700">
                        Todos os periodos estao dentro da conformidade.
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* DASHBOARD */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-50 rounded-lg text-red-600">
                    <DollarSign size={20} />
                  </div>
                  <span className="text-sm font-medium text-slate-500">
                    Multa no periodo
                  </span>
                </div>
                <p className="text-3xl font-bold text-slate-900">
                  R$ {stats?.multaPeriodo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Projetado 30 dias:{" "}
                  <strong>
                    R$ {stats?.multaMensalProjetada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </strong>
                </p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <Zap size={20} />
                  </div>
                  <span className="text-sm font-medium text-slate-500">
                    Pico de Demanda
                  </span>
                </div>
                <p className="text-3xl font-bold text-slate-900">
                  {stats?.picoDemanda.toFixed(1)} kW
                </p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                    <TrendingUp size={20} />
                  </div>
                  <span className="text-sm font-medium text-slate-500">
                    FP Medio
                  </span>
                </div>
                <p className="text-3xl font-bold text-slate-900">
                  {(stats?.fpMedio || 0).toFixed(3)}
                </p>
                <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5">
                  <div
                    className={cn(
                      "h-1.5 rounded-full",
                      (stats?.fpMedio || 0) < targetFP ? "bg-red-500" : "bg-green-500",
                    )}
                    style={{ width: `${(stats?.fpMedio || 0) * 100}%` }}
                  />
                </div>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-50 rounded-lg text-green-600">
                    <CheckCircle2 size={20} />
                  </div>
                  <span className="text-sm font-medium text-slate-500">
                    Conformidade
                  </span>
                </div>
                <p className="text-3xl font-bold text-slate-900">
                  {stats?.percentualConformidade.toFixed(1)}%
                </p>
              </motion.div>
            </div>

            {/* DIMENSIONAMENTO */}
            {dimensionamento && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-3xl border border-blue-200"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-primary flex items-center gap-2">
                    <Cpu size={24} /> Dimensionamento do Banco
                  </h3>
                  <button
                    onClick={handleRecalcular}
                    className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <RefreshCw size={16} /> Recalcular
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white p-6 rounded-2xl">
                    <h4 className="text-sm font-bold text-slate-400 uppercase mb-4">
                      Medias Gerais
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-600">kW Medio:</span>
                        <span className="font-bold text-primary">
                          {dimensionamento.mediaKW.toFixed(1)} kW
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">kVAr Medio:</span>
                        <span className="font-bold text-primary">
                          {dimensionamento.mediaKvar.toFixed(1)} kVAr
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">FP Medio:</span>
                        <span
                          className={cn(
                            "font-bold",
                            dimensionamento.mediaFP >= targetFP ? "text-green-600" : "text-red-600",
                          )}
                        >
                          {dimensionamento.mediaFP.toFixed(3)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl">
                    <h4 className="text-sm font-bold text-slate-400 uppercase mb-4">
                      Periodos Criticos
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Ocorrencias:</span>
                        <span className="font-bold text-red-600">
                          {dimensionamento.periodosCriticos}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">% do Total:</span>
                        <span className="font-bold text-red-600">
                          {dimensionamento.percentualCritico.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Variabilidade (CV):</span>
                        <span className="font-bold">
                          {dimensionamento.coeficienteVariacao.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border-2 border-secondary">
                    <h4 className="text-sm font-bold text-secondary uppercase mb-4">
                      Recomendacao
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Tipo:</span>
                        <span className="px-2 py-1 rounded text-xs font-bold uppercase bg-blue-100 text-blue-700">
                          {dimensionamento.tipoRecomendado === "fixo" ? "Fixo" : 
                           dimensionamento.tipoRecomendado === "automatico" ? "Automatico" : "Hibrido"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Capacidade:</span>
                        <span className="font-bold text-2xl text-primary">
                          {dimensionamento.bancoSugeridoAutomatico} kVAr
                        </span>
                      </div>
                      {dimensionamento.paybackMeses > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">Payback:</span>
                          <span className="font-bold text-green-600">
                            {dimensionamento.paybackMeses} meses
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl">
                  <p className="text-slate-700 leading-relaxed">
                    {dimensionamento.justificativa}
                  </p>
                </div>
                {dimensionamento.tipoRecomendado !== "fixo" && dimensionamento.bancoSugeridoAutomatico > 0 && (
                  <div className="mt-6 bg-white p-6 rounded-2xl">
                    <h4 className="text-sm font-bold text-slate-400 uppercase mb-4">
                      Estagios Recomendados
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {gerarEstagiosCapacitores(dimensionamento.bancoSugeridoAutomatico).map((estagio, idx) => (
                        <div key={idx} className="bg-blue-50 px-4 py-2 rounded-lg">
                          <span className="text-xs">Estagio {idx + 1}:</span>
                          <span className="font-bold text-blue-700 ml-2">{estagio} kVAr</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-6 bg-white p-6 rounded-2xl border-2 border-green-500">
                  <h4 className="text-sm font-bold text-green-600 uppercase mb-4">
                    Orcamento Estimado
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Investimento:</span>
                        <span className="font-bold text-lg">
                          R$ {dimensionamento.orcamentoEstimado.min.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} - R$ {dimensionamento.orcamentoEstimado.max.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Economia Mensal:</span>
                        <span className="font-bold text-green-600 text-lg">
                          R$ {dimensionamento.economiaMensalEstimada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* GRAFICOS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100"
              >
                <h3 className="text-lg font-bold text-primary mb-6">
                  Curva de Carga (kW)
                </h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="horaLabel" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis domain={[0, 'auto']} />
                      <Tooltip 
                        labelFormatter={(_, payload) => {
                          if (payload && payload[0]?.payload) {
                            return payload[0].payload.tooltipLabel;
                          }
                          return "";
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="kw"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.1}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100"
              >
                <h3 className="text-lg font-bold text-primary mb-6">
                  Fator de Potencia
                </h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="horaLabel" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis domain={[0.5, 1]} />
                      <Tooltip 
                        labelFormatter={(_, payload) => {
                          if (payload && payload[0]?.payload) {
                            return payload[0].payload.tooltipLabel;
                          }
                          return "";
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="fp"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                      />
                      <ReferenceLine
                        y={targetFP}
                        stroke="#ef4444"
                        strokeDasharray="5 5"
                        label={{ value: `Meta ${targetFP*100}%`, fill: "#ef4444", fontSize: 10 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>

            {/* OBSERVACAO */}
            {dimensionamento && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="bg-amber-50 border-2 border-amber-200 p-6 rounded-3xl mt-6 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="bg-amber-100 p-3 rounded-full text-amber-600 flex-shrink-0">
                    <AlertTriangle size={24} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-amber-900 font-bold text-lg flex items-center gap-2">
                      Observacao Importante
                    </h4>
                    <p className="text-amber-800 leading-relaxed">
                      O sistema recomenda{" "}
                      <strong>
                        {dimensionamento.tipoRecomendado === "fixo"
                          ? dimensionamento.bancoSugeridoFixo
                          : dimensionamento.bancoSugeridoAutomatico}{" "} kVAr
                      </strong>{" "}
                      para corrigir o fator de potencia. Verifique a configuracao do banco existente antes de instalar novos capacitores.
                    </p>
                    <div className="pt-2 flex items-center gap-2 text-xs text-amber-700 font-medium italic">
                      <Info size={14} />
                      <span>
                        Nota: Se houver capacitores fixos instalados apos o ponto de medicao, a necessidade real pode diferir do valor calculado.
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* CONFIGURACAO E RESUMO */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-100">
                <h4 className="font-bold text-primary mb-4 flex items-center gap-2">
                  <Settings size={16} /> Configuracao
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                      Potencia Instalada (kVA)
                    </label>
                    <input
                      type="number"
                      step="10"
                      value={potenciaInstalada}
                      onChange={(e) => setPotenciaInstalada(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                      Meta Fator de Potencia
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.7"
                      max="0.99"
                      value={targetFP}
                      onChange={(e) => setTargetFP(parseFloat(e.target.value) || 0.92)}
                      className="w-full bg-slate-50 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <button
                    onClick={handleRecalcular}
                    className="w-full bg-primary text-white py-2 rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Recalcular
                  </button>
                </div>
              </div>
              <div className="bg-primary p-6 rounded-3xl text-white shadow-xl col-span-2 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Zap className="text-secondary" /> Resumo Executivo
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-white/60 text-xs">Multa Mensal Estimada</p>
                    <p className="text-xl font-bold">
                      R$ {stats?.multaMensalProjetada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Banco Recomendado</p>
                    <p className="text-xl font-bold">
                      {dimensionamento?.bancoSugeridoAutomatico || 0} kVAr
                    </p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Payback Estimado</p>
                    <p className="text-xl font-bold">
                      {dimensionamento?.paybackMeses || 0} meses
                    </p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Conformidade</p>
                    <p className="text-xl font-bold">
                      {stats?.percentualConformidade.toFixed(0)}%
                    </p>
                  </div>
                </div>
                <button
                  onClick={exportToPDF}
                  className="w-full bg-secondary text-primary font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-secondary/90 transition-colors"
                >
                  <Download size={18} /> Exportar Relatorio PDF
                </button>
              </div>
            </div>

            {/* TABELA */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100"
            >
              <h3 className="text-lg font-bold text-primary mb-6 flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" /> Top 10 Registros com Maior kVAr
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100">
                      <th className="pb-4">Data/Hora</th>
                      <th className="pb-4">Dia</th>
                      <th className="pb-4">kW</th>
                      <th className="pb-4">kVAr</th>
                      <th className="pb-4">FP</th>
                      <th className="pb-4">Correcao</th>
                    </td>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data
                      .filter((d) => d.fp < targetFP && d.tipoReativo === "indutivo")
                      .sort((a, b) => b.kvar - a.kvar)
                      .slice(0, 10)
                      .map((row, idx) => (
                        <tr key={idx} className="text-sm hover:bg-slate-50 transition-colors">
                          <td className="py-3 font-medium text-slate-700">
                            {row.data} {row.hora}
                          </td>
                          <td className="py-3 text-slate-600">{row.diaSemana || "-"}</td>
                          <td className="py-3 text-slate-600">{row.kw.toFixed(1)}</td>
                          <td className="py-3 font-bold text-red-600">{row.kvar.toFixed(1)}</td>
                          <td className="py-3 font-bold text-red-500">{row.fp.toFixed(3)}</td>
                          <td className="py-3 text-slate-600">
                            {row.kvarNecessario > 0 ? `${row.kvarNecessario.toFixed(0)} kVAr` : "-"}
                          </td>
                        <tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}