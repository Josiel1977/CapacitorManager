"use client";

import React, { useState, useRef, useEffect, Suspense, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  Calculator, Zap, DollarSign, CheckCircle2, Loader2, AlertTriangle,
  Package, History, Printer, Activity, Plus, Trash2, Save, Edit3, X, Factory, FileUp, Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import jsPDF from "jspdf";
import { toPng } from "html-to-image";

export const dynamic = 'force-dynamic';

// ==================== CONSTANTES TÉCNICAS ====================
const FP_MINIMO_REGULAMENTAR = 0.92;
const TARIFAS_REATIVO: Record<string, number> = { EQUATORIAL_PARA: 0.28622, DEFAULT: 0.28622 };
const PRECOS_MERCADO_CAPACITORES: Record<number, number> = {
  20: 5400, 30: 5300, 40: 7067, 50: 9700, 60: 11640, 70: 13600, 80: 14500,
  90: 15300, 100: 18700, 120: 21500, 150: 25500, 180: 26900, 210: 27300,
  240: 28500, 280: 29600, 300: 32500
};

// ==================== INTERFACES ====================
interface Transformador { id: string; potencia_kva: number; quantidade: number; tensao_v: number; }
interface Fatura {
  id: string; mes_referencia: string; consumo_ativo_total_kwh: number; consumo_reativo_total_kvarh: number;
  demanda_max_kw: number; total_pagar: number; dias_ciclo: number; concessionaria: string;
  fp_lido?: number; fp_calculado: number; multa_estimada: number;
}
interface ResultadoDimensionamento {
  kvar_necessario: number; kvar_comercial: number; estagios: number[]; fp_medio: number; fp_pior_mes: number;
  multa_media: number; investimento: number; economia_mensal: number; payback_meses: number; roi_5_anos: number;
  detalhes_calculo: { potencia_base_kw: number; criterio_usado: string; margem_seguranca: number; formula_aplicada: string; };
  alertas: string[];
}

// ==================== FUNÇÕES AUXILIARES ====================
const parseBRLocal = (valor: any): number => {
  if (valor === undefined || valor === null) return 0;
  if (typeof valor === "number") return valor;
  const str = String(valor).replace(/[^\d,.-]/g, "").replace(",", ".");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};
const formatMoney = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const formatNumber = (v: number, d = 2) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

const calcularFatorPotencia = (ativo: number, reativo: number): number => {
  if (ativo <= 0) return 0.92;
  const aparente = Math.sqrt(ativo ** 2 + reativo ** 2);
  return Math.min(0.995, Math.max(0.25, ativo / aparente));
};

const calcularMultaDaFatura = (ativo: number, reativo: number, tarifa: number): number => {
  if (ativo <= 0) return 0;
  const fpAtual = calcularFatorPotencia(ativo, reativo);
  if (fpAtual >= FP_MINIMO_REGULAMENTAR) return 0;
  const reativoPermitido = ativo * Math.tan(Math.acos(FP_MINIMO_REGULAMENTAR));
  return Math.max(0, reativo - reativoPermitido) * tarifa;
};

const validarESelecionarFP = (fpLido: number | undefined, ativo: number, reativo: number): { fp: number; alerta?: string } => {
  const fpCalc = calcularFatorPotencia(ativo, reativo);
  if (!fpLido || fpLido < 0.2 || fpLido > 0.99) return { fp: fpCalc };
  const diff = Math.abs(fpLido - fpCalc);
  if (diff > 0.18) return { fp: fpCalc, alerta: `FP lido diverge do cálculo energético. Usado valor calculado.` };
  return { fp: fpLido * 0.6 + fpCalc * 0.4 };
};

const calcularKvarNecessario = (potenciaAtivaKW: number, fpAtual: number, fpDesejado: number, margemSegurancaPct: number, considerarHarmonicos: boolean): number => {
  const ang1 = Math.acos(Math.max(0.25, Math.min(0.99, fpAtual)));
  const ang2 = Math.acos(Math.max(0.25, Math.min(0.99, fpDesejado)));
  let kvar = potenciaAtivaKW * (Math.tan(ang1) - Math.tan(ang2));
  kvar *= (1 + margemSegurancaPct / 100);
  if (considerarHarmonicos) kvar *= 1.08;
  return Math.ceil(kvar / 2.5) * 2.5;
};

// Substitua APENAS a função distribuirEstagios e o bloco de calculo de potenciaBase

const distribuirEstagios = (totalKvar: number, numEstagiosMax: number = 12): number[] => {
  const valoresComerciais = [1, 2.5, 5, 7.5, 10, 12.5, 15, 20, 25, 30, 40, 50];
  const numEstagios = Math.min(12, Math.max(6, numEstagiosMax));
  const etapas: number[] = [];
  let soma = 0;
  
  for (const valor of valoresComerciais) {
    if (etapas.length >= numEstagios) break;
    if (soma + valor <= totalKvar * 0.85) {
      etapas.push(valor);
      soma += valor;
    }
  }
  
  let restante = totalKvar - soma;
  let faltando = numEstagios - etapas.length;
  
  if (faltando > 0 && restante > 0) {
    const valorUnitario = Math.min(50, Math.max(2.5, Math.round(restante / faltando / 2.5) * 2.5));
    for (let i = 0; i < faltando; i++) {
      const add = i === faltando - 1 
        ? Math.max(2.5, Math.round((restante - (valorUnitario * (faltando - 1))) / 2.5) * 2.5)
        : valorUnitario;
      etapas.push(add);
      soma += add;
      restante = totalKvar - soma;
    }
  }
  
  const diff = Math.round((totalKvar - soma) / 2.5) * 2.5;
  if (Math.abs(diff) > 0.01 && etapas.length > 0) {
    etapas[etapas.length - 1] = Math.max(2.5, etapas[etapas.length - 1] + diff);
  }
  
  return etapas.filter(v => v >= 2.5).map(v => Math.round(v / 2.5) * 2.5).sort((a, b) => a - b);
};

// No bloco de cálculo dentro de calcular():
if (criterioCalculo === "carga_atual") {
  potenciaBase = Math.max(...faturas.map(f => f.demanda_max_kw), 0);
  criterioTexto = `Carga Real (Demanda medida: ${potenciaBase.toFixed(1)} kW)`;
} else if (criterioCalculo === "transformadores") {
  const totalTrafo = transformadores.reduce((acc, t) => acc + (t.potencia_kva * t.quantidade), 0);
  potenciaBase = totalTrafo * 0.35; // FC realista para armazém
  criterioTexto = `Capacidade Instalada (${totalTrafo} kVA × 0,35 = ${potenciaBase.toFixed(1)} kW)`;
} else {
  potenciaBase = 280; // Contratada
  criterioTexto = "Demanda Contratada (280 kW)";
}

const calcularPrecoMercado = (kvar: number): number => {
  const chaves = Object.keys(PRECOS_MERCADO_CAPACITORES).map(Number).sort((a,b) => a-b);
  let prox = chaves.find(c => c >= kvar) || chaves[chaves.length - 1];
  return PRECOS_MERCADO_CAPACITORES[prox] || Math.round(kvar * 160);
};

// ==================== PARSER DE PDF ====================
let pdfjsLib: any = null;
async function carregarPDFJS() {
  if (typeof window === 'undefined') return null;
  if (pdfjsLib) return pdfjsLib;
  const module = await import('pdfjs-dist');
  pdfjsLib = module;
  if (typeof window !== 'undefined') pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  return pdfjsLib;
}
async function extrairTextoDoPDF(file: File): Promise<string> {
  const pdfjs = await carregarPDFJS();
  if (!pdfjs) throw new Error("PDF.js não carregado");
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let texto = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    texto += content.items.map((item: any) => item.str).join(" ") + "\n";
  }
  return texto;
}
function parseFaturaFromPDF(texto: string): Partial<Fatura> & { concessionaria: string } {
  const dados: any = {
    concessionaria: texto.includes("Equatorial") ? "EQUATORIAL_PARA" : "DEFAULT",
    mes_referencia: "", consumo_ativo_total_kwh: 0, consumo_reativo_total_kvarh: 0,
    demanda_max_kw: 0, total_pagar: 0, dias_ciclo: 30, fp_lido: undefined,
    fp_calculado: 0.92, multa_estimada: 0,
  };
  const extrairMes = () => {
    let m = texto.match(/(?:Conta\s*M[eê]s|Compet[eê]ncia)[\s\S]{0,200}?[-\s]*(\d{2}\/\d{4})/i);
    if (m) return m[1];
    m = texto.match(/[-\s]*(\d{2}\/\d{4})[\s|]+\d{2}\/\d{2}\/\d{4}/);
    if (m) return m[1];
    const matches = texto.match(/\b(0[1-9]|1[0-2])\/(20\d{2})\b/g);
    if (matches) { for (const d of matches) { const [, year] = d.split('/').map(Number); if (year >= 2024 && year <= 2030) return d; } }
    return "";
  };
  dados.mes_referencia = extrairMes();
  const pegarValor = (regex: RegExp): number => { const m = texto.match(regex); if (!m) return 0; return parseFloat(m[1].replace(/\./g, '').replace(',', '.')) || 0; };
  dados.consumo_ativo_total_kwh += pegarValor(/Consumo\s*Ativo\s*FP[\s\S]*?([\d\.]+,\d+|\d+)\s*kWh/i);
  dados.consumo_ativo_total_kwh += pegarValor(/Consumo\s*Ativo\s*NP[\s\S]*?([\d\.]+,\d+|\d+)\s*kWh/i);
  dados.consumo_reativo_total_kvarh += pegarValor(/Consumo\s*Reativo\s*Exced.*?FP[\s\S]*?([\d\.]+,\d+|\d+)\s*kVAr/i);
  dados.consumo_reativo_total_kvarh += pegarValor(/Consumo\s*Reativo\s*Exced.*?NP[\s\S]*?([\d\.]+,\d+|\d+)\s*kVAr/i);
  dados.demanda_max_kw = Math.max(pegarValor(/Demanda\s*(?:Ativa|Distribui[çc][ãa]o)\s*(?:FP|Reg)[\s\S]*?([\d\.]+,\d+|\d+)\s*kW/i), pegarValor(/Demanda\s*(?:Ativa|Distribui[çc][ãa]o)\s*(?:NP|Reg)[\s\S]*?([\d\.]+,\d+|\d+)\s*kW/i), 0.01);
  const fpMatch = texto.match(/FATOR\s*DE\s*POT[ÊE]NCIA[:\s]+([\d,\.]+)/i);
  if (fpMatch) { const fp = parseFloat(fpMatch[1].replace(',', '.')); if (fp > 0.2 && fp < 1) dados.fp_lido = fp; }
  const valMatch = texto.match(/Total\s*a\s*Pagar[\s\S]*?R\$\s*([\d\.]+,\d{2})/i);
  if (valMatch) dados.total_pagar = parseFloat(valMatch[1].replace(/\./g, '').replace(',', '.'));
  const diasMatch = texto.match(/N[ºo]\s*de\s*Dias\s*(\d+)/i);
  if (diasMatch) dados.dias_ciclo = parseInt(diasMatch[1]);
  const tarifa = TARIFAS_REATIVO[dados.concessionaria] ?? TARIFAS_REATIVO.DEFAULT;
  const { fp, alerta } = validarESelecionarFP(dados.fp_lido, dados.consumo_ativo_total_kwh, dados.consumo_reativo_total_kvarh);
  dados.fp_calculado = fp;
  dados.multa_estimada = calcularMultaDaFatura(dados.consumo_ativo_total_kwh, dados.consumo_reativo_total_kvarh, tarifa);
  console.log(`✅ Parser OK: ${dados.mes_referencia} | Ativo: ${dados.consumo_ativo_total_kwh} | Reativo: ${dados.consumo_reativo_total_kvarh} | Demanda: ${dados.demanda_max_kw} | FP: ${(dados.fp_calculado*100).toFixed(1)}%`);
  return dados;
}

// ==================== COMPONENTE PRINCIPAL ====================
export default function DimensionarPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-blue-600" size={32} /></div>}>
      <DimensionarContent />
    </Suspense>
  );
}

function DimensionarContent() {
  const router = useRouter();
  const reportRef = useRef<HTMLDivElement>(null);
  const [transformadores, setTransformadores] = useState<Transformador[]>([
    { id: crypto.randomUUID(), potencia_kva: 300, quantidade: 1, tensao_v: 380 },
    { id: crypto.randomUUID(), potencia_kva: 225, quantidade: 1, tensao_v: 380 }
  ]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [targetFP, setTargetFP] = useState(0.92);
  const [result, setResult] = useState<ResultadoDimensionamento | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editFatura, setEditFatura] = useState<any>({});
  const [carregando, setCarregando] = useState(false);
  const [criterioCalculo, setCriterioCalculo] = useState<"carga_atual" | "contratada" | "transformadores">("carga_atual");
  const [margemSeg, setMargemSeg] = useState(12);
  const [harmonicos, setHarmonicos] = useState(true);
  const [importandoPDF, setImportandoPDF] = useState(false);

  useEffect(() => { setCarregando(false); }, []);

  const onDropPDF = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setImportandoPDF(true);
    try {
      const texto = await extrairTextoDoPDF(files[0]);
      const dados = parseFaturaFromPDF(texto);
      if (!dados.mes_referencia) throw new Error("Mês não identificado no PDF.");
      const novaFatura: Fatura = {
        id: crypto.randomUUID(), mes_referencia: dados.mes_referencia,
        consumo_ativo_total_kwh: dados.consumo_ativo_total_kwh || 0, consumo_reativo_total_kvarh: dados.consumo_reativo_total_kvarh || 0,
        demanda_max_kw: dados.demanda_max_kw || 0, total_pagar: dados.total_pagar || 0, dias_ciclo: dados.dias_ciclo || 30,
        concessionaria: dados.concessionaria || "DEFAULT", fp_lido: dados.fp_lido,
        fp_calculado: dados.fp_calculado || 0.92, multa_estimada: dados.multa_estimada || 0,
      };
      setFaturas(prev => [novaFatura, ...prev].sort((a,b) => b.mes_referencia.localeCompare(a.mes_referencia)));
      Swal.fire("✅ PDF Importado", `Fatura de ${novaFatura.mes_referencia} processada.`, "success");
    } catch (e: any) { Swal.fire("Erro na Leitura", e.message || "Formato inválido.", "error"); }
    finally { setImportandoPDF(false); }
  }, []);

  const { getRootProps, getInputProps } = useDropzone({ onDrop: onDropPDF, accept: { "application/pdf": [".pdf"] }, multiple: false });

  const salvarFaturaManual = () => {
    if (!editFatura.mes_referencia) return Swal.fire("Atenção", "Preencha o mês.", "warning");
    const ativo = parseBRLocal(editFatura.ativo) || 0; const reativo = parseBRLocal(editFatura.reativo) || 0;
    const demanda = parseBRLocal(editFatura.demanda) || 0; const tarifa = TARIFAS_REATIVO[editFatura.concessionaria || "EQUATORIAL_PARA"] ?? TARIFAS_REATIVO.DEFAULT;
    const nova: Fatura = {
      id: editFatura.id || crypto.randomUUID(), mes_referencia: editFatura.mes_referencia,
      consumo_ativo_total_kwh: ativo, consumo_reativo_total_kvarh: reativo, demanda_max_kw: demanda,
      total_pagar: parseBRLocal(editFatura.total) || 0, dias_ciclo: parseInt(editFatura.dias) || 30,
      concessionaria: editFatura.concessionaria || "EQUATORIAL_PARA", fp_lido: parseFloat(editFatura.fp_lido) || undefined,
      fp_calculado: calcularFatorPotencia(ativo, reativo), multa_estimada: calcularMultaDaFatura(ativo, reativo, tarifa),
    };
    setFaturas(prev => { const exists = prev.find(f => f.id === nova.id); const next = exists ? prev.map(f => f.id === nova.id ? nova : f) : [nova, ...prev]; return next.sort((a,b) => b.mes_referencia.localeCompare(a.mes_referencia)); });
    setShowModal(false); setEditFatura({}); Swal.fire("✅ Sucesso", "Fatura salva.", "success");
  };

  const calcular = () => {
    if (faturas.length < 2) return Swal.fire("Atenção", "Adicione pelo menos 2 faturas.", "warning");
    setCalculando(true);
    setTimeout(() => {
      try {
        const alertas: string[] = [];
        const fps = faturas.map(f => f.fp_calculado);
        const fpPior = Math.min(...fps);
        const fpMedio = fps.reduce((a,b) => a+b, 0) / fps.length;
        
        // ✅ SELETOR DE CRITÉRIO DE DIMENSIONAMENTO
        let potenciaBase = 0; let criterioTexto = "";
        if (criterioCalculo === "carga_atual") {
          potenciaBase = Math.max(...faturas.map(f => f.demanda_max_kw), 0);
          criterioTexto = "Carga Real Atual (Demanda máxima medida nas faturas)";
          if (potenciaBase < 10) alertas.push("⚠️ Demanda medida muito baixa. O dimensionamento eliminará a multa atual, mas não cobre expansão.");
        } else if (criterioCalculo === "contratada") {
          potenciaBase = 280; // Extraído da fatura: "Demanda Contratada Única(kW): 280,00"
          criterioTexto = "Demanda Contratada (280 kW)";
        } else {
          const totalTrafo = transformadores.reduce((acc, t) => acc + (t.potencia_kva * t.quantidade), 0);
          potenciaBase = totalTrafo * 0.8; // Fator de potência nominal 0.8
          criterioTexto = `Capacidade Instalada (${totalTrafo} kVA × 0,8)`;
        }

        const kvarNec = calcularKvarNecessario(potenciaBase, fpPior, targetFP, margemSeg, harmonicos);
        const kvarCom = Math.ceil(kvarNec / 10) * 10;
        const estagios = distribuirEstagios(kvarCom, 6 + Math.floor(kvarCom/50));
        const investimento = calcularPrecoMercado(kvarCom);
        const multaMedia = faturas.reduce((a,b)=>a+b.multa_estimada,0)/faturas.length;
        const economia = multaMedia * 0.85;
        const payback = economia > 0 ? Math.ceil(investimento / economia) : 99;
        const roi5 = ((economia * 12 * 5 - investimento) / investimento) * 100;

        if (criterioCalculo !== "carga_atual") {
          alertas.push(`📊 Nota Técnica: Dimensionamento baseado em ${criterioTexto}. O banco será capaz de atender picos futuros sem necessidade de expansão imediata. Se a carga atual permanecer baixa, pode ocorrer compensação excessiva (FP capacitivo) em horários de ociosidade.`);
        }

        setResult({
          kvar_necessario: kvarNec, kvar_comercial: kvarCom, estagios, fp_medio: fpMedio, fp_pior_mes: fpPior,
          multa_media: multaMedia, investimento, economia_mensal: economia, payback_meses: payback, roi_5_anos: roi5,
          detalhes_calculo: {
            potencia_base_kw: potenciaBase, criterio_usado: criterioTexto, margem_seguranca: margemSeg,
            formula_aplicada: `Qc = ${potenciaBase.toFixed(1)} × (tan φ₁ ${(fpPior*100).toFixed(1)}% → tan φ₂ ${(targetFP*100).toFixed(1)}%) × ${(1+margemSeg/100).toFixed(2)}${harmonicos?' × 1,08 (harmônicos)':''}`
          },
          alertas
        });
      } catch (e) { Swal.fire("Erro", "Falha no cálculo.", "error"); }
      finally { setCalculando(false); }
    }, 600);
  };

  const exportarPDF = async () => {
    if (!reportRef.current) return;
    try {
      Swal.fire({ title: "Gerando PDF...", didOpen: () => Swal.showLoading() });
      const dataUrl = await toPng(reportRef.current, { quality: 1, pixelRatio: 2 });
      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfW = pdf.internal.pageSize.getWidth() - 20;
      const pdfH = (imgProps.height * pdfW) / imgProps.width;
      pdf.addImage(dataUrl, "PNG", 10, 10, pdfW, pdfH);
      pdf.save(`Dimensionamento_${new Date().toLocaleDateString("pt-BR").replace(/\//g,"-")}.pdf`);
      Swal.close(); Swal.fire("✅ PDF Gerado", "", "success");
    } catch { Swal.fire("Erro", "Falha na exportação.", "error"); }
  };

  if (carregando) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6 font-sans text-slate-800">
      <header className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dimensionamento de Banco de Capacitores</h1>
          <p className="text-sm text-slate-500">Extração automática • Cálculo ANEEL • Critérios flexíveis</p>
          <p className="text-xs text-blue-600 mt-1 font-medium">Infraestrutura: {transformadores.map(t => `${t.potencia_kva}kVA`).join(" + ")} @ {transformadores[0]?.tensao_v || 380}V</p>
        </div>
        <div {...getRootProps()} className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700 transition">
          <FileUp size={16} /> Importar PDF <input {...getInputProps()} />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold flex items-center gap-2"><History size={16} /> Faturas ({faturas.length})</h2>
              <button onClick={() => { setEditFatura({}); setShowModal(true); }} className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded"><Plus size={14} /> Manual</button>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {faturas.map(f => (
                <div key={f.id} className="p-3 bg-slate-50 rounded-lg border text-sm">
                  <div className="flex justify-between font-medium"><span>{f.mes_referencia}</span><span className="text-blue-600">{formatMoney(f.multa_estimada)}</span></div>
                  <div className="text-xs text-slate-500 mt-1 grid grid-cols-2 gap-1">
                    <span>Ativo: {formatNumber(f.consumo_ativo_total_kwh,0)} kWh</span>
                    <span>Reativo: {formatNumber(f.consumo_reativo_total_kvarh,0)} kVArh</span>
                    <span>Demanda: {formatNumber(f.demanda_max_kw,1)} kW</span>
                    <span className={f.fp_calculado < 0.92 ? "text-red-600" : "text-green-600"}>FP: {(f.fp_calculado*100).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Calculator size={16} /> Parâmetros</h2>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Critério de Dimensionamento</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: "carga_atual", label: "Carga Real Atual", desc: "Baseado nas faturas (70 kVAr)" },
                    { id: "contratada", label: "Demanda Contratada", desc: "280 kW (Proposta Comercial)" },
                    { id: "transformadores", label: "Transformadores", desc: "525 kVA × 0,8" }
                  ].map(opt => (
                    <button key={opt.id} onClick={() => setCriterioCalculo(opt.id as any)} 
                      className={`p-2 rounded-lg text-left text-xs border transition ${criterioCalculo===opt.id ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 hover:bg-slate-100"}`}>
                      <span className="font-medium">{opt.label}</span>
                      <p className="text-[10px] opacity-80 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-500">Margem (%)</label>
                  <input type="number" value={margemSeg} onChange={e => setMargemSeg(parseFloat(e.target.value)||0)} className="w-full border rounded p-2 mt-1" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Harmônicos</label>
                  <select value={harmonicos ? "sim" : "nao"} onChange={e => setHarmonicos(e.target.value==="sim")} className="w-full border rounded p-2 mt-1">
                    <option value="sim">Sim (+8%)</option><option value="nao">Não</option>
                  </select>
                </div>
              </div>
              <button onClick={calcular} disabled={calculando || faturas.length<2} className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2">
                {calculando ? <Loader2 className="animate-spin" size={18}/> : <Zap size={18}/>} Calcular
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {result ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div ref={reportRef} className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Memorial de Dimensionamento</h2>
                    <p className="text-sm text-slate-500">Gerado em {new Date().toLocaleDateString("pt-BR")} • {faturas.length} faturas</p>
                  </div>
                  <button onClick={exportarPDF} className="bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg text-sm flex items-center gap-2"><Printer size={14}/> PDF</button>
                </div>

                {result.alertas.map((a, i) => <div key={i} className="bg-amber-50 text-amber-800 p-3 rounded-lg text-xs mb-3 flex items-start gap-2"><AlertTriangle size={14} className="mt-0.5"/>{a}</div>)}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-xl">
                    <p className="text-xs text-blue-600 font-medium">Banco Recomendado</p>
                    <p className="text-3xl font-bold text-blue-700">{result.kvar_comercial} kVAr</p>
                    <p className="text-xs text-slate-500 mt-1">Automático • {result.estagios.length} estágios • {result.estagios.join(" + ")} kVAr</p>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-xl">
                    <p className="text-xs text-emerald-600 font-medium">Análise Financeira</p>
                    <div className="grid grid-cols-3 gap-2 text-center mt-2">
                      <div><p className="text-[10px] text-slate-500">Investimento</p><p className="font-bold">{formatMoney(result.investimento)}</p></div>
                      <div><p className="text-[10px] text-slate-500">Economia/mês</p><p className="font-bold text-emerald-600">{formatMoney(result.economia_mensal)}</p></div>
                      <div><p className="text-[10px] text-slate-500">Payback</p><p className="font-bold text-emerald-600">{result.payback_meses} meses</p></div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl mb-4">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Info size={14}/> Transparência do Cálculo</h3>
                  <div className="text-xs text-slate-600 space-y-1 font-mono bg-white p-3 rounded border">
                    <p>• Critério utilizado: {result.detalhes_calculo.criterio_usado}</p>
                    <p>• Potência base: {formatNumber(result.detalhes_calculo.potencia_base_kw, 1)} kW</p>
                    <p>• FP médio: {(result.fp_medio*100).toFixed(1)}% | FP pior mês: {(result.fp_pior_mes*100).toFixed(1)}%</p>
                    <p>• Fórmula: {result.detalhes_calculo.formula_aplicada}</p>
                    <p>• Reativo excessivo médio: {formatMoney(result.multa_media)} / mês</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
                  <div className="p-3 border rounded-lg"><p className="text-[10px] text-slate-500">Prejuízo atual/mês</p><p className="font-bold text-red-600">{formatMoney(result.multa_media)}</p></div>
                  <div className="p-3 border rounded-lg"><p className="text-[10px] text-slate-500">Economia anual</p><p className="font-bold text-blue-600">{formatMoney(result.economia_mensal * 12)}</p></div>
                  <div className="p-3 border rounded-lg"><p className="text-[10px] text-slate-500">ROI 5 anos</p><p className="font-bold text-green-600">{result.roi_5_anos.toFixed(0)}%</p></div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed rounded-xl bg-slate-50 text-slate-400">
              <Package size={48} className="mb-4 text-slate-300"/>
              <p className="font-medium">Nenhum dimensionamento realizado</p>
              <p className="text-sm">Importe faturas ou selecione o critério para calcular</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">{editFatura.id ? "Editar Fatura" : "Nova Fatura"}</h3><button onClick={() => setShowModal(false)}><X size={20}/></button></div>
              <div className="space-y-3 text-sm">
                <input placeholder="Mês/Ano (ex: 11/2025)" value={editFatura.mes_referencia||""} onChange={e=>setEditFatura({...editFatura, mes_referencia:e.target.value})} className="w-full border rounded p-2"/>
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Ativo Total (kWh)" type="number" value={editFatura.ativo||""} onChange={e=>setEditFatura({...editFatura, ativo:e.target.value})} className="border rounded p-2"/>
                  <input placeholder="Reativo Total (kVArh)" type="number" value={editFatura.reativo||""} onChange={e=>setEditFatura({...editFatura, reativo:e.target.value})} className="border rounded p-2"/>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Demanda Máx (kW)" type="number" value={editFatura.demanda||""} onChange={e=>setEditFatura({...editFatura, demanda:e.target.value})} className="border rounded p-2"/>
                  <input placeholder="Total a Pagar (R$)" type="number" value={editFatura.total||""} onChange={e=>setEditFatura({...editFatura, total:e.target.value})} className="border rounded p-2"/>
                </div>
                <button onClick={salvarFaturaManual} className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">Salvar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}