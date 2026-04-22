'use client';

import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { 
  Calculator, Zap, TrendingUp, DollarSign, CheckCircle2, 
  FileText, Loader2, AlertTriangle, Plus, Package, History,
  Calendar, Download, Printer, Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

// Lazy load o componente de upload (só carrega no cliente)
const MultiFaturaUpload = lazy(() => import('@/components/MultiFaturaUpload'));

// ============================================
// TIPOS
// ============================================
interface FaturaData {
  id: string;
  mes: string;
  ano: number;
  consumoAtivoPonta: number;
  consumoAtivoForaPonta: number;
  demandaPonta: number;
  energiaReativaPonta: number;
  energiaReativaForaPonta: number;
  totalPagar: number;
  fp: number;
  arquivoNome?: string;
}

interface AnaliseFaturas {
  totalFaturas: number;
  periodo: { inicio: string; fim: string };
  consumoMedioMensal: number;
  consumoTotal: number;
  demandaMedia: number;
  demandaMaxima: number;
  energiaReativaMedia: number;
  energiaReativaTotal: number;
  fpMedio: number;
  fpMinimo: number;
  piorMes: FaturaData | null;
  melhorMes: FaturaData | null;
  tendenciaConsumo: 'crescendo' | 'estavel' | 'diminuindo';
  economiaPotencial: number;
  faturas: FaturaData[];
}

interface TransformadorConfig {
  potencia: number;
  quantidade: number;
}

interface ResultadoDimensionamento {
  totalKvar: number;
  economiaMensal: number;
  investimentoTotal: number;
  paybackMeses: number;
  fpAtual: number;
  fpProjetado: number;
  distribuicao: { potencia: number; quantidade: number }[];
  analise: AnaliseFaturas;
}

// ============================================
// FUNÇÃO PARA ANALISAR FATURAS
// ============================================
function analisarFaturas(faturas: FaturaData[]): AnaliseFaturas {
  if (faturas.length === 0) throw new Error('Nenhuma fatura para analisar');
  
  const faturasOrdenadas = [...faturas].sort((a, b) => {
    if (a.ano !== b.ano) return a.ano - b.ano;
    const meses = { Jan: 1, Fev: 2, Mar: 3, Abr: 4, Mai: 5, Jun: 6, Jul: 7, Ago: 8, Set: 9, Out: 10, Nov: 11, Dez: 12 };
    return (meses[a.mes as keyof typeof meses] || 0) - (meses[b.mes as keyof typeof meses] || 0);
  });
  
  const consumos = faturasOrdenadas.map(f => f.consumoAtivoPonta + f.consumoAtivoForaPonta);
  const consumoTotal = consumos.reduce((a, b) => a + b, 0);
  const consumoMedioMensal = consumoTotal / faturas.length;
  
  const demandas = faturasOrdenadas.map(f => f.demandaPonta);
  const demandaMedia = demandas.reduce((a, b) => a + b, 0) / faturas.length;
  const demandaMaxima = Math.max(...demandas);
  
  const reativos = faturasOrdenadas.map(f => f.energiaReativaPonta + f.energiaReativaForaPonta);
  const energiaReativaTotal = reativos.reduce((a, b) => a + b, 0);
  const energiaReativaMedia = energiaReativaTotal / faturas.length;
  
  const fps = faturasOrdenadas.map(f => f.fp);
  const fpMedio = fps.reduce((a, b) => a + b, 0) / faturas.length;
  const fpMinimo = Math.min(...fps);
  const piorMes = faturasOrdenadas.find(f => f.fp === fpMinimo) || null;
  const melhorMes = faturasOrdenadas.find(f => f.fp === Math.max(...fps)) || null;
  
  let tendenciaConsumo: 'crescendo' | 'estavel' | 'diminuindo' = 'estavel';
  if (faturas.length >= 3) {
    const primeiraMetade = consumos.slice(0, Math.floor(faturas.length / 2)).reduce((a, b) => a + b, 0);
    const segundaMetade = consumos.slice(Math.floor(faturas.length / 2)).reduce((a, b) => a + b, 0);
    if (segundaMetade > primeiraMetade * 1.05) tendenciaConsumo = 'crescendo';
    else if (segundaMetade < primeiraMetade * 0.95) tendenciaConsumo = 'diminuindo';
  }
  
  const economiaPotencial = reativos.reduce((acc, reat) => {
    if (fpMinimo < 0.92) return acc + reat * 0.31;
    return acc;
  }, 0) / faturas.length;
  
  return {
    totalFaturas: faturas.length,
    periodo: { inicio: `${faturasOrdenadas[0].mes}/${faturasOrdenadas[0].ano}`, fim: `${faturasOrdenadas[faturasOrdenadas.length - 1].mes}/${faturasOrdenadas[faturasOrdenadas.length - 1].ano}` },
    consumoMedioMensal,
    consumoTotal,
    demandaMedia,
    demandaMaxima,
    energiaReativaMedia,
    energiaReativaTotal,
    fpMedio,
    fpMinimo,
    piorMes,
    melhorMes,
    tendenciaConsumo,
    economiaPotencial,
    faturas: faturasOrdenadas
  };
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function DimensionarPage() {
  const [transformadores] = useState<TransformadorConfig[]>([
    { potencia: 225, quantidade: 7 },
    { potencia: 75, quantidade: 1 }
  ]);
  const [faturas, setFaturas] = useState<FaturaData[]>([]);
  const [analise, setAnalise] = useState<AnaliseFaturas | null>(null);
  const [targetFP, setTargetFP] = useState<number>(0.92);
  const [resultado, setResultado] = useState<ResultadoDimensionamento | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const potenciaTotalTransformadores = transformadores.reduce((acc, t) => acc + (t.potencia * t.quantidade), 1650);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleFaturasLoaded = (novasFaturas: FaturaData[]) => {
    setFaturas(novasFaturas);
    const analiseRealizada = analisarFaturas(novasFaturas);
    setAnalise(analiseRealizada);
    
    Swal.fire({
      title: 'Análise Concluída!',
      html: `
        <div class="text-left">
          <p><strong>📊 Resumo das ${analiseRealizada.totalFaturas} faturas:</strong></p>
          <p>Período: ${analiseRealizada.periodo.inicio} a ${analiseRealizada.periodo.fim}</p>
          <p>Consumo médio: ${analiseRealizada.consumoMedioMensal.toFixed(0)} kWh/mês</p>
          <p>Demanda média: ${analiseRealizada.demandaMedia.toFixed(0)} kW</p>
          <p>FP médio: ${(analiseRealizada.fpMedio * 100).toFixed(1)}%</p>
          <p>Pior FP: ${(analiseRealizada.fpMinimo * 100).toFixed(1)}% (${analiseRealizada.piorMes?.mes}/${analiseRealizada.piorMes?.ano})</p>
        </div>
      `,
      icon: 'success',
      confirmButtonColor: '#0a2b3c'
    });
  };

  const calcularDimensionamento = () => {
    if (!analise) {
      Swal.fire('Atenção', 'Carregue e processe as faturas primeiro', 'warning');
      return;
    }
    
    setCalculando(true);
    
    try {
      const piorMes = analise.piorMes;
      if (!piorMes) throw new Error('Dados insuficientes');
      
      const consumoTotal = piorMes.consumoAtivoPonta + piorMes.consumoAtivoForaPonta;
      const potenciaMedia = consumoTotal / 220;
      const fpAtual = piorMes.fp;
      
      const phi1 = Math.acos(fpAtual);
      const phi2 = Math.acos(targetFP);
      const kvarProcesso = potenciaMedia * (Math.tan(phi1) - Math.tan(phi2));
      const kvarTrafo = potenciaTotalTransformadores * 0.025;
      let totalKvar = Math.ceil((kvarProcesso + kvarTrafo) / 5) * 5;
      
      const distribuicao: { potencia: number; quantidade: number }[] = [];
      let restante = totalKvar;
      
      const kvarPorTrafo225 = Math.min(60, Math.floor(restante / 7));
      if (kvarPorTrafo225 > 0) {
        distribuicao.push({ potencia: kvarPorTrafo225, quantidade: 7 });
        restante -= kvarPorTrafo225 * 7;
      }
      
      const kvarPorTrafo75 = Math.min(30, restante);
      if (kvarPorTrafo75 > 0) {
        distribuicao.push({ potencia: kvarPorTrafo75, quantidade: 1 });
      }
      
      const economiaMensal = analise.energiaReativaMedia * 0.31 * (fpAtual < 0.92 ? 1 : 0.5);
      const investimentoTotal = totalKvar * 89.9;
      const paybackMeses = economiaMensal > 0 ? Math.ceil(investimentoTotal / economiaMensal) : 0;
      
      setResultado({
        totalKvar,
        economiaMensal,
        investimentoTotal,
        paybackMeses,
        fpAtual,
        fpProjetado: targetFP,
        distribuicao,
        analise
      });
      
      Swal.fire({
        title: 'Dimensionamento Concluído!',
        html: `<p>Banco de capacitores recomendado: <strong>${totalKvar} kVAr</strong></p>
               <p>FP atual: ${(fpAtual * 100).toFixed(1)}% → FP projetado: ${(targetFP * 100).toFixed(0)}%</p>
               <p>Economia mensal estimada: <strong>R$ ${economiaMensal.toFixed(2)}</strong></p>
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

  const exportarPDF = async () => {
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
      pdf.save(`Analise_Faturas_${new Date().toISOString().slice(0,10)}.pdf`);
      Swal.close();
      Swal.fire('PDF gerado!', 'Relatório exportado com sucesso.', 'success');
    } catch (error) {
      Swal.close();
      Swal.fire('Erro', 'Falha ao gerar PDF', 'error');
    }
  };

  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-primary">Análise de Faturas e Dimensionamento</h1>
        <p className="text-slate-500 mt-2">Upload de múltiplas faturas (3 a 12 meses) para análise completa</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
              <FileText size={20} className="text-secondary" />
              Faturas (3 a 12 meses)
            </h2>
            <Suspense fallback={<div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>}>
              <MultiFaturaUpload onFaturasLoaded={handleFaturasLoaded} />
            </Suspense>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
              <Package size={20} className="text-secondary" />
              Transformadores
            </h2>
            <div className="mt-4 p-3 bg-primary/5 rounded-xl">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Potência Total:</span><span className="font-bold text-primary">1.650 kVA</span></div>
              <div className="flex justify-between text-sm mt-1"><span className="text-slate-500">Referência:</span><span className="font-bold text-secondary">7 x 225 kVA + 1 x 75 kVA</span></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-2">Fator de Potência Desejado</label>
            <select value={targetFP} onChange={(e) => setTargetFP(parseFloat(e.target.value))} className="w-full rounded-xl border border-slate-200 p-3 mb-6">
              <option value={0.92}>0.92 (mínimo regulamentar)</option>
              <option value={0.95}>0.95 (recomendado)</option>
              <option value={0.98}>0.98 (excelente)</option>
            </select>
            <button onClick={calcularDimensionamento} disabled={calculando || !analise} className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {calculando ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />} Dimensionar Banco de Capacitores
            </button>
            {!analise && <p className="text-xs text-amber-600 mt-2 text-center">⚠️ Carregue e processe as faturas primeiro</p>}
          </div>
        </div>

        <div className="lg:col-span-7">
          {analise && resultado ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div ref={reportRef} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                <div className="bg-slate-900 p-6 text-white text-center">
                  <Zap size={32} className="mx-auto text-secondary mb-2" />
                  <h2 className="text-2xl font-black">CapacitorManager</h2>
                  <p className="text-slate-400 text-sm">Relatório de Análise de Faturas e Dimensionamento</p>
                </div>
                
                <div className="p-6 space-y-6">
                  <div>
                    <h3 className="font-bold text-primary mb-3 flex items-center gap-2"><History size={18} /> Resumo das Faturas</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-slate-500">Período</p>
                        <p className="text-xs font-bold">{analise.periodo.inicio} a {analise.periodo.fim}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-slate-500">Total Faturas</p>
                        <p className="text-lg font-bold text-primary">{analise.totalFaturas}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-slate-500">Consumo Médio</p>
                        <p className="text-xs font-bold">{analise.consumoMedioMensal.toFixed(0)} kWh</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-slate-500">Demanda Média</p>
                        <p className="text-xs font-bold">{analise.demandaMedia.toFixed(0)} kW</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-primary/5 rounded-xl p-4">
                    <h3 className="font-bold text-primary mb-3 flex items-center gap-2"><TrendingUp size={18} /> Análise do Fator de Potência</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center"><p className="text-xs text-slate-500">FP Médio</p><p className="text-2xl font-bold text-primary">{(analise.fpMedio * 100).toFixed(1)}%</p></div>
                      <div className="text-center"><p className="text-xs text-slate-500">Pior FP</p><p className="text-2xl font-bold text-amber-600">{(analise.fpMinimo * 100).toFixed(1)}%</p><p className="text-[10px] text-slate-400">{analise.piorMes?.mes}/{analise.piorMes?.ano}</p></div>
                    </div>
                    <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${analise.fpMedio * 100}%` }} /></div>
                  </div>
                  
                  <div className="border-t border-slate-100 pt-4">
                    <h3 className="font-bold text-primary mb-3 flex items-center gap-2"><Calculator size={18} /> Dimensionamento Recomendado</h3>
                    <div className="text-center mb-4"><p className="text-4xl font-bold text-primary">{resultado.totalKvar} <span className="text-lg">kVAr</span></p><p className="text-xs text-slate-500">Banco de capacitores recomendado</p></div>
                    <div className="space-y-2">{resultado.distribuicao.map((item, idx) => (<div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg"><span className="font-medium">{item.quantidade} bancos</span><span className="font-bold text-primary">{item.potencia} kVAr cada</span><span className="text-sm text-slate-500">Total: {item.quantidade * item.potencia} kVAr</span></div>))}</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 rounded-xl p-4 text-center"><DollarSign size={20} className="mx-auto text-green-600 mb-1" /><p className="text-xs text-slate-500">Economia Mensal</p><p className="text-xl font-bold text-green-700">R$ {resultado.economiaMensal.toFixed(2)}</p></div>
                    <div className="bg-blue-50 rounded-xl p-4 text-center"><DollarSign size={20} className="mx-auto text-blue-600 mb-1" /><p className="text-xs text-slate-500">Payback</p><p className="text-xl font-bold text-blue-700">{resultado.paybackMeses} meses</p></div>
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-primary mb-3 flex items-center gap-2"><Calendar size={18} /> Detalhamento das Faturas</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50"><tr><th className="p-2 text-left">Mês/Ano</th><th className="p-2 text-right">kWh</th><th className="p-2 text-right">kVArh</th><th className="p-2 text-right">Demanda</th><th className="p-2 text-right">FP</th><th className="p-2 text-right">R$</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">{analise.faturas.map((f, idx) => (<tr key={idx} className={f.fp === analise.fpMinimo ? 'bg-amber-50' : ''}><td className="p-2 font-medium">{f.mes}/{f.ano}</td><td className="p-2 text-right">{(f.consumoAtivoPonta + f.consumoAtivoForaPonta).toLocaleString()}</td><td className="p-2 text-right">{(f.energiaReativaPonta + f.energiaReativaForaPonta).toLocaleString()}</td><td className="p-2 text-right">{f.demandaPonta}</td><td className="p-2 text-right">{(f.fp * 100).toFixed(1)}%</td><td className="p-2 text-right">{f.totalPagar.toLocaleString()}</td></tr>))}</tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4"><button onClick={exportarPDF} className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50 flex items-center justify-center gap-2"><Download size={18} /> Exportar Relatório</button><button onClick={calcularDimensionamento} className="flex-1 bg-primary text-white py-3 rounded-xl font-medium hover:bg-primary/90 flex items-center justify-center gap-2"><Calculator size={18} /> Recalcular</button></div>
            </motion.div>
          ) : analise ? (
            <div className="text-center p-12 bg-slate-50 rounded-2xl"><Calculator size={48} className="mx-auto text-slate-400 mb-4" /><p className="text-slate-500">Clique em "Dimensionar" para calcular o banco de capacitores</p></div>
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"><FileText size={64} className="text-slate-300 mb-4" /><h3 className="text-xl font-bold text-slate-500">Aguardando Faturas</h3><p className="text-sm text-slate-400 mt-2 max-w-md">Carregue de 3 a 12 faturas em PDF para análise completa</p></div>
          )}
        </div>
      </div>
    </div>
  );
}