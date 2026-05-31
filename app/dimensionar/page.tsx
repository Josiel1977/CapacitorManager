"use client";

import React, { useState, useRef, useEffect, Suspense, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  Calculator, Zap, DollarSign, CheckCircle2, Loader2, AlertTriangle,
  Package, History, Printer, Activity, Plus, Trash2, Save, Edit3, X, Factory, FileUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import jsPDF from "jspdf";
import { toPng } from "html-to-image";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

// ==================== CONSTANTES E CONFIGURAÇÕES ====================
const FP_MINIMO_REGULAMENTAR = 0.92;
const TARIFAS_REATIVO: Record<string, number> = {
  EQUATORIAL_PARA: 0.28622,
  RORAIMA_ENERGIA: 0.30603,
  DEFAULT: 0.28622,
};
const PRECOS_MERCADO_CAPACITORES: Record<string, any> = {
  "20": { preco_medio: 5400, faixa_preco: "R$ 4.900 - R$ 5.900", fornecedores: ["FASF", "Genérico", "5G"] },
  "30": { preco_medio: 5300, faixa_preco: "R$ 4.800 - R$ 5.800", fornecedores: ["FASF", "5G", "WEG"] },
  "40": { preco_medio: 7067, faixa_preco: "R$ 6.500 - R$ 7.500", fornecedores: ["FASF", "5G"] },
  "50": { preco_medio: 9700, faixa_preco: "R$ 8.900 - R$ 10.500", fornecedores: ["FASF", "5G", "Siemens"] },
  "60": { preco_medio: 11640, faixa_preco: "R$ 10.500 - R$ 12.500", fornecedores: ["FASF", "5G", "WEG"] },
  "70": { preco_medio: 13600, faixa_preco: "R$ 12.500 - R$ 14.800", fornecedores: ["FASF", "ABB"] },
  "80": { preco_medio: 14500, faixa_preco: "R$ 13.500 - R$ 15.500", fornecedores: ["FASF", "5G"] },
  "90": { preco_medio: 15300, faixa_preco: "R$ 14.000 - R$ 16.500", fornecedores: ["FASF", "5G"] },
  "100": { preco_medio: 18700, faixa_preco: "R$ 17.500 - R$ 19.900", fornecedores: ["5G", "FASF", "WEG"] },
  "120": { preco_medio: 21500, faixa_preco: "R$ 19.900 - R$ 23.000", fornecedores: ["FASF", "5G"] },
  "150": { preco_medio: 25500, faixa_preco: "R$ 23.500 - R$ 27.500", fornecedores: ["5G", "WEG"] },
  "180": { preco_medio: 26900, faixa_preco: "R$ 24.900 - R$ 28.900", fornecedores: ["FASF", "5G"] },
  "210": { preco_medio: 27300, faixa_preco: "R$ 25.500 - R$ 29.500", fornecedores: ["FASF", "5G"] },
  "240": { preco_medio: 28500, faixa_preco: "R$ 26.500 - R$ 30.500", fornecedores: ["FASF"] },
  "280": { preco_medio: 29600, faixa_preco: "R$ 27.500 - R$ 31.500", fornecedores: ["FASF"] },
  "300": { preco_medio: 32500, faixa_preco: "R$ 30.000 - R$ 35.000", fornecedores: ["WEG", "ABB"] },
};
const FORNECEDORES_RECOMENDADOS = [
  { nome: "WEG", site: "www.weg.net", especialidade: "Equipamentos industriais premium" },
  { nome: "FASF", site: "www.fasf.com.br", especialidade: "Bancos de capacitores especializados" },
  { nome: "5G Equipamentos", site: "www.5geq.com.br", especialidade: "Custo-benefício" },
  { nome: "ABB", site: "new.abb.com/br", especialidade: "Tecnologia suíça" },
  { nome: "Siemens", site: "www.siemens.com/br", especialidade: "Automação e energia" },
];
const CONFIG_CAPACITORES = {
  tensao_padrao_380v: "440V",
  tensao_padrao_220v: "260V",
  minimo_kvar_grupo_a: 20,
  minimo_kvar_grupo_b: 10,
  dessintonia_padrao: 7,
};

// ==================== INTERFACES ====================
interface Transformador {
  id: string;
  potencia_kva: number;
  quantidade: number;
  tensao_v: number;
  horas_trabalho: number;
}
interface Fatura {
  id: string;
  mes_referencia: string;
  consumo_ponta_kwh: number;
  consumo_fora_ponta_kwh: number;
  demanda_ponta_kw: number;
  demanda_fora_ponta_kw: number;
  reativo_ponta_kvarh: number;
  reativo_fora_ponta_kvarh: number;
  total_pagar: number;
  dias_ciclo: number;
  concessionaria: string;
  tenant_id?: string;
  fp_calculado?: number;
}
interface FaturaProcessada extends Fatura {
  ativoTotal: number;
  reativoTotal: number;
  fp: number;
  multa: number;
  demandaMaxKw: number;
  alertaFp?: string;
}
interface DistribuicaoTrafo {
  trafo_kva: number;
  percentual: number;
  kvar_recomendado: number;
  kvar_comercial: number;
  preco_estimado: number;
  configuracao_estagios: string;
}
interface ResultadoDimensionamento {
  banco_automatico_kvar: number;
  estagios_automaticos: number[];
  tensao_capacitores: string;
  fator_dessintonia: number;
  economia_mensal_estimada: number;
  investimento_estimado_total: number;
  payback_meses: number;
  fp_atual_percent: number;
  fp_projetado_percent: number;
  multa_atual_mensal_real: number;
  potencia_ativa_utilizada_kw: number;
  precisa_capacitor: boolean;
  grupo_tarifario: "A" | "B";
  motivo_recomendacao: string;
  concessionaria_identificada: string;
  quantidade_faturas_analisadas: number;
  pior_mes: Fatura | null;
  media_fp_por_mes: Array<{ mes: string; fp: number; multa: number }>;
  alertas: string[];
  distribuicao_por_trafo: DistribuicaoTrafo[];
  fornecedores_recomendados: typeof FORNECEDORES_RECOMENDADOS;
  preco_por_kvar: number;
  economia_anual: number;
  retorno_5_anos: number;
  prejuizo_acumulado: number;
  projecao_1_ano: number;
  projecao_3_anos: number;
  projecao_5_anos: number;
  roi_5_anos_percent: number;
  metodo_calculo_utilizado: string;
  fator_carga_utilizado: number;
  numero_estagios: number;
}

// ==================== FUNÇÕES AUXILIARES ====================
const parseBRLocal = (valor: any): number => {
  if (valor === undefined || valor === null) return 0;
  if (typeof valor === "number") return valor;
  const str = String(valor).replace(/[^\d,.-]/g, "").replace(",", ".");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};
const formatMoney = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
const formatNumber = (valor: number, dec = 2) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(valor);
const parseMesReferencia = (mesRef: string) => {
  const [m, a] = mesRef.split("/");
  const mes = Number(m), ano = Number(a);
  return isNaN(mes) || isNaN(ano) ? -Infinity : ano * 100 + mes;
};

// ✅ CORREÇÃO: Cálculo do FP com validação de limites
const calcularFatorPotencia = (ativo: number, reativo: number) => {
  if (ativo <= 0) return FP_MINIMO_REGULAMENTAR;
  const aparente = Math.sqrt(ativo ** 2 + reativo ** 2);
  if (aparente === 0) return FP_MINIMO_REGULAMENTAR;
  const fp = ativo / aparente;
  return Math.min(0.99, Math.max(0.30, fp));
};

// ✅ CORREÇÃO: Cálculo da multa conforme ANEEL - apenas sobre o excedente ao limite regulatório
const calcularMultaDaFatura = (fat: Fatura): number => {
  const ativoTotal = fat.consumo_ponta_kwh + fat.consumo_fora_ponta_kwh;
  const reativoTotal = fat.reativo_ponta_kvarh + fat.reativo_fora_ponta_kvarh;
  
  if (ativoTotal <= 0) return 0;
  
  const fpAtual = calcularFatorPotencia(ativoTotal, reativoTotal);
  
  // ✅ Só há multa se FP < 0.92
  if (fpAtual >= FP_MINIMO_REGULAMENTAR) return 0;
  
  // Cálculo do reativo permitido (sem multa) para FP mínimo de 0.92
  const angMinimo = Math.acos(FP_MINIMO_REGULAMENTAR);
  const reativoPermitido = ativoTotal * Math.tan(angMinimo);
  
  // Reativo excedente sujeito à multa
  const reativoExcedente = Math.max(0, reativoTotal - reativoPermitido);
  
  const tarifa = TARIFAS_REATIVO[fat.concessionaria] ?? TARIFAS_REATIVO.DEFAULT;
  return reativoExcedente * tarifa;
};

// ✅ NOVA FUNÇÃO: Valida e prioriza o FP mais confiável
const validarFatorPotencia = (
  fpLido: number | undefined, 
  ativo: number, 
  reativo: number
): { fp: number; alerta?: string } => {
  const fpCalculado = calcularFatorPotencia(ativo, reativo);
  
  // Se não houver FP lido válido, usa o calculado
  if (!fpLido || fpLido <= 0.2 || fpLido >= 1) {
    return { fp: fpCalculado };
  }
  
  // Se a diferença for > 15%, há inconsistência nos dados
  const diferenca = Math.abs(fpLido - fpCalculado);
  if (diferenca > 0.15) {
    return {
      fp: fpCalculado,
      alerta: `⚠️ Inconsistência: FP lido (${(fpLido*100).toFixed(1)}%) difere do calculado (${(fpCalculado*100).toFixed(1)}%). Usado valor calculado.`
    };
  }
  
  // Valores consistentes: usa média ponderada (60% lido, 40% calculado)
  return { fp: fpLido * 0.6 + fpCalculado * 0.4 };
};

// ✅ CORREÇÃO: Cálculo de kVAr com margem de segurança e consideração de harmônicos
const calcularKvarNecessario = (
  p: number, 
  fpAtual: number, 
  fpDesejado: number,
  opcoes?: { margemSeguranca?: number; considerarHarmonicos?: boolean }
) => {
  const { margemSeguranca = 1.15, considerarHarmonicos = true } = opcoes || {};
  
  const angAtual = Math.acos(Math.min(0.99, Math.max(0.3, fpAtual)));
  const angDes = Math.acos(Math.min(0.99, Math.max(fpDesejado, FP_MINIMO_REGULAMENTAR)));
  
  let kvar = p * (Math.tan(angAtual) - Math.tan(angDes));
  
  // Margem de segurança para crescimento de carga
  kvar *= margemSeguranca;
  
  // Se considerar harmônicos, adicionar 10% para reatores de dessintonia
  if (considerarHarmonicos) {
    kvar *= 1.10;
  }
  
  // Arredondamento prático para valores comerciais (múltiplos de 2.5)
  kvar = Math.max(0, Math.ceil(kvar / 2.5) * 2.5);
  
  return Math.max(kvar, CONFIG_CAPACITORES.minimo_kvar_grupo_a);
};

const distribuirEstagios = (totalKvar: number, numEstagios: number): number[] => {
  const n = Math.min(12, Math.max(6, numEstagios));
  const baseSeq = [1, 2.5, 5, 10, 20, 40, 80, 160, 320];
  const stages: number[] = [];
  let soma = 0;
  
  for (let i = 0; i < baseSeq.length && stages.length < n; i++) {
    if (soma + baseSeq[i] <= totalKvar) {
      stages.push(baseSeq[i]);
      soma += baseSeq[i];
    } else break;
  }
  
  let restante = totalKvar - soma;
  let restantes = n - stages.length;
  
  if (restantes > 0 && restante > 0) {
    let unit = Math.ceil(restante / restantes / 2.5) * 2.5;
    if (unit < 2.5) unit = 2.5;
    for (let i = 0; i < restantes; i++) {
      let add = i === restantes - 1 ? restante - unit * (restantes - 1) : unit;
      if (add < 2.5) add = 2.5;
      stages.push(add);
      soma += add;
      restante = totalKvar - soma;
    }
  } else if (restante > 0 && restantes === 0) {
    stages.push(restante);
  }
  
  if (Math.abs(soma - totalKvar) > 0.01) {
    const diff = totalKvar - soma;
    stages[stages.length - 1] = Math.max(2.5, stages[stages.length - 1] + diff);
    stages[stages.length - 1] = Math.ceil(stages[stages.length - 1] / 2.5) * 2.5;
  }
  
  return stages.filter((s) => s > 0).sort((a, b) => a - b);
};

const calcularPrecoMercado = (kvar: number) => {
  const pots = Object.keys(PRECOS_MERCADO_CAPACITORES).map(Number).sort((a, b) => a - b);
  let prox = pots[0];
  for (const p of pots) {
    if (Math.abs(kvar - p) < Math.abs(kvar - prox)) prox = p;
  }
  const preco = PRECOS_MERCADO_CAPACITORES[prox]?.preco_medio || 25000;
  return kvar !== prox ? Math.round(kvar * (preco / prox)) : preco;
};

const distribuirKvarPorTrafo = (
  transformadores: Transformador[],
  estagiosGlobais: number[],
  kvarTotal: number,
): DistribuicaoTrafo[] => {
  const potenciaTotal = transformadores.reduce((acc, t) => acc + t.potencia_kva * t.quantidade, 0);
  if (potenciaTotal <= 0 || kvarTotal <= 0) return [];
  
  return transformadores.map((trafo) => {
    const potenciaTrafo = trafo.potencia_kva * trafo.quantidade;
    const percentual = potenciaTrafo / potenciaTotal;
    const kvarRecomendado = kvarTotal * percentual;
    const kvarComercial = Math.ceil(kvarRecomendado / 10) * 10;
    
    let estagiosProporcionais = estagiosGlobais.map((s) => s * percentual);
    estagiosProporcionais = estagiosProporcionais.map((s) => Math.max(2.5, Math.ceil(s / 2.5) * 2.5));
    
    let soma = estagiosProporcionais.reduce((a, b) => a + b, 0);
    const diff = kvarComercial - soma;
    if (Math.abs(diff) > 0.01) {
      estagiosProporcionais[estagiosProporcionais.length - 1] += diff;
      estagiosProporcionais[estagiosProporcionais.length - 1] = Math.max(
        2.5,
        Math.ceil(estagiosProporcionais[estagiosProporcionais.length - 1] / 2.5) * 2.5,
      );
    }
    
    const configuracao = estagiosProporcionais.map((s) => `${s.toFixed(1)}`).join(" + ") + " kVAr";
    const precoEstimado = calcularPrecoMercado(kvarComercial);
    
    return {
      trafo_kva: potenciaTrafo,
      percentual: percentual * 100,
      kvar_recomendado: kvarRecomendado,
      kvar_comercial: kvarComercial,
      preco_estimado: precoEstimado,
      configuracao_estagios: configuracao,
    };
  });
};

// ✅ CORREÇÃO: Validação completa das faturas
const validarFaturas = (faturas: Fatura[]): { alertas: string[]; faturasValidadas: boolean } => {
  const alertas: string[] = [];
  
  for (const fat of faturas) {
    const ativo = fat.consumo_ponta_kwh + fat.consumo_fora_ponta_kwh;
    const reativo = fat.reativo_ponta_kvarh + fat.reativo_fora_ponta_kvarh;
    const { alerta } = validarFatorPotencia(fat.fp_calculado, ativo, reativo);
    
    if (alerta) alertas.push(`${fat.mes_referencia}: ${alerta}`);
    
    const fpCalculado = calcularFatorPotencia(ativo, reativo);
    if (fpCalculado < 0.80) {
      alertas.push(`${fat.mes_referencia}: FP crítico (${(fpCalculado*100).toFixed(1)}%) - verificar instalação`);
    }
    
    if (reativo > ativo * 2) {
      alertas.push(`${fat.mes_referencia}: Reativo muito elevado - possível banco desregulado`);
    }
    
    if (fat.consumo_fora_ponta_kwh < 100) {
      alertas.push(`${fat.mes_referencia}: Consumo muito baixo - verificar extração do PDF`);
    }
  }
  
  return { alertas, faturasValidadas: true };
};

// ==================== PDF PARSER MELHORADO ====================
let pdfjsLib: any = null;
async function carregarPDFJS() {
  if (typeof window === 'undefined') return null;
  if (pdfjsLib) return pdfjsLib;
  const module = await import('pdfjs-dist');
  pdfjsLib = module;
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
  return pdfjsLib;
}

async function extrairTextoDoPDF(file: File): Promise<string> {
  const pdfjs = await carregarPDFJS();
  if (!pdfjs) throw new Error("PDF.js não carregado");
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let textoCompleto = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(" ");
    textoCompleto += pageText + "\n";
  }
  return textoCompleto;
}

