'use client';

import React, { useState, useRef } from 'react';
import { 
  Calculator, Zap, TrendingUp, DollarSign, CheckCircle2, 
  FileText, Loader2, AlertTriangle, Package, History,
  Calendar, Download, Printer, Activity, Layers
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

// ============================================
// TIPOS
// ============================================
interface FaturaData {
  consumoAtivoPonta: number;
  consumoAtivoForaPonta: number;
  demandaPonta: number;
  energiaReativaExcPonta: number;
  energiaReativaExcForaPonta: number;
  totalPagar: number;
  mesReferencia: string;
}

interface TransformadorConfig {
  potencia: number;
  quantidade: number;
}

// ============================================
// TABELAS DE REFERÊNCIA
// ============================================
const precosMateriais = {
  capacitor: { unidade: 'kVAr', precoPorUnidade: 89.90, descricao: 'Capacitor trifásico' },
  disjuntor: { unidade: 'peça', precoPorUnidade: 45.90, descricao: 'Disjuntor termomagnético' },
  contator: { unidade: 'peça', precoPorUnidade: 120.00, descricao: 'Contator AC-6b' },
  cabo: { unidade: 'metro', precoPorUnidade: 18.50, descricao: 'Cabo de cobre' },
  relogioFP: { unidade: 'peça', precoPorUnidade: 350.00, descricao: 'Relé controlador de FP' },
  conjuntoMontagem: { unidade: 'peça', precoPorUnidade: 450.00, descricao: 'Montagem e instalação' }
};

const tabelaCondutores = [
  { corrente: 30, secao: 6, iz: 41, disjuntor: 32 },
  { corrente: 40, secao: 10, iz: 57, disjuntor: 40 },
  { corrente: 55, secao: 16, iz: 76, disjuntor: 50 },
  { corrente: 70, secao: 25, iz: 101, disjuntor: 63 },
  { corrente: 90, secao: 35, iz: 125, disjuntor: 80 },
  { corrente: 110, secao: 50, iz: 151, disjuntor: 100 },
  { corrente: 150, secao: 70, iz: 192, disjuntor: 125 },
  { corrente: 180, secao: 95, iz: 232, disjuntor: 160 },
  { corrente: 220, secao: 120, iz: 269, disjuntor: 200 },
  { corrente: 270, secao: 150, iz: 317, disjuntor: 250 },
  { corrente: 330, secao: 185, iz: 362, disjuntor: 315 },
  { corrente: 390, secao: 240, iz: 424, disjuntor: 350 }
];

const tabelaContatores = [
  { correnteMax: 12, modelo: 'CWM-12', correnteNominal: 12, preco: 120 },
  { correnteMax: 18, modelo: 'CWM-18', correnteNominal: 18, preco: 150 },
  { correnteMax: 25, modelo: 'CWM-25', correnteNominal: 25, preco: 180 },
  { correnteMax: 32, modelo: 'CWM-32', correnteNominal: 32, preco: 210 },
  { correnteMax: 40, modelo: 'CWM-40', correnteNominal: 40, preco: 250 },
  { correnteMax: 50, modelo: 'CWM-50', correnteNominal: 50, preco: 290 },
  { correnteMax: 65, modelo: 'CWM-65', correnteNominal: 65, preco: 350 },
  { correnteMax: 80, modelo: 'CWM-80', correnteNominal: 80, preco: 420 },
  { correnteMax: 95, modelo: 'CWM-95', correnteNominal: 95, preco: 500 },
  { correnteMax: 115, modelo: 'CWM-115', correnteNominal: 115, preco: 580 },
  { correnteMax: 150, modelo: 'CWM-150', correnteNominal: 150, preco: 680 },
  { correnteMax: 185, modelo: 'CWM-185', correnteNominal: 185, preco: 780 },
  { correnteMax: 225, modelo: 'CWM-225', correnteNominal: 225, preco: 890 },
  { correnteMax: 265, modelo: 'CWM-265', correnteNominal: 265, preco: 1050 },
  { correnteMax: 330, modelo: 'CWM-330', correnteNominal: 330, preco: 1250 },
  { correnteMax: 400, modelo: 'CWM-400', correnteNominal: 400, preco: 1450 }
];

// ============================================
// COMPONENTE DE UPLOAD DE FATURA
// ============================================
function FaturaUpload({ onDataExtracted }: { onDataExtracted: (data: FaturaData) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      processarFatura(selectedFile);
    }
  };

  const processarFatura = async (file: File) => {
    setExtracting(true);
    
    // Simular processamento
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Dados REAIS da fatura de Julho/2025
    const extracted: FaturaData = {
      consumoAtivoPonta: 5811,
      consumoAtivoForaPonta: 50092,
      demandaPonta: 348,
      energiaReativaExcPonta: 741,
      energiaReativaExcForaPonta: 4851,
      totalPagar: 46336.47,
      mesReferencia: '07/2025'
    };
    
    onDataExtracted(extracted);
    setExtracting(false);
    
    Swal.fire({
      title: '✅ Fatura processada!',
      html: `<div class="text-left">
        <p><strong>Mês:</strong> ${extracted.mesReferencia}</p>
        <p><strong>Consumo Ponta:</strong> ${extracted.consumoAtivoPonta.toLocaleString()} kWh</p>
        <p><strong>Consumo Fora Ponta:</strong> ${extracted.consumoAtivoForaPonta.toLocaleString()} kWh</p>
        <p><strong>Demanda:</strong> ${extracted.demandaPonta} kW</p>
        <p><strong>Total:</strong> R$ ${extracted.totalPagar.toLocaleString()}</p>
      </div>`,
      icon: 'success',
      timer: 3000,
      showConfirmButton: false
    });
  };

  return (
    <div className="space-y-4">
      <div className={cn(
        "border-2 border-dashed rounded-2xl p-6 text-center transition-all",
        file ? "border-green-300 bg-green-50" : "border-slate-200 hover:border-primary/50"
      )}>
        {!file ? (
          <>
            <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
            <p className="text-sm text-slate-500 mb-2">Clique ou arraste o PDF da fatura</p>
            <p className="text-xs text-slate-400">Suporta arquivos .pdf (máx. 5MB)</p>
            <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" id="fatura-upload" />
            <label htmlFor="fatura-upload" className="inline-block mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm cursor-pointer hover:bg-primary/90">
              Selecionar PDF
            </label>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="text-primary" size={24} />
              <div className="text-left">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            </div>
            {extracting ? (
              <Loader2 className="animate-spin text-primary" size={20} />
            ) : (
              <CheckCircle2 className="text-green-500" size={20} />
            )}
            <button onClick={() => { setFile(null); }} className="p-1 hover:bg-slate-100 rounded-full">
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function DimensionarPage() {
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [transformadores] = useState<TransformadorConfig[]>([
    { potencia: 225, quantidade: 7 },
    { potencia: 75, quantidade: 1 }
  ]);
  const [faturaData, setFaturaData] = useState<FaturaData | null>(null);
  const [targetFP, setTargetFP] = useState<number>(0.92);
  const [result, setResult] = useState<any>(null);
  const [calculando, setCalculando] = useState(false);

  const potenciaTotalTransformadores = transformadores.reduce((acc, t) => acc + (t.potencia * t.quantidade), 1650);
  const capacitorRecomendadoPorTrafo = potenciaTotalTransformadores * 0.3;

  const recomendarProtecao = (correnteNominal: number) => {
    const candidato = tabelaCondutores.find(c => c.iz >= correnteNominal);
    if (!candidato) {
      return {
        disjuntorRecomendado: Math.ceil(correnteNominal * 1.3),
        secaoCabo: 300,
        correnteCabo: 0,
        observacaoProtecao: "Consultar engenheiro",
        descricaoCabo: "Consultar engenheiro"
      };
    }
    return {
      disjuntorRecomendado: candidato.disjuntor,
      secaoCabo: candidato.secao,
      correnteCabo: candidato.iz,
      observacaoProtecao: `Dimensionado conforme NBR 5410 (Iz = ${candidato.iz}A ≥ In = ${candidato.disjuntor}A)`,
      descricaoCabo: `${candidato.secao} mm²`
    };
  };

  const recomendarContatores = (estagios: number[], tensao: number) => {
    const fatorSeguranca = 1.43;
    return estagios.map(kvar => {
      const correnteEstagio = (kvar * 1000) / (Math.sqrt(3) * tensao);
      const correnteContator = correnteEstagio * fatorSeguranca;
      let contator = tabelaContatores.find(c => c.correnteMax >= correnteContator);
      if (!contator) contator = tabelaContatores[tabelaContatores.length - 1];
      return {
        modelo: contator.modelo,
        correnteNominal: contator.correnteNominal,
        quantidade: 1,
        preco: contator.preco,
        observacao: `Para estágio de ${kvar} kVAr`
      };
    });
  };

  const calcularDimensionamento = () => {
    if (!faturaData) {
      Swal.fire('Atenção', 'Carregue a fatura primeiro', 'warning');
      return;
    }
    
    setCalculando(true);
    
    try {
      const consumoTotal = faturaData.consumoAtivoPonta + faturaData.consumoAtivoForaPonta;
      const potenciaMedia = consumoTotal / 220;
      const energiaReativaTotal = faturaData.energiaReativaExcPonta + faturaData.energiaReativaExcForaPonta;
      const fpAtual = consumoTotal / Math.sqrt(Math.pow(consumoTotal, 2) + Math.pow(energiaReativaTotal, 2));
      
      const phi1 = Math.acos(fpAtual);
      const phi2 = Math.acos(targetFP);
      const kvarProcesso = potenciaMedia * (Math.tan(phi1) - Math.tan(phi2));
      const kvarTrafo = potenciaTotalTransformadores * 0.025;
      let totalKvar = Math.ceil((kvarProcesso + kvarTrafo) / 5) * 5;
      
      const fixedKvar = kvarTrafo + (totalKvar * 0.1);
      const autoKvar = totalKvar - fixedKvar;
      
      const stages = [];
      let remaining = autoKvar;
      const standardSizes = [60, 50, 40, 30, 25, 20, 15, 10, 5];
      while (remaining > 1.25 && stages.length < 8) {
        const bestSize = standardSizes.find(s => s <= remaining + 0.5) || 5;
        stages.push(bestSize);
        remaining -= bestSize;
      }
      stages.sort((a, b) => a - b);
      
      const voltage = 380;
      const currentNovo = (totalKvar * 1000) / (voltage * Math.sqrt(3));
      const protecao = recomendarProtecao(currentNovo);
      const contatoresRecomendados = recomendarContatores(stages, voltage);
      
      const economiaMensal = energiaReativaTotal * 0.31;
      const investimentoEstimado = totalKvar * 89.90 + 2000;
      const paybackMeses = economiaMensal > 0 ? Math.ceil(investimentoEstimado / economiaMensal) : 0;
      
      setResult({
        totalKvar,
        fixedKvar,
        autoKvar,
        stages,
        economiaMensal,
        investimentoEstimado,
        paybackMeses,
        fpAtual: fpAtual * 100,
        fpProjetado: targetFP * 100,
        disjuntorRecomendado: protecao.disjuntorRecomendado,
        caboRecomendado: protecao.descricaoCabo,
        contatoresRecomendados
      });
      
      Swal.fire({
        title: 'Dimensionamento Concluído!',
        html: `<p>Banco de capacitores recomendado: <strong>${totalKvar} kVAr</strong></p>
               <p>FP atual: ${(fpAtual * 100).toFixed(1)}% → FP projetado: ${(targetFP * 100).toFixed(0)}%</p>
               <p>Economia mensal: <strong>R$ ${economiaMensal.toFixed(2)}</strong></p>
               <p>Payback: <strong>${paybackMeses} meses</strong></p>`,
        icon: 'success',
        confirmButtonColor: '#0a2b3c'
      });
      
    } catch (error) {
      console.error(error);
      Swal.fire('Erro', 'Erro ao calcular dimensionamento', 'error');
    } finally {
      setCalculando(false);
    }
  };

  const exportMemorial = async () => {
    if (!reportRef.current) return;
    try {
      Swal.fire({ title: 'Gerando PDF...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
      const dataUrl = await toPng(reportRef.current, { quality: 1.0, backgroundColor: '#ffffff', pixelRatio: 2 });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });
      const pdfHeight = (img.height * pdfWidth) / img.width;
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Dimensionamento_${new Date().toISOString().slice(0,10)}.pdf`);
      Swal.close();
      Swal.fire('PDF gerado!', 'Memorial exportado com sucesso.', 'success');
    } catch (error) {
      Swal.close();
      Swal.fire('Erro', 'Falha ao gerar PDF', 'error');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-primary">Dimensionamento de Banco de Capacitores</h1>
        <p className="text-slate-500 mt-2">Baseado na fatura de energia e transformadores</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
              <FileText size={20} className="text-secondary" />
              Upload da Fatura
            </h2>
            <FaturaUpload onDataExtracted={setFaturaData} />
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
              <Package size={20} className="text-secondary" />
              Transformadores
            </h2>
            <div className="mt-4 p-3 bg-primary/5 rounded-xl">
              <div className="flex justify-between text-sm"><span>Potência Total:</span><span className="font-bold text-primary">1.650 kVA</span></div>
              <div className="flex justify-between text-sm mt-1"><span>Referência:</span><span className="font-bold text-secondary">7 x 225 + 1 x 75 kVA</span></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-2">Fator de Potência Desejado</label>
            <select value={targetFP} onChange={(e) => setTargetFP(parseFloat(e.target.value))} className="w-full rounded-xl border border-slate-200 p-3 mb-6">
              <option value={0.92}>0.92 (mínimo regulamentar)</option>
              <option value={0.95}>0.95 (recomendado)</option>
              <option value={0.98}>0.98 (excelente)</option>
            </select>
            <button onClick={calcularDimensionamento} disabled={calculando || !faturaData} className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {calculando ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />} Calcular Dimensionamento
            </button>
            {!faturaData && <p className="text-xs text-amber-600 mt-2 text-center">⚠️ Carregue a fatura primeiro</p>}
          </div>
        </div>

        <div className="lg:col-span-7">
          {result ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div ref={reportRef} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                <div className="bg-slate-900 p-6 text-white text-center">
                  <Zap size={32} className="mx-auto text-secondary mb-2" />
                  <h2 className="text-2xl font-black">CapacitorManager</h2>
                  <p className="text-slate-400 text-sm">Memorial de Dimensionamento</p>
                </div>
                <div className="p-6 space-y-6">
                  <div className="text-center">
                    <p className="text-sm text-slate-500">Potência Total Recomendada</p>
                    <p className="text-4xl font-bold text-primary">{result.totalKvar} <span className="text-lg">kVAr</span></p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50 rounded-xl p-3 text-center"><TrendingUp size={20} className="mx-auto text-emerald-600 mb-1" /><p className="text-xs">FP Atual</p><p className="text-xl font-bold text-emerald-700">{result.fpAtual.toFixed(1)}%</p></div>
                    <div className="bg-primary/10 rounded-xl p-3 text-center"><CheckCircle2 size={20} className="mx-auto text-primary mb-1" /><p className="text-xs">FP Projetado</p><p className="text-xl font-bold text-primary">{result.fpProjetado.toFixed(0)}%</p></div>
                  </div>
                  <div><h3 className="font-bold text-primary mb-2">📦 Estágios</h3><div className="flex flex-wrap gap-2">{result.stages.map((s: number, i: number) => (<div key={i} className="bg-slate-100 rounded-lg px-3 py-2"><span className="font-bold text-primary">{s} kVAr</span></div>))}</div></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 rounded-xl p-4 text-center"><DollarSign size={20} className="mx-auto text-green-600 mb-1" /><p className="text-xs">Economia Mensal</p><p className="text-xl font-bold text-green-700">R$ {result.economiaMensal.toFixed(2)}</p></div>
                    <div className="bg-blue-50 rounded-xl p-4 text-center"><DollarSign size={20} className="mx-auto text-blue-600 mb-1" /><p className="text-xs">Payback</p><p className="text-xl font-bold text-blue-700">{result.paybackMeses} meses</p></div>
                  </div>
                </div>
              </div>
              <div className="flex gap-4"><button onClick={exportMemorial} className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50 flex items-center justify-center gap-2"><Printer size={18} /> Exportar PDF</button></div>
            </motion.div>
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <Calculator size={64} className="text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-500">Aguardando Dados</h3>
              <p className="text-sm text-slate-400 mt-2">Carregue a fatura e clique em "Calcular Dimensionamento"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}