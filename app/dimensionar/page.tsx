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
  "70": { preco_medio: 13600, FAiXa_preco: "R$ 12.500 - R$ 14.800", fornecedores: ["FASF", "ABB"] },
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
  fator_potencia?: number;
  multa_reativo_reais?: number;
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
const calcularFatorPotencia = (ativo: number, reativo: number) => {
  if (ativo <= 0) return 0.92;
  const ap = Math.sqrt(ativo ** 2 + reativo ** 2);
  return ap === 0 ? 0.92 : Math.min(0.99, Math.max(0.3, ativo / ap));
};
const calcularMultaDaFatura = (fat: Fatura) => {
  if (fat.multa_reativo_reais && fat.multa_reativo_reais > 0) {
    return fat.multa_reativo_reais;
  }
  const reativo = fat.reativo_ponta_kvarh + fat.reativo_fora_ponta_kvarh;
  const tarifa = TARIFAS_REATIVO[fat.concessionaria] ?? TARIFAS_REATIVO.DEFAULT;
  return reativo * tarifa;
};
const calcularKvarNecessario = (p: number, fpAtual: number, fpDesejado: number) => {
  const angAtual = Math.acos(Math.min(0.99, Math.max(0.3, fpAtual)));
  const angDes = Math.acos(Math.min(0.99, Math.max(fpDesejado, FP_MINIMO_REGULAMENTAR)));
  let kvar = p * (Math.tan(angAtual) - Math.tan(angDes));
  kvar = Math.max(0, Math.ceil(kvar / 2.5) * 2.5);
  return kvar;
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
    stages[stages.length - 1] += diff;
    let last = stages[stages.length - 1];
    if (last < 2.5) last = 2.5;
    stages[stages.length - 1] = Math.ceil(last / 2.5) * 2.5;
  }
  return stages.filter((s) => s > 0).sort((a, b) => a - b);
};
const calcularPrecoMercado = (kvar: number) => {
  const pots = Object.keys(PRECOS_MERCADO_CAPACITORES).map(Number).sort((a, b) => a - b);
  let prox = pots[0];
  for (const p of pots) if (Math.abs(kvar - p) < Math.abs(kvar - prox)) prox = p;
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

// ==================== PDF PARSER CORRIGIDO PARA EQUATORIAL GRUPO A ====================
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
    fator_potencia: undefined,
    multa_reativo_reais: 0,
  };

  if (!texto.includes("Equatorial Pará") && !texto.includes("equatorial")) {
    dados.concessionaria = "DESCONHECIDA";
    return dados;
  }

  // Mês/Ano (Conta Mês)
  let mesMatch = texto.match(/Conta\s*M[êe]s\s*(\d{2}\/\d{4})/i);
  if (!mesMatch) mesMatch = texto.match(/Competência:\s*(\d{2}\/\d{4})/i);
  if (!mesMatch) mesMatch = texto.match(/\b(\d{2}\/\d{4})\b/);
  if (mesMatch) dados.mes_referencia = mesMatch[1];

  // 🔥 Captura de Consumos Ativos (Ponta e Fora Ponta)
  const consumoPontaMatch = texto.match(/TUSD\s*Energia\s*Ponta\s*\(kWh\)\s*.*?([\d\.]+,\d+)/i);
  if (consumoPontaMatch) dados.consumo_ponta_kwh = parseFloat(consumoPontaMatch[1].replace(/\./g, "").replace(",", "."));

  const consumoForaPontaMatch = texto.match(/TUSD\s*Energia\s*Fora\s*Ponta\s*\(kWh\)\s*.*?([\d\.]+,\d+)/i);
  if (consumoForaPontaMatch) dados.consumo_fora_ponta_kwh = parseFloat(consumoForaPontaMatch[1].replace(/\./g, "").replace(",", "."));

  // 🔥 Captura de Demandas (Soma das duas parcelas para compor a demanda total contratada/faturada)
  let demandaIsenta = 0;
  let demandaNormal = 0;

  const demIsentaMatch = texto.match(/Demanda\s*Distrib\.\s*Isenta\s*ICMS\s*\(kW\)\s*.*?([\d\.]+,\d+)/i);
  if (demIsentaMatch) demandaIsenta = parseFloat(demIsentaMatch[1].replace(/\./g, "").replace(",", "."));

  const demNormalMatch = texto.match(/Demanda\s*Distribui[çc][ãa]o\s*\(kW\)\s*.*?([\d\.]+,\d+)/i);
  if (demNormalMatch) demandaNormal = parseFloat(demNormalMatch[1].replace(/\./g, "").replace(",", "."));

  const demandaTotalCalculada = demandaIsenta + demandaNormal;
  dados.demanda_fora_ponta_kw = demandaTotalCalculada;
  dados.demanda_ponta_kw = demandaTotalCalculada;

  // 🔥 Captura Fina de Reativos Excedentes (Quantidade e o Valor em Reais da Cobrança)
  let totalMultaReais = 0;

  // Reativo Ponta
  const reativoPontaMatch = texto.match(/Reativo\s*Excedente\s*P\s*\(?kVArh?\)?,*.*?([\d\.]+,\d+)\s+.*?([\d\.]+,\d{2})/i);
  if (reativoPontaMatch) {
    dados.reativo_ponta_kvarh = parseFloat(reativoPontaMatch[1].replace(/\./g, "").replace(",", "."));
    totalMultaReais += parseFloat(reativoPontaMatch[2].replace(/\./g, "").replace(",", "."));
  }

  // Reativo Fora Ponta
  const reativoForaPontaMatch = texto.match(/Reativo\s*Excedente\s*NP\s*\(?kVArh?\)?,*.*?([\d\.]+,\d+)\s+.*?([\d\.]+,\d{2})/i);
  if (reativoForaPontaMatch) {
    dados.reativo_fora_ponta_kvarh = parseFloat(reativoForaPontaMatch[1].replace(/\./g, "").replace(",", "."));
    totalMultaReais += parseFloat(reativoForaPontaMatch[2].replace(/\./g, "").replace(",", "."));
  }
  dados.multa_reativo_reais = totalMultaReais;

  // Fator de potência gravado na fatura
  let fpMatch = texto.match(/FATOR\s*DE\s*POT[ÊE]NCIA:\s*(\d+[\.,]?\d*)/i);
  if (fpMatch) {
    let fp = parseFloat(fpMatch[1].replace(",", "."));
    if (fp > 0 && fp < 1) dados.fator_potencia = fp;
  }

  // Valor total a pagar
  let valorMatch = texto.match(/Total\s*a\s*Pagar\s*R\$\s*([\d\.]+,\d{2})/i);
  if (!valorMatch) valorMatch = texto.match(/Valor\s*cobrado\s*\(R\$\):\s*([\d\.]+,\d{2})/i);
  if (valorMatch) dados.total_pagar = parseFloat(valorMatch[1].replace(/\./g, "").replace(",", "."));

  // Dias do ciclo
  let diasMatch = texto.match(/Nº\s*de\s*Dias\s*(\d+)/i);
  if (diasMatch) dados.dias_ciclo = parseInt(diasMatch[1]);

  return dados;
}