// ✅ CORREÇÃO: Parser robusto para Equatorial Pará com múltiplos padrões de regex
function parseFaturaFromPDF(texto: string): Partial<Fatura> & { concessionaria: string } {
  const dados: any = {
    concessionaria: "EQUATORIAL_PARA",
    mes_referencia: "",
    consumo_ponta_kwh: 0,
    consumo_fora_ponta_kwh: 0,
    demanda_ponta_kw: 0,
    demanda_fora_ponta_kw: 0,
    reativo_ponta_kvarh: 0,
    reativo_fora_ponta_kvarh: 0,
    total_pagar: 0,
    dias_ciclo: 30,
    fp_calculado: undefined,
  };

  // Detecção da concessionária
  if (!texto.includes("Equatorial Pará") && !texto.includes("EQUATORIAL")) {
    dados.concessionaria = "DESCONHECIDA";
    return dados;
  }

  // ✅ Mês/Ano - múltiplos padrões
  let mesMatch = texto.match(/Compet[êe]ncia:\s*(\d{2}\/\d{4})/i) ||
                 texto.match(/ND00A027[\s\S]*?(\d{2}\/\d{4})/i) ||
                 texto.match(/Conta\s+M[êe]s[\s:]+(\d{2}\/\d{4})/i) ||
                 texto.match(/\b(\d{2}\/\d{4})\b/);
  if (mesMatch) dados.mes_referencia = mesMatch[1];

  // ✅ Consumos ativos (kWh) - padrões específicos Equatorial
  const fpConsumo = texto.match(/Consumo\s+Ativo\s+FP\s+Reg[^\d]*([\d\.]+,\d+)/i);
  if (fpConsumo) dados.consumo_fora_ponta_kwh = parseFloat(fpConsumo[1].replace(/\./g, "").replace(",", "."));

  const pConsumo = texto.match(/Consumo\s+Ativo\s+NP\s+Reg[^\d]*([\d\.]+,\d+)/i);
  if (pConsumo) dados.consumo_ponta_kwh = parseFloat(pConsumo[1].replace(/\./g, "").replace(",", "."));

  // Fallback genérico para kWh
  if (!dados.consumo_fora_ponta_kwh) {
    const kWhRegex = /(\d{1,3}(?:\.\d{3})*,\d+)\s*kWh/gi;
    const matches = [...texto.matchAll(kWhRegex)].map(m => parseFloat(m[1].replace(/\./g, "").replace(",", ".")));
    const validos = matches.filter(n => n > 0 && n < 100000).sort((a, b) => b - a);
    if (validos.length >= 2) {
      [dados.consumo_fora_ponta_kwh, dados.consumo_ponta_kwh] = [validos[0], validos[1]];
    } else if (validos.length === 1) {
      dados.consumo_fora_ponta_kwh = validos[0];
    }
  }

  // ✅ Reativo excedente - múltiplos padrões Equatorial
  const reativoPatterns = [
    /Reat\.\s*Exced\.\s*(?:F\.\s*)?Ponta[^\d]*([\d\.]+,\d+)/i,
    /Consumo\s+Reativo\s+Exced\s+(?:FP|NP|F\.?\s*Ponta)?[^\d]*([\d\.]+,\d+)/i,
    /kVAr[^\d]*([\d\.]+,\d+)[^\d]*kVArh?/i,
  ];
  
  for (const pattern of reativoPatterns) {
    const match = texto.match(pattern);
    if (match && !dados.reativo_fora_ponta_kvarh) {
      dados.reativo_fora_ponta_kvarh = parseFloat(match[1].replace(/\./g, "").replace(",", "."));
      break;
    }
  }
  
  const reatP = texto.match(/Reat\.\s*Exced\.\s*Ponta[^\d]*([\d\.]+,\d+)/i) ||
                texto.match(/Consumo\s+Reativo\s+Exced\s+NP[^\d]*([\d\.]+,\d+)/i);
  if (reatP) dados.reativo_ponta_kvarh = parseFloat(reatP[1].replace(/\./g, "").replace(",", "."));

  // Fallback genérico para reativos
  if (!dados.reativo_fora_ponta_kvarh) {
    const reativoRegex = /(\d{1,3}(?:\.\d{3})*,\d+)\s*kVArh?/gi;
    const matches = [...texto.matchAll(reativoRegex)].map(m => parseFloat(m[1].replace(/\./g, "").replace(",", ".")));
    const validos = matches.filter(n => n > 0 && n < 100000).sort((a, b) => b - a);
    if (validos.length >= 2) {
      [dados.reativo_fora_ponta_kvarh, dados.reativo_ponta_kvarh] = [validos[0], validos[1]];
    } else if (validos.length === 1) {
      dados.reativo_fora_ponta_kvarh = validos[0];
    }
  }

  // ✅ Demanda (kW)
  let demFP = texto.match(/Dem\.\s*Máx\.\s*F\.\s*Ponta\s*\(kW\):\s*([\d,\.]+)/i) ||
              texto.match(/Demanda\s+Distribui[çc][ãa]o\s*\(kW\):\s*([\d,\.]+)/i) ||
              texto.match(/Demanda\s+Ativa\s+FP\s+Reg[^\d]*([\d,\.]+)/i);
  if (demFP) dados.demanda_fora_ponta_kw = parseFloat(demFP[1].replace(",", "."));

  let demP = texto.match(/Dem\.\s*Máx\.\s*Ponta\s*\(kW\):\s*([\d,\.]+)/i) ||
             texto.match(/Demanda\s+Ativa\s+NP\s+Reg[^\d]*([\d,\.]+)/i);
  if (demP) dados.demanda_ponta_kw = parseFloat(demP[1].replace(",", "."));

  // Estimativa se não encontrada
  if ((!dados.demanda_fora_ponta_kw || dados.demanda_fora_ponta_kw === 0) && dados.consumo_fora_ponta_kwh > 0) {
    dados.demanda_fora_ponta_kw = Math.round(dados.consumo_fora_ponta_kwh / 200);
  }
  if (!dados.demanda_ponta_kw || dados.demanda_ponta_kw === 0) {
    dados.demanda_ponta_kw = dados.demanda_fora_ponta_kw;
  }

  // ✅ Fator de potência - regex melhorado para Equatorial
  const fpMatch = texto.match(/FATOR\s+DE\s+POT[ÊE]NCIA\s*[:\s]+([\d,\.]+)/i) ||
                  texto.match(/FP\s*[:\s]+([\d,\.]+)/i);
  if (fpMatch) {
    let fp = parseFloat(fpMatch[1].replace(/\./g, "").replace(",", "."));
    if (fp > 0.2 && fp < 1) {
      dados.fp_calculado = fp;
      if (fp < 0.80) {
        console.warn(`⚠️ FP muito baixo detectado: ${fp.toFixed(4)} - verificar medição`);
      }
    }
  }

  // ✅ Valor total
  let valorMatch = texto.match(/Valor\s+cobrado\s*\(R\$\):\s*([\d\.]+,\d{2})/i) ||
                   texto.match(/Total\s+a\s+Pagar\s*R\$\s*([\d\.]+,\d{2})/i) ||
                   texto.match(/R\$\s+([\d\.]+,\d{2})[\s\n]*Protocolo/i);
  if (valorMatch) dados.total_pagar = parseFloat(valorMatch[1].replace(/\./g, "").replace(",", "."));

  // Dias do ciclo
  const diasMatch = texto.match(/N[ºo]\s+de\s+Dias\s*(\d+)/i);
  if (diasMatch) dados.dias_ciclo = parseInt(diasMatch[1]);

  console.log(`📄 Fatura ${dados.mes_referencia} - FP lido: ${dados.fp_calculado?.toFixed(4) || 'N/A'}`);
  return dados;
}

// ==================== COMPONENTES VISUAIS ====================
// ✅ NOVO COMPONENTE: Indicador visual de status do FP
const IndicadorFP = ({ fp }: { fp: number }) => {
  const status = fp >= 0.92 ? "ok" : fp >= 0.80 ? "atencao" : "critico";
  const cores = {
    ok: "bg-green-100 text-green-800 border-green-300",
    atencao: "bg-amber-100 text-amber-800 border-amber-300",
    critico: "bg-red-100 text-red-800 border-red-300 animate-pulse"
  };
  const labels = {
    ok: "✓ Dentro da norma",
    atencao: "⚠️ Abaixo do ideal",
    critico: "🚨 FP crítico"
  };
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${cores[status]}`}>
      {(fp * 100).toFixed(1)}% • {labels[status]}
    </span>
  );
};

const BarraFP = ({ fp, meta = 92 }: { fp: number; meta?: number }) => {
  const percentual = Math.min(100, Math.max(0, (fp / meta) * 100));
  const cor = fp >= 92 ? "bg-green-500" : fp >= 80 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="w-full bg-slate-200 rounded-full h-2">
      <div className={`${cor} h-2 rounded-full transition-all duration-300`} style={{ width: `${percentual}%` }} />
    </div>
  );
};

// ==================== COMPONENTE PRINCIPAL ====================
export default function DimensionarPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    }>
      <DimensionarContent />
    </Suspense>
  );
}

function DimensionarContent() {
  const router = useRouter();
  const reportRef = useRef<HTMLDivElement>(null);
  const [transformadores, setTransformadores] = useState<Transformador[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [targetFP, setTargetFP] = useState(0.92);
  const [result, setResult] = useState<ResultadoDimensionamento | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [showFaturaModal, setShowFaturaModal] = useState(false);
  const [currentFatura, setCurrentFatura] = useState<any>({});
  const [editandoFaturaId, setEditandoFaturaId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [fatorCarga, setFatorCarga] = useState(0.65);
  const [numeroEstagios, setNumeroEstagios] = useState(6);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [demandaPersonalizadaKw, setDemandaPersonalizadaKw] = useState(0);
  const [margemSeguranca, setMargemSeguranca] = useState(0);
  const [empresaNome, setEmpresaNome] = useState("Sua Empresa");
  const [importandoPDF, setImportandoPDF] = useState(false);

  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session && mounted) {
        setTenantId(null);
        setCarregando(true);
        const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", session.user.id).single();
        if (profile?.tenant_id) {
          setTenantId(profile.tenant_id);
          const { data: tenantData } = await supabase.from("tenants").select("nome").eq("id", profile.tenant_id).single();
          if (tenantData?.nome) setEmpresaNome(tenantData.nome);
          await carregarDados(profile.tenant_id);
        } else Swal.fire("Erro", "Perfil não configurado.", "error");
        setCarregando(false);
      } else if (event === "SIGNED_OUT" && mounted) {
        setCarregando(false);
        setTenantId(null);
        setFaturas([]);
        setTransformadores([]);
      }
    });
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && mounted) {
        const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", session.user.id).single();
        if (profile?.tenant_id) {
          setTenantId(profile.tenant_id);
          const { data: tenantData } = await supabase.from("tenants").select("nome").eq("id", profile.tenant_id).single();
          if (tenantData?.nome) setEmpresaNome(tenantData.nome);
          await carregarDados(profile.tenant_id);
        } else Swal.fire("Erro", "Perfil não configurado.", "error");
      } else if (mounted) setCarregando(false);
    })();
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [router]);

  const carregarDados = async (tenant: string) => {
    try {
      const { data: trafosDB } = await supabase.from("transformadores").select("*").eq("tenant_id", tenant).order("created_at");
      if (trafosDB?.length) setTransformadores(trafosDB);
      else {
        const defaultTrafos = [
          { id: crypto.randomUUID(), potencia_kva: 300, quantidade: 1, tensao_v: 380, horas_trabalho: 220, tenant_id: tenant },
          { id: crypto.randomUUID(), potencia_kva: 225, quantidade: 1, tensao_v: 380, horas_trabalho: 220, tenant_id: tenant },
        ];
        await supabase.from("transformadores").insert(defaultTrafos);
        setTransformadores(defaultTrafos.map(({ tenant_id, ...rest }) => rest));
      }
      const { data: faturasDB } = await supabase.from("faturas").select("*").eq("tenant_id", tenant).order("mes_referencia", { ascending: false });
      if (faturasDB?.length) setFaturas(faturasDB);
      else {
        // Dados das faturas UNIÃO AGRO analisadas
        const faturasRaw = [
          { id: crypto.randomUUID(), mes_referencia: "11/2025", consumo_ponta_kwh: 457.21, consumo_fora_ponta_kwh: 5179.86, demanda_ponta_kw: 18.82, demanda_fora_ponta_kw: 53.42, reativo_ponta_kvarh: 493.76, reativo_fora_ponta_kvarh: 4696.54, total_pagar: 12617.50, dias_ciclo: 30, concessionaria: "EQUATORIAL_PARA", tenant_id: tenant, fp_calculado: undefined },
          { id: crypto.randomUUID(), mes_referencia: "12/2025", consumo_ponta_kwh: 595.56, consumo_fora_ponta_kwh: 6106.21, demanda_ponta_kw: 39.65, demanda_fora_ponta_kw: 40.66, reativo_ponta_kvarh: 1130.49, reativo_fora_ponta_kvarh: 8932.83, total_pagar: 14486.71, dias_ciclo: 31, concessionaria: "EQUATORIAL_PARA", tenant_id: tenant, fp_calculado: 0.3678 },
          { id: crypto.randomUUID(), mes_referencia: "01/2026", consumo_ponta_kwh: 558.52, consumo_fora_ponta_kwh: 5974.50, demanda_ponta_kw: 37.96, demanda_fora_ponta_kw: 39.98, reativo_ponta_kvarh: 993.00, reativo_fora_ponta_kvarh: 8690.47, total_pagar: 13728.12, dias_ciclo: 31, concessionaria: "EQUATORIAL_PARA", tenant_id: tenant, fp_calculado: undefined },
        ];
        await supabase.from("faturas").insert(faturasRaw);
        setFaturas(faturasRaw);
      }
    } catch (error: any) {
      Swal.fire("Erro", error.message || "Falha ao carregar dados.", "error");
    } finally {
      setCarregando(false);
    }
  };

  const salvarTransformadores = async () => {
    if (!tenantId) return;
    const { error } = await supabase.from("transformadores").upsert(transformadores.map((t) => ({ ...t, tenant_id: tenantId })), { onConflict: "id" });
    error ? Swal.fire("Erro", "Não foi possível salvar.", "error") : Swal.fire("✅ Sucesso!", "Configuração salva!", "success");
  };
  const adicionarTransformador = () => setTransformadores([...transformadores, { id: crypto.randomUUID(), potencia_kva: 100, quantidade: 1, tensao_v: 220, horas_trabalho: 220 }]);
  const removerTransformador = async (idx: number) => {
    if (transformadores.length <= 1) return;
    const removido = transformadores[idx];
    setTransformadores(transformadores.filter((_, i) => i !== idx));
    if (removido.id && !removido.id.startsWith("temp_")) await supabase.from("transformadores").delete().eq("id", removido.id);
  };
  const atualizarTransformador = (idx: number, field: keyof Transformador, value: number) => {
    const novos = [...transformadores];
    novos[idx] = { ...novos[idx], [field]: value };
    setTransformadores(novos);
  };
  const potenciaTotalTransformadores = transformadores.reduce((acc, t) => acc + t.potencia_kva * t.quantidade, 0);

  const salvarFatura = async () => {
    if (!currentFatura.mes_referencia) return Swal.fire("Atenção", "Mês/ano obrigatório", "warning");
    if (!tenantId) return;
    const novaFatura = {
      id: editandoFaturaId || crypto.randomUUID(),
      mes_referencia: currentFatura.mes_referencia,
      consumo_ponta_kwh: parseBRLocal(currentFatura.consumo_ponta_str),
      consumo_fora_ponta_kwh: parseBRLocal(currentFatura.consumo_fora_str),
      demanda_ponta_kw: parseBRLocal(currentFatura.demanda_ponta_str),
      demanda_fora_ponta_kw: parseBRLocal(currentFatura.demanda_fora_str),
      reativo_ponta_kvarh: parseBRLocal(currentFatura.reativo_ponta_str),
      reativo_fora_ponta_kvarh: parseBRLocal(currentFatura.reativo_fora_str),
      total_pagar: parseBRLocal(currentFatura.total_pagar_str),
      dias_ciclo: currentFatura.dias_ciclo ?? 30,
      concessionaria: currentFatura.concessionaria || "EQUATORIAL_PARA",
      tenant_id: tenantId,
      fp_calculado: currentFatura.fp_calculado ? parseFloat(currentFatura.fp_calculado) : undefined,
    };
    const { error } = await supabase.from("faturas").upsert(novaFatura, { onConflict: "id" });
    if (error) return Swal.fire("Erro", "Não foi possível salvar.", "error");
    let novas = editandoFaturaId ? faturas.map((f) => (f.id === editandoFaturaId ? novaFatura : f)) : [novaFatura, ...faturas];
    novas.sort((a, b) => parseMesReferencia(b.mes_referencia) - parseMesReferencia(a.mes_referencia));
    setFaturas(novas);
    setShowFaturaModal(false);
    setCurrentFatura({});
    setEditandoFaturaId(null);
    Swal.fire("✅ Sucesso!", "Fatura salva!", "success");
  };
  const removerFatura = async (id: string) => {
    if (!(await Swal.fire({ title: "Remover?", icon: "warning", showCancelButton: true, confirmButtonText: "Remover" })).isConfirmed) return;
    const { error } = await supabase.from("faturas").delete().eq("id", id);
    if (error) Swal.fire("Erro", "Não foi possível remover.", "error");
    else setFaturas(faturas.filter((f) => f.id !== id));
  };

  const onDropPDF = useCallback(async (acceptedFiles: File[]) => {
    if (!tenantId) return Swal.fire("Erro", "Tenant não identificado.", "error");
    const file = acceptedFiles[0];
    if (!file) return;
    setImportandoPDF(true);
    try {
      const texto = await extrairTextoDoPDF(file);
      const dadosExtraidos = parseFaturaFromPDF(texto);
      if (!dadosExtraidos.mes_referencia) throw new Error("Não foi possível identificar o mês/ano da fatura.");
      
      const confirm = await Swal.fire({
        title: "Dados extraídos do PDF",
        html: `<div class="text-left text-sm">
          <p><strong>Mês:</strong> ${dadosExtraidos.mes_referencia}</p>
          <p><strong>Consumo Ponta:</strong> ${dadosExtraidos.consumo_ponta_kwh} kWh</p>
          <p><strong>Consumo Fora Ponta:</strong> ${dadosExtraidos.consumo_fora_ponta_kwh} kWh</p>
          <p><strong>Reativo Ponta:</strong> ${dadosExtraidos.reativo_ponta_kvarh} kVArh</p>
          <p><strong>Reativo Fora Ponta:</strong> ${dadosExtraidos.reativo_fora_ponta_kvarh} kVArh</p>
          <p><strong>Demanda Ponta:</strong> ${dadosExtraidos.demanda_ponta_kw} kW</p>
          <p><strong>Demanda Fora Ponta:</strong> ${dadosExtraidos.demanda_fora_ponta_kw} kW</p>
          <p><strong>Valor Total:</strong> ${formatMoney(dadosExtraidos.total_pagar || 0)}</p>
          <p><strong>Concessionária:</strong> ${dadosExtraidos.concessionaria}</p>
          <p><strong>Fator de Potência:</strong> ${dadosExtraidos.fp_calculado ? (dadosExtraidos.fp_calculado * 100).toFixed(1) + '%' : 'não identificado'}</p>
        </div>`,
        icon: "info",
        showCancelButton: true,
        confirmButtonText: "Salvar fatura",
        cancelButtonText: "Cancelar",
      });
      if (!confirm.isConfirmed) { setImportandoPDF(false); return; }
      
      const novaFatura: any = {
        id: crypto.randomUUID(),
        mes_referencia: dadosExtraidos.mes_referencia,
        consumo_ponta_kwh: dadosExtraidos.consumo_ponta_kwh || 0,
        consumo_fora_ponta_kwh: dadosExtraidos.consumo_fora_ponta_kwh || 0,
        demanda_ponta_kw: dadosExtraidos.demanda_ponta_kw || 0,
        demanda_fora_ponta_kw: dadosExtraidos.demanda_fora_ponta_kw || 0,
        reativo_ponta_kvarh: dadosExtraidos.reativo_ponta_kvarh || 0,
        reativo_fora_ponta_kvarh: dadosExtraidos.reativo_fora_ponta_kvarh || 0,
        total_pagar: dadosExtraidos.total_pagar || 0,
        dias_ciclo: dadosExtraidos.dias_ciclo || 30,
        concessionaria: dadosExtraidos.concessionaria || "EQUATORIAL_PARA",
        tenant_id: tenantId,
        fp_calculado: dadosExtraidos.fp_calculado,
      };
      const { error } = await supabase.from("faturas").insert(novaFatura);
      if (error) throw error;
      setFaturas((prev) => [novaFatura, ...prev]);
      Swal.fire("✅ Sucesso!", `Fatura ${novaFatura.mes_referencia} importada com sucesso.`, "success");
    } catch (err: any) {
      console.error(err);
      Swal.fire("Erro na leitura", err.message || "Não foi possível interpretar o PDF.", "error");
    } finally {
      setImportandoPDF(false);
    }
  }, [tenantId]);

  const { getRootProps, getInputProps } = useDropzone({ 
    onDrop: onDropPDF, 
    accept: { "application/pdf": [".pdf"] }, 
    multiple: false 
  });

  // ✅ CORREÇÃO: Função de cálculo com validação e fallback robusto
  const calcularDimensionamento = () => {
    if (faturas.length < 2) {
      Swal.fire("Atenção", "Mínimo de 2 faturas necessárias para análise.", "warning");
      return;
    }
    setCalculando(true);
    
    try {
      const alertas: string[] = [];
      const concessionarias = [...new Set(faturas.map((f) => f.concessionaria))];
      if (concessionarias.length > 1) alertas.push(`⚠️ Faturas de diferentes concessionárias: ${concessionarias.join(", ")}`);

      // Processar faturas com validação de FP
      const faturasProcessadas: FaturaProcessada[] = faturas.map((f) => {
        const ativoTotal = f.consumo_ponta_kwh + f.consumo_fora_ponta_kwh;
        const reativoTotal = f.reativo_ponta_kvarh + f.reativo_fora_ponta_kvarh;
        const { fp, alerta } = validarFatorPotencia(f.fp_calculado, ativoTotal, reativoTotal);
        const multa = calcularMultaDaFatura(f);
        const demandaMaxKw = Math.max(f.demanda_ponta_kw, f.demanda_fora_ponta_kw, 0.1);
        
        if (alerta) alertas.push(`${f.mes_referencia}: ${alerta}`);
        
        console.log(`📊 ${f.mes_referencia} – Ativo:${ativoTotal.toFixed(0)} Reativo:${reativoTotal.toFixed(0)} FP:${(fp*100).toFixed(1)}% Multa:${formatMoney(multa)}`);
        
        return { ...f, ativoTotal, reativoTotal, fp, multa, demandaMaxKw, alertaFp: alerta };
      });

      // Pior mês (menor FP válido)
      const piorMes = faturasProcessadas.reduce((prev, curr) => {
        const fpPrev = (prev.fp >= 0.99 || prev.fp <= 0.3) ? Infinity : prev.fp;
        const fpCurr = (curr.fp >= 0.99 || curr.fp <= 0.3) ? Infinity : curr.fp;
        return fpCurr < fpPrev ? curr : prev;
      }, faturasProcessadas[0]);
      
      let fpAtual = piorMes.fp;
      if (fpAtual >= 0.99 || fpAtual <= 0.3) {
        const totalAtivo = faturasProcessadas.reduce((s, f) => s + f.ativoTotal, 0);
        const totalReativo = faturasProcessadas.reduce((s, f) => s + f.reativoTotal, 0);
        fpAtual = calcularFatorPotencia(totalAtivo, totalReativo);
        alertas.push(`⚠️ FP do pior mês inválido. Recalculado (média geral): ${(fpAtual*100).toFixed(1)}%`);
      }

      const fpDesejado = targetFP;
      const mediaMulta = faturasProcessadas.reduce((acc, f) => acc + f.multa, 0) / faturasProcessadas.length;
      let demandaReal = Math.max(...faturasProcessadas.map((f) => f.demandaMaxKw), 0);

      // Força demanda mínima se extração falhou
      if (demandaReal < 30 && potenciaTotalTransformadores >= 225) {
        demandaReal = 54;
        alertas.push("⚠️ Demanda extraída muito baixa. Utilizado valor de referência: 54 kW.");
      }

      let potenciaBase = demandaPersonalizadaKw > 0 ? demandaPersonalizadaKw : demandaReal;
      let potenciaAtivaFinal = potenciaBase * (1 + margemSeguranca / 100);
      
      const precisaCapacitor = fpAtual < FP_MINIMO_REGULAMENTAR || mediaMulta > 200;
      let kvarAutomatico = 0, estagios: number[] = [], economiaMensal = 0, motivo = "";
      
      if (precisaCapacitor) {
        kvarAutomatico = calcularKvarNecessario(potenciaAtivaFinal, fpAtual, fpDesejado, {
          margemSeguranca: 1 + margemSeguranca/100,
          considerarHarmonicos: true
        });
        kvarAutomatico = Math.ceil(kvarAutomatico / 10) * 10;
        kvarAutomatico = Math.max(kvarAutomatico, CONFIG_CAPACITORES.minimo_kvar_grupo_a);
        estagios = distribuirEstagios(kvarAutomatico, numeroEstagios);
        economiaMensal = mediaMulta * 0.92;
        motivo = `Potência ativa = ${potenciaAtivaFinal.toFixed(1)} kW | FP atual = ${(fpAtual*100).toFixed(1)}% | Meta = ${(fpDesejado*100).toFixed(0)}% → kVAr necessário = ${kvarAutomatico.toFixed(1)} kVAr.`;
      } else {
        const mediaFp = faturasProcessadas.reduce((a, b) => a + b.fp, 0) / faturasProcessadas.length;
        motivo = `✅ Sistema regularizado (FP médio: ${(mediaFp*100).toFixed(1)}%)`;
      }
      
      const investimentoTotal = calcularPrecoMercado(kvarAutomatico);
      const payback = economiaMensal > 0 ? Math.ceil(investimentoTotal / economiaMensal) : 99;
      const economiaAnual = economiaMensal * 12;
      const retorno5Anos = economiaAnual * 5 - investimentoTotal;
      const prejuizoAcumulado = faturasProcessadas.reduce((acc, f) => acc + f.multa, 0);
      const projecao1Ano = economiaAnual - investimentoTotal;
      const projecao3Anos = economiaAnual * 3 - investimentoTotal;
      const projecao5Anos = retorno5Anos;
      const roi5AnosPercent = investimentoTotal > 0 ? (projecao5Anos / investimentoTotal) * 100 : 0;
      const precoPorKvar = kvarAutomatico > 0 ? investimentoTotal / kvarAutomatico : 0;
      const distribuicaoPorTrafo = distribuirKvarPorTrafo(transformadores, estagios, kvarAutomatico);
      const tensaoCapacitores = transformadores[0]?.tensao_v === 380 ? CONFIG_CAPACITORES.tensao_padrao_380v : CONFIG_CAPACITORES.tensao_padrao_220v;
      const mediaFpPorMes = faturasProcessadas.map((f) => ({ mes: f.mes_referencia, fp: f.fp * 100, multa: f.multa })).sort((a, b) => a.fp - b.fp);
      const grupoTarifario = potenciaTotalTransformadores >= 75 ? "A" : "B";

      setResult({
        banco_automatico_kvar: kvarAutomatico,
        estagios_automaticos: estagios,
        tensao_capacitores: tensaoCapacitores,
        fator_dessintonia: CONFIG_CAPACITORES.dessintonia_padrao,
        economia_mensal_estimada: economiaMensal,
        investimento_estimado_total: investimentoTotal,
        payback_meses: payback,
        fp_atual_percent: fpAtual * 100,
        fp_projetado_percent: precisaCapacitor ? fpDesejado * 100 : fpAtual * 100,
        multa_atual_mensal_real: mediaMulta,
        potencia_ativa_utilizada_kw: potenciaAtivaFinal,
        precisa_capacitor: precisaCapacitor,
        grupo_tarifario: grupoTarifario,
        motivo_recomendacao: motivo,
        concessionaria_identificada: concessionarias[0] || "NÃO IDENTIFICADA",
        quantidade_faturas_analisadas: faturasProcessadas.length,
        pior_mes: piorMes || null,
        media_fp_por_mes: mediaFpPorMes,
        alertas: alertas,
        distribuicao_por_trafo: distribuicaoPorTrafo,
        fornecedores_recomendados: FORNECEDORES_RECOMENDADOS,
        preco_por_kvar: precoPorKvar,
        economia_anual: economiaAnual,
        retorno_5_anos: retorno5Anos,
        prejuizo_acumulado: prejuizoAcumulado,
        projecao_1_ano: projecao1Ano,
        projecao_3_anos: projecao3Anos,
        projecao_5_anos: projecao5Anos,
        roi_5_anos_percent: roi5AnosPercent,
        metodo_calculo_utilizado: "Fórmula clássica P×Δtan + margem segurança + harmônicos",
        fator_carga_utilizado: fatorCarga,
        numero_estagios: numeroEstagios,
      });

      Swal.fire({
        title: precisaCapacitor ? "✅ Dimensionamento Concluído" : "✅ Análise Concluída",
        html: `<div class="text-center"><p class="text-lg font-bold">FP no pior mês: ${(fpAtual*100).toFixed(1)}%</p>${
          precisaCapacitor ? `<p class="text-primary font-bold mt-2">🔋 Recomendação:<br/>• Banco automático: ${kvarAutomatico.toFixed(1)} kVAr (${estagios.length} estágios)</p>` : '<p class="text-green-600 mt-2">Sistema dentro das normas ANEEL</p>'
        }<p class="text-xs text-slate-500 mt-2">💰 Multa média: ${formatMoney(mediaMulta)}/mês</p><p class="text-xs text-slate-500">💰 Investimento estimado: ${formatMoney(investimentoTotal)}</p><p class="text-xs text-slate-500">⏱️ Payback: ${payback} meses</p></div>`,
        icon: precisaCapacitor ? "success" : "info",
        timer: 8000,
      });
    } catch (error) {
      console.error(error);
      Swal.fire("Erro", "Falha ao processar dimensionamento", "error");
    } finally {
      setCalculando(false);
    }
  };

  const exportMemorial = async () => {
    if (!reportRef.current) return;
    try {
      Swal.fire({ title: "Gerando PDF...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
      const element = reportRef.current;
      const dataUrl = await toPng(element, { quality: 1.0, backgroundColor: "#ffffff", pixelRatio: 2 });
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
      const pdfHeight = pdf.internal.pageSize.getHeight() - 20;
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => (img.onload = resolve));
      const imgHeight = (img.height * pdfWidth) / img.width;
      let position = 0, heightLeft = imgHeight, page = 1;
      pdf.addImage(dataUrl, "PNG", 10, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, "PNG", 10, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
        page++;
      }
      pdf.save(`Dimensionamento_Capacitor_${empresaNome.replace(/\s/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
      Swal.close();
      Swal.fire({ title: "PDF gerado!", text: `Memorial exportado em ${page} página(s).`, icon: "success" });
    } catch (error) {
      Swal.close();
      Swal.fire({ title: "Erro", text: "Falha ao gerar PDF", icon: "error" });
    }
  };

  if (carregando) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-primary" size={32} /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-primary">Dimensionamento de Banco de Capacitores</h1>
        <p className="text-slate-500 mt-2">Análise baseada em faturas - {empresaNome}</p>
        <p className="text-xs text-slate-400 mt-1">
          Infraestrutura: {transformadores.map((t) => `${t.quantidade}x${t.potencia_kva}kVA`).join(" + ")} | {transformadores[0]?.tensao_v || 380}V
        </p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* COLUNA ESQUERDA – Configurações */}
        <div className="lg:col-span-5 space-y-6">
          {/* Transformadores */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-primary flex gap-2"><Package size={20} /> Transformadores</h2>
              <button onClick={salvarTransformadores} className="text-xs bg-primary text-white px-3 py-1 rounded-lg flex items-center gap-1"><Save size={12} /> Salvar</button>
            </div>
            <div className="space-y-3">
              {transformadores.map((trafo, idx) => (
                <div key={trafo.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="flex-1 flex gap-2">
                    <div>
                      <label className="text-[8px] font-black">Potência (kVA)</label>
                      <input type="number" value={trafo.potencia_kva} onChange={(e) => atualizarTransformador(idx, "potencia_kva", parseFloat(e.target.value) || 0)} className="w-full rounded-lg border p-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-[8px] font-black">Qtd</label>
                      <input type="number" value={trafo.quantidade} onChange={(e) => atualizarTransformador(idx, "quantidade", parseInt(e.target.value) || 0)} className="w-full rounded-lg border p-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-[8px] font-black">Tensão (V)</label>
                      <input type="number" value={trafo.tensao_v} onChange={(e) => atualizarTransformador(idx, "tensao_v", parseFloat(e.target.value) || 380)} className="w-full rounded-lg border p-2 text-sm" />
                    </div>
                  </div>
                  {transformadores.length > 1 && <button onClick={() => removerTransformador(idx)} className="text-red-400"><Trash2 size={16} /></button>}
                </div>
              ))}
              <button onClick={adicionarTransformador} className="w-full py-2 border-2 border-dashed rounded-xl text-slate-400 text-xs flex items-center justify-center gap-1"><Plus size={14} /> Adicionar Transformador</button>
            </div>
            <div className="mt-4 p-3 bg-primary/5 rounded-xl">
              <div className="flex justify-between text-sm">
                <span>Potência Total Instalada:</span>
                <span className="font-bold text-primary">{formatNumber(potenciaTotalTransformadores, 0)} kVA</span>
              </div>
            </div>
          </div>

          {/* Faturas */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-primary flex gap-2"><History size={20} /> Faturas ({faturas.length})</h2>
              <div className="flex gap-2">
                <div {...getRootProps()} className="cursor-pointer">
                  <input {...getInputProps()} />
                  <button type="button" disabled={importandoPDF} className="text-xs bg-secondary text-primary px-3 py-1 rounded-lg flex gap-1 items-center">
                    {importandoPDF ? <Loader2 size={12} className="animate-spin" /> : <FileUp size={12} />} Importar PDF
                  </button>
                </div>
                <button onClick={() => { setCurrentFatura({}); setEditandoFaturaId(null); setShowFaturaModal(true); }} className="text-xs bg-primary text-white px-3 py-1 rounded-lg flex items-center gap-1"><Plus size={12} /> Adicionar</button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {faturas.map((fat) => {
                const ativo = fat.consumo_ponta_kwh + fat.consumo_fora_ponta_kwh;
                const reativo = fat.reativo_ponta_kvarh + fat.reativo_fora_ponta_kvarh;
                const { fp } = validarFatorPotencia(fat.fp_calculado, ativo, reativo);
                const multa = calcularMultaDaFatura(fat);
                return (
                  <div key={fat.id} className="p-3 rounded-lg bg-slate-50">
                    <div className="flex justify-between items-start">
                      <span className="font-bold">{fat.mes_referencia}</span>
                      <div className="flex gap-2">
                        <button onClick={() => {
                          setCurrentFatura({
                            id: fat.id, mes_referencia: fat.mes_referencia, concessionaria: fat.concessionaria,
                            dias_ciclo: fat.dias_ciclo, consumo_ponta_str: fat.consumo_ponta_kwh.toString(),
                            consumo_fora_str: fat.consumo_fora_ponta_kwh.toString(),
                            demanda_ponta_str: fat.demanda_ponta_kw.toString(),
                            demanda_fora_str: fat.demanda_fora_ponta_kw.toString(),
                            reativo_ponta_str: fat.reativo_ponta_kvarh.toString(),
                            reativo_fora_str: fat.reativo_fora_ponta_kvarh.toString(),
                            total_pagar_str: fat.total_pagar.toString(),
                            fp_calculado: fat.fp_calculado
                          });
                          setEditandoFaturaId(fat.id);
                          setShowFaturaModal(true);
                        }} className="text-blue-500 hover:text-blue-700"><Edit3 size={14} /></button>
                        <button onClick={() => removerFatura(fat.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs mt-2">
                      <div>Consumo Ponta: {formatNumber(fat.consumo_ponta_kwh, 2)} kWh</div>
                      <div>Consumo F/Ponta: {formatNumber(fat.consumo_fora_ponta_kwh, 2)} kWh</div>
                      <div>Reativo Ponta: {formatNumber(fat.reativo_ponta_kvarh, 2)} kVArh</div>
                      <div>Reativo F/Ponta: {formatNumber(fat.reativo_fora_ponta_kvarh, 2)} kVArh</div>
                      <div className="col-span-2 flex items-center justify-between mt-1">
                        <IndicadorFP fp={fp} />
                        <span className="text-xs text-red-500 font-medium">Multa: {formatMoney(multa)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Configurações de Cálculo */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border">
            <label className="block text-sm font-medium mb-2">Fator de Potência Desejado</label>
            <select value={targetFP} onChange={(e) => setTargetFP(parseFloat(e.target.value))} className="w-full rounded-xl border p-3 mb-4">
              <option value={0.92}>0.92 (mínimo ANEEL)</option>
              <option value={0.95}>0.95 (recomendado)</option>
              <option value={0.98}>0.98 (excelente)</option>
            </select>
            
            <details className="mb-4" open>
              <summary className="text-sm font-medium cursor-pointer text-primary flex items-center gap-2">⚙️ Configurações Avançadas</summary>
              <div className="mt-3 space-y-4 p-3 bg-slate-50 rounded-lg">
                <div>
                  <label className="text-xs text-slate-600">Demanda real de pico (kW) – preencha para ignorar estimativas</label>
                  <input type="number" step="1" value={demandaPersonalizadaKw || ""} onChange={(e) => setDemandaPersonalizadaKw(parseFloat(e.target.value) || 0)} placeholder="Ex: 140" className="w-full border rounded px-3 py-2 text-sm mt-1" />
                  <p className="text-[10px] text-slate-500 mt-1">Se preenchido (&gt;0), este valor será usado como potência ativa para dimensionamento.</p>
                </div>
                <div>
                  <label className="text-xs text-slate-600">Margem de Segurança (%)</label>
                  <input type="number" step="5" value={margemSeguranca || ""} onChange={(e) => setMargemSeguranca(parseFloat(e.target.value) || 0)} placeholder="Ex: 15" className="w-full border rounded px-3 py-2 text-sm mt-1" />
                  <p className="text-[10px] text-slate-500 mt-1">Acrescenta um percentual à potência ativa final (recomendado 10-20%).</p>
                </div>
                <div>
                  <label className="text-xs text-slate-600">Fator de Carga (carga média / potência instalada)</label>
                  <input type="range" min="0.3" max="0.9" step="0.05" value={fatorCarga} onChange={(e) => setFatorCarga(parseFloat(e.target.value))} className="w-full" />
                  <div className="flex justify-between text-xs"><span>0.3</span><span className="font-bold">{fatorCarga.toFixed(2)}</span><span>0.9</span></div>
                </div>
                <div>
                  <label className="text-xs text-slate-600">Número de estágios automáticos (6 a 12)</label>
                  <input type="range" min="6" max="12" step="1" value={numeroEstagios} onChange={(e) => setNumeroEstagios(parseInt(e.target.value))} className="w-full" />
                  <div className="flex justify-between text-xs"><span>6</span><span className="font-bold">{numeroEstagios}</span><span>12</span></div>
                </div>
              </div>
            </details>
            
            <button onClick={calcularDimensionamento} disabled={calculando || faturas.length < 2} className="w-full bg-primary text-white py-3 rounded-xl font-bold disabled:opacity-50 flex justify-center gap-2 items-center">
              {calculando ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />} Calcular Dimensionamento
            </button>
          </div>
        </div>

        {/* COLUNA DIREITA – Resultados */}
        <div className="lg:col-span-7">
          {result ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div ref={reportRef} className="bg-white rounded-2xl overflow-hidden shadow-sm border">
                <div className="bg-slate-900 p-6 text-white text-center">
                  <Zap size={32} className="mx-auto text-secondary mb-2" />
                  <h2 className="text-2xl font-black">CapacitorManager</h2>
                  <p className="text-slate-400 text-sm">Memorial de Dimensionamento</p>
                  <p className="text-slate-500 text-xs">Gerado em {new Date().toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="p-6 space-y-6">
                  {result.precisa_capacitor ? (
                    <>
                      <div className="text-center border-b pb-4">
                        <p className="text-sm text-slate-500">Solução Proposta</p>
                        <p className="text-3xl font-bold text-primary">{formatNumber(result.banco_automatico_kvar, 1)} kVAr</p>
                        <p className="text-xs text-slate-400">Banco automático com {result.estagios_automaticos.length} estágios</p>
                        <p className="text-xs text-slate-400">Grupo {result.grupo_tarifario} • {result.quantidade_faturas_analisadas} faturas • Método: {result.metodo_calculo_utilizado}</p>
                        <p className="text-xs text-slate-400">Potência ativa usada: {result.potencia_ativa_utilizada_kw.toFixed(1)} kW</p>
                      </div>
                      
                      {result.alertas.map((a, i) => (
                        <div key={i} className="bg-amber-50 p-3 rounded-xl text-xs text-amber-700 flex gap-2 items-start">
                          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />{a}
                        </div>
                      ))}
                      
                      <div className="bg-blue-50 p-4 rounded-xl">
                        <p className="text-sm font-bold text-blue-700">📌 {result.motivo_recomendacao}</p>
                        <p className="text-xs mt-2">FP atual: {result.fp_atual_percent.toFixed(1)}% → Meta: {result.fp_projetado_percent.toFixed(0)}%</p>
                        <div className="mt-3">
                          <BarraFP fp={result.fp_atual_percent} />
                          <div className="flex justify-between text-[10px] mt-1">
                            <span>Atual: {result.fp_atual_percent.toFixed(1)}%</span>
                            <span>Meta ANEEL: 92%</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-slate-50 rounded-xl p-4">
                        <p className="text-xs font-bold flex gap-2 items-center"><Activity size={14} /> Evolução do FP e Multa por Mês</p>
                        <div className="space-y-2 max-h-48 overflow-y-auto mt-2">
                          {result.media_fp_por_mes.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <span className="w-14 font-medium">{item.mes}</span>
                              <div className="flex-1">
                                <div className="w-full bg-slate-200 rounded-full h-1.5">
                                  <div className={`${item.fp >= 92 ? "bg-green-500" : item.fp >= 80 ? "bg-amber-500" : "bg-red-500"} h-1.5 rounded-full transition-all duration-300`} style={{ width: `${Math.min(100, item.fp)}%` }} />
                                </div>
                              </div>
                              <span className="w-10 text-right font-bold">{item.fp.toFixed(1)}%</span>
                              <span className="w-20 text-right text-red-500 text-[10px]">{formatMoney(item.multa)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {result.pior_mes && (
                        <div className="bg-amber-50 p-4 rounded-xl">
                          <p className="text-xs font-bold">Pior Mês: {result.pior_mes.mes_referencia}</p>
                          <p className="text-sm mt-1">
                            <IndicadorFP fp={(result.pior_mes.fp_calculado || calcularFatorPotencia(result.pior_mes.consumo_ponta_kwh + result.pior_mes.consumo_fora_ponta_kwh, result.pior_mes.reativo_ponta_kvarh + result.pior_mes.reativo_fora_ponta_kvarh)) * 100} />
                            <span className="ml-2">• Multa: {formatMoney(calcularMultaDaFatura(result.pior_mes))}</span>
                          </p>
                        </div>
                      )}
                      
                      <div className="bg-indigo-50 p-4 rounded-xl">
                        <p className="text-xs font-bold flex gap-2 items-center"><Factory size={14} /> Distribuição do Banco entre Transformadores</p>
                        {result.distribuicao_por_trafo.map((dist, idx) => (
                          <div key={idx} className="bg-white rounded-lg p-3 mt-2 border">
                            <div className="flex justify-between">
                              <span className="font-bold text-sm">Transformador {formatNumber(dist.trafo_kva, 0)} kVA</span>
                              <span className="text-xs text-slate-500">{dist.percentual.toFixed(1)}% da carga</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-sm mt-2">
                              <div>Recomendado: {formatNumber(dist.kvar_recomendado, 1)} kVAr</div>
                              <div>Comercial: {formatNumber(dist.kvar_comercial, 0)} kVAr</div>
                              <div className="col-span-2 text-xs text-slate-600">Configuração: {dist.configuracao_estagios}</div>
                              <div className="col-span-2 font-medium">Investimento: {formatMoney(dist.preco_estimado)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="bg-emerald-50 p-4 rounded-xl">
                        <p className="text-xs font-bold flex gap-2 items-center"><DollarSign size={14} /> Análise Financeira Real</p>
                        <div className="grid grid-cols-2 gap-2 text-center mt-2">
                          <div className="bg-white rounded p-2 border">
                            <p className="text-[10px] text-slate-500">Investimento Total</p>
                            <p className="font-bold text-lg">{formatMoney(result.investimento_estimado_total)}</p>
                          </div>
                          <div className="bg-white rounded p-2 border">
                            <p className="text-[10px] text-slate-500">Custo por kVAr</p>
                            <p className="font-bold">{formatMoney(result.preco_por_kvar)}/kVAr</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center mt-2">
                          <div className="bg-white rounded p-2 border">
                            <p className="text-[10px] text-slate-500">Payback</p>
                            <p className="font-bold text-green-600">{result.payback_meses} meses</p>
                          </div>
                          <div className="bg-white rounded p-2 border">
                            <p className="text-[10px] text-slate-500">Economia/ano</p>
                            <p className="font-bold">{formatMoney(result.economia_anual)}</p>
                          </div>
                          <div className="bg-white rounded p-2 border">
                            <p className="text-[10px] text-slate-500">Retorno 5 anos</p>
                            <p className={`font-bold ${result.retorno_5_anos > 0 ? "text-green-700" : "text-red-700"}`}>{formatMoney(result.retorno_5_anos)}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                          <p className="text-xs font-bold text-red-700">a) Prejuízo acumulado</p>
                          <p className="text-xl font-black text-red-700 mt-1">{formatMoney(result.prejuizo_acumulado)}</p>
                          <p className="text-[10px] text-red-600 mt-1">Soma das multas das faturas analisadas.</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                          <p className="text-xs font-bold text-blue-700">b) Projeção de economia</p>
                          <div className="text-[11px] mt-2 space-y-1">
                            <p><strong>1 ano:</strong> {formatMoney(result.projecao_1_ano)}</p>
                            <p><strong>3 anos:</strong> {formatMoney(result.projecao_3_anos)}</p>
                            <p><strong>5 anos:</strong> {formatMoney(result.projecao_5_anos)}</p>
                          </div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                          <p className="text-xs font-bold text-green-700">c) ROI em 5 anos</p>
                          <p className={`text-xl font-black mt-1 ${result.roi_5_anos_percent >= 0 ? "text-green-700" : "text-red-700"}`}>{formatNumber(result.roi_5_anos_percent, 1)}%</p>
                          <p className="text-[10px] text-green-700 mt-1">Indicador de viabilidade financeira do projeto.</p>
                        </div>
                      </div>
                      
                      <div className="bg-white border rounded-xl p-4">
                        <p className="text-xs font-bold">Resumo executivo (proposta comercial)</p>
                        <p className="text-sm mt-2 text-slate-700">
                          Com base no diagnóstico do fator de potência e no histórico de multas, recomenda-se a implantação de banco de capacitores automático para mitigar perdas financeiras recorrentes. A solução projeta redução relevante das penalidades por energia reativa, com retorno estimado em <strong>{result.payback_meses} meses</strong> e ROI de <strong>{formatNumber(result.roi_5_anos_percent, 1)}%</strong> em 5 anos.
                        </p>
                      </div>
                      
                      <div className="bg-slate-50 p-4 rounded-xl">
                        <h4 className="font-bold text-sm mb-2">Especificações Técnicas</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>• Tensão: {result.tensao_capacitores} (Δ)</div>
                          <div>• Reatores: {result.fator_dessintonia}%</div>
                          <div>• Controlador: Automático</div>
                          <div>• Grau IP: Mínimo IP54</div>
                          <div className="col-span-2 text-[10px] text-slate-500 mt-1">• Compatível com rede 3~ 380V • Conformidade NBR 14922/2022</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle2 size={40} className="mx-auto text-green-600 mb-2" />
                      <p className="text-xl font-bold text-green-700">Instalação Regularizada</p>
                      <p className="text-sm mt-2">{result.motivo_recomendacao}</p>
                    </div>
                  )}
                  <div className="text-center text-[10px] text-slate-400 border-t pt-4">
                    <p>Cálculos baseados em ANEEL, NBR 14922/2022 e dados reais de fatura</p>
                  </div>
                </div>
              </div>
              <button onClick={exportMemorial} className="w-full bg-white border py-3 rounded-xl font-medium flex justify-center gap-2 items-center hover:bg-slate-50 transition">
                <Printer size={18} /> Exportar Memorial em PDF
              </button>
            </motion.div>
          ) : (
            <div className="h-[500px] flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-2xl border-2 border-dashed">
              <Calculator size={64} className="text-slate-300 mb-4" />
              <h3 className="text-xl font-bold">Aguardando Dados</h3>
              <p className="text-sm text-slate-400 mt-2">Configure transformadores e adicione faturas para iniciar o dimensionamento</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Fatura */}
      <AnimatePresence>
        {showFaturaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">{editandoFaturaId ? "✏️ Editar" : "➕ Nova Fatura"}</h3>
                <button onClick={() => setShowFaturaModal(false)} className="hover:bg-slate-100 rounded-full p-1"><X size={20} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Mês/Ano *</label>
                  <input type="text" placeholder="Ex: 11/2025" value={currentFatura.mes_referencia || ""} onChange={(e) => setCurrentFatura({ ...currentFatura, mes_referencia: e.target.value })} className="w-full border rounded p-2 mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Concessionária</label>
                  <select value={currentFatura.concessionaria || "EQUATORIAL_PARA"} onChange={(e) => setCurrentFatura({ ...currentFatura, concessionaria: e.target.value })} className="w-full border rounded p-2 mt-1">
                    <option value="EQUATORIAL_PARA">Equatorial Pará</option>
                    <option value="RORAIMA_ENERGIA">Roraima Energia</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs">Consumo Ponta (kWh)</label>
                    <input type="text" placeholder="Ex: 457.21" value={currentFatura.consumo_ponta_str ?? ""} onChange={(e) => setCurrentFatura({ ...currentFatura, consumo_ponta_str: e.target.value })} className="w-full border rounded p-2 text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs">Consumo F/Ponta (kWh)</label>
                    <input type="text" placeholder="Ex: 5179.86" value={currentFatura.consumo_fora_str ?? ""} onChange={(e) => setCurrentFatura({ ...currentFatura, consumo_fora_str: e.target.value })} className="w-full border rounded p-2 text-sm mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs">Demanda Ponta (kW)</label>
                    <input type="text" placeholder="Ex: 53.42" value={currentFatura.demanda_ponta_str ?? ""} onChange={(e) => setCurrentFatura({ ...currentFatura, demanda_ponta_str: e.target.value })} className="w-full border rounded p-2 text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs">Demanda F/Ponta (kW)</label>
                    <input type="text" placeholder="Ex: 53.42" value={currentFatura.demanda_fora_str ?? ""} onChange={(e) => setCurrentFatura({ ...currentFatura, demanda_fora_str: e.target.value })} className="w-full border rounded p-2 text-sm mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-red-600">Reativo Ponta (kVArh) *</label>
                    <input type="text" placeholder="Ex: 493.76" value={currentFatura.reativo_ponta_str ?? ""} onChange={(e) => setCurrentFatura({ ...currentFatura, reativo_ponta_str: e.target.value })} className="w-full border rounded p-2 text-sm mt-1 border-red-200" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-red-600">Reativo F/Ponta (kVArh) *</label>
                    <input type="text" placeholder="Ex: 4696.54" value={currentFatura.reativo_fora_str ?? ""} onChange={(e) => setCurrentFatura({ ...currentFatura, reativo_fora_str: e.target.value })} className="w-full border rounded p-2 text-sm mt-1 border-red-200" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs">Dias do ciclo</label>
                    <input type="text" placeholder="30" value={currentFatura.dias_ciclo ?? "30"} onChange={(e) => setCurrentFatura({ ...currentFatura, dias_ciclo: e.target.value === "" ? 30 : parseInt(e.target.value) })} className="w-full border rounded p-2 text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs">Total a Pagar (R$)</label>
                    <input type="text" placeholder="Ex: 12617.50" value={currentFatura.total_pagar_str ?? ""} onChange={(e) => setCurrentFatura({ ...currentFatura, total_pagar_str: e.target.value })} className="w-full border rounded p-2 text-sm mt-1" />
                  </div>
                </div>
                <div>
                  <label className="text-xs">Fator de Potência (opcional - lido do PDF)</label>
                  <input type="number" step="0.0001" min="0.2" max="0.99" value={currentFatura.fp_calculado ?? ""} onChange={(e) => setCurrentFatura({ ...currentFatura, fp_calculado: parseFloat(e.target.value) || undefined })} className="w-full border rounded p-2 text-sm mt-1" placeholder="Ex: 0.3678" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => {
                  setCurrentFatura({
                    mes_referencia: "05/2025", concessionaria: "RORAIMA_ENERGIA",
                    consumo_ponta_str: "8132", consumo_fora_str: "59050",
                    demanda_ponta_str: "430", demanda_fora_str: "447",
                    reativo_ponta_str: "824", reativo_fora_str: "4511",
                    total_pagar_str: "55970.04", dias_ciclo: 30, fp_calculado: 0.85
                  });
                }} className="flex-1 py-2 border rounded-lg text-sm hover:bg-slate-50 transition">Exemplo Roraima</button>
                <button onClick={salvarFatura} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition">Salvar Fatura</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}