// ==================== COMPONENTE PRINCIPAL ====================
export default function DimensionarPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-primary" size={32} /></div>}>
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
        // Fallbacks baseados exatamente nos dados reais das faturas fornecidas (WG Armazéns Gerais Ltda)
        const faturasRaw = [
          { id: crypto.randomUUID(), mes_referencia: "11/2025", consumo_ponta_kwh: 457.21, consumo_fora_ponta_kwh: 5179.86, demanda_ponta_kw: 293.44, demanda_fora_ponta_kw: 293.44, reativo_ponta_kvarh: 493.76, reativo_fora_ponta_kvarh: 4696.54, total_pagar: 12617.5, dias_ciclo: 30, concessionaria: "EQUATORIAL_PARA", tenant_id: tenant, fator_potencia: 0.36, multa_reativo_reais: 186.54 },
          { id: crypto.randomUUID(), mes_referencia: "12/2025", consumo_ponta_kwh: 595.56, consumo_fora_ponta_kwh: 6106.21, demanda_ponta_kw: 280.00, demanda_fora_ponta_kw: 280.00, reativo_ponta_kvarh: 1130.49, reativo_fora_ponta_kvarh: 8932.83, total_pagar: 14486.71, dias_ciclo: 31, concessionaria: "EQUATORIAL_PARA", tenant_id: tenant, fator_potencia: 0.3677, multa_reativo_reais: 430.00 },
          { id: crypto.randomUUID(), mes_referencia: "01/2026", consumo_ponta_kwh: 558.52, consumo_fora_ponta_kwh: 5974.5, demanda_ponta_kw: 280.00, demanda_fora_ponta_kw: 280.00, reativo_ponta_kvarh: 993.0, reativo_fora_ponta_kvarh: 8690.47, total_pagar: 13728.12, dias_ciclo: 31, concessionaria: "EQUATORIAL_PARA", tenant_id: tenant, fator_potencia: 0.36, multa_reativo_reais: 380.00 },
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
      fator_potencia: currentFatura.fator_potencia,
      multa_reativo_reais: parseBRLocal(currentFatura.multa_reativo_reais_str),
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
          <p><strong>Demanda Total Calculada:</strong> ${dadosExtraidos.demanda_fora_ponta_kw} kW</p>
          <p><strong>Multas Reativas Somadas:</strong> ${formatMoney(dadosExtraidos.multa_reativo_reais || 0)}</p>
          <p><strong>Valor Total Fatura:</strong> ${formatMoney(dadosExtraidos.total_pagar || 0)}</p>
          <p><strong>Concessionária:</strong> ${dadosExtraidos.concessionaria}</p>
          <p><strong>Fator de Potência Lido:</strong> ${dadosExtraidos.fator_potencia ? dadosExtraidos.fator_potencia : 'não identificado'}</p>
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
        fator_potencia: dadosExtraidos.fator_potencia,
        multa_reativo_reais: dadosExtraidos.multa_reativo_reais || 0,
      };
      
      const { error } = await supabase.from("faturas").insert(novaFatura);
      if (error) throw error;
      setFaturas((prev) => [novaFatura, ...prev]);
      Swal.fire("✅ Sucesso!", `Fatura ${novaFatura.mes_referencia} importada com sucesso.`, "success");
    } catch (err: any) {
      console.error(err);
      Swal.fire("Erro na leitura", err.message || "Não foi possível interpretar o PDF. Verifique se é uma fatura de energia.", "error");
    } finally {
      setImportandoPDF(false);
    }
  }, [tenantId]);

  const { getRootProps, getInputProps } = useDropzone({ onDrop: onDropPDF, accept: { "application/pdf": [".pdf"] }, multiple: false });

  const calcularDimensionamento = () => {
    if (faturas.length < 2) {
      Swal.fire("Atenção", "Mínimo de 2 faturas", "warning");
      return;
    }
    setCalculando(true);
    try {
      const alertas: string[] = [];
      const concessionarias = [...new Set(faturas.map((f) => f.concessionaria))];
      if (concessionarias.length > 1) alertas.push(`⚠️ Faturas de diferentes concessionárias: ${concessionarias.join(", ")}`);

      let faturasProcessadas = faturas.map((f) => {
        const ativoTotal = f.consumo_ponta_kwh + f.consumo_fora_ponta_kwh;
        const reativoTotal = f.reativo_ponta_kvarh + f.reativo_fora_ponta_kvarh;
        
        let fp = f.fator_potencia || calcularFatorPotencia(ativoTotal, reativoTotal);
        const multa = calcularMultaDaFatura(f);
        const demandaMaxKw = Math.max(f.demanda_ponta_kw, f.demanda_fora_ponta_kw, 0.1);
        
        return { ...f, ativoTotal, reativoTotal, fp, multa, demandaMaxKw };
      });

      // Pior mês (menor FP)
      let piorMes = faturasProcessadas.reduce((prev, curr) => {
        const fpPrev = (prev.fp >= 0.99 || prev.fp <= 0.1) ? Infinity : prev.fp;
        const fpCurr = (curr.fp >= 0.99 || curr.fp <= 0.1) ? Infinity : curr.fp;
        return fpCurr < fpPrev ? curr : prev;
      }, faturasProcessadas[0]);
      
      let fpAtual = piorMes.fp;
      const fpDesejado = targetFP;
      const mediaMulta = faturasProcessadas.reduce((acc, f) => acc + f.multa, 0) / faturasProcessadas.length;
      let demandaReal = Math.max(...faturasProcessadas.map((f) => f.demandaMaxKw), 0);

      let potenciaBase = demandaPersonalizadaKw > 0 ? demandaPersonalizadaKw : demandaReal;
      let potenciaAtivaFinal = potenciaBase * (1 + margemSeguranca / 100);

      const precisaCapacitor = fpAtual < FP_MINIMO_REGULAMENTAR || mediaMulta > 50;
      let kvarAutomatico = 0, estagios: number[] = [], economiaMensal = 0, motivo = "";
      
      if (precisaCapacitor) {
        kvarAutomatico = calcularKvarNecessario(potenciaAtivaFinal, fpAtual, fpDesejado);
        kvarAutomatico = Math.ceil(kvarAutomatico / 10) * 10;
        kvarAutomatico = Math.max(kvarAutomatico, CONFIG_CAPACITORES.minimo_kvar_grupo_a);
        estagios = distribuirEstagios(kvarAutomatico, numeroEstagios);
        economiaMensal = mediaMulta; // Economia elimina a multa cobrada
        motivo = `Potência ativa = ${potenciaAtivaFinal.toFixed(1)} kW | FP atual = ${(fpAtual * 100).toFixed(1)}% | FP desejado = ${fpDesejado}`;
      } else {
        motivo = `O Fator de Potência atual médio (${(fpAtual * 100).toFixed(1)}%) cumpre a meta regulamentar.`;
      }

      const precoPorKvar = kvarAutomatico > 0 ? calcularPrecoMercado(kvarAutomatico) : 0;
      const custoTotalInstalacao = precoPorKvar * 1.25; // 25% para cubículo, proteções e mão de obra
      const payback = economiaMensal > 0 ? custoTotalInstalacao / economiaMensal : 0;

      const economiaAnual = economiaMensal * 12;
      const retorno5Anos = (economiaAnual * 5) - custoTotalInstalacao;

      const res: ResultadoDimensionamento = {
        banco_automatico_kvar: kvarAutomatico,
        estagios_automaticos: estagios,
        tensao_capacitores: CONFIG_CAPACITORES.tensao_padrao_380v,
        fator_dessintonia: CONFIG_CAPACITORES.dessintonia_padrao,
        economia_mensal_estimada: economiaMensal,
        investimento_estimado_total: custoTotalInstalacao,
        payback_meses: payback,
        fp_atual_percent: fpAtual * 100,
        fp_projetado_percent: fpDesejado * 100,
        multa_atual_mensal_real: mediaMulta,
        potencia_ativa_utilizada_kw: potenciaAtivaFinal,
        precisa_capacitor: precisaCapacitor,
        grupo_tarifario: "A",
        motivo_recommendacao: motivo,
        concessionaria_identificada: concessionarias[0] || "EQUATORIAL_PARA",
        quantidade_faturas_analisadas: faturas.length,
        pior_mes: piorMes,
        media_fp_por_mes: faturasProcessadas.map(f => ({ mes: f.mes_referencia, fp: f.fp * 100, multa: f.multa })),
        alertas,
        distribuicao_por_trafo: distribuirKvarPorTrafo(transformadores, estagios, kvarAutomatico),
        fornecedores_recomendados: FORNECEDORES_RECOMENDADOS,
        preco_por_kvar: kvarAutomatico > 0 ? precoPorKvar / kvarAutomatico : 0,
        economia_anual: economiaAnual,
        retorno_5_anos: retorno5Anos,
        prejuizo_acumulado: mediaMulta * 12,
        projecao_1_ano: economiaAnual,
        projecao_3_anos: economiaAnual * 3,
        projecao_5_anos: economiaAnual * 5,
        roi_5_anos_percent: custoTotalInstalacao > 0 ? (retorno5Anos / custoTotalInstalacao) * 100 : 0,
        metodo_calculo_utilizado: "Análise Avançada Baseada em Demandas Totais de Fatura",
        fator_carga_utilizado: fatorCarga,
        numero_estagios: numeroEstagios
      };

      setResult(res);
    } catch (e: any) {
      Swal.fire("Erro", e.message || "Falha ao calcular.", "error");
    } finally {
      setCalculando(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Insira aqui o JSX de sua UI (Dropzone, Tabelas, Cards de Resultados e gráficos) */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4"><Factory className="text-primary" /> Análise de Subestação e Faturas</h2>
        <div {...getRootProps()} className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition">
          <input {...getInputProps()} />
          <FileUp size={40} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">Arraste ou clique para importar o PDF das faturas de energia</p>
        </div>
        <button onClick={calcularDimensionamento} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 w-full flex justify-center gap-2">
          {calculando ? <Loader2 className="animate-spin" /> : <Calculator />} Calcular Dimensionamento do Banco
        </button>
      </div>
    </div>
  );
}