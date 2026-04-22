'use client';

import React, { useState, useRef } from 'react';
import { 
  Calculator, Zap, TrendingUp, DollarSign, CheckCircle2, 
  Upload, FileText, X, Loader2, AlertTriangle, Plus,
  Trash2, Download, Printer, Package, Layers, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

// ============================================
// TIPOS
// ============================================
interface FaturaData {
  mes: string;
  consumoAtivoPonta: number;
  consumoAtivoForaPonta: number;
  demandaPonta: number;
  energiaReativaPonta: number;
  energiaReativaForaPonta: number;
  totalPagar: number;
}

interface TransformadorConfig {
  potencia: number;
  quantidade: number;
}

interface ResultadoDimensionamento {
  totalKvar: number;
  kvarPorTrafo: number[];
  economiaMensal: number;
  investimentoTotal: number;
  paybackMeses: number;
  fpAtual: number;
  fpProjetado: number;
  reducaoCorrentePercentual: number;
  distribuicao: { potencia: number; quantidade: number }[];
}

// ============================================
// COMPONENTE DE UPLOAD DE FATURA INDIVIDUAL
// ============================================
function FaturaInput({ fatura, index, onUpdate, onRemove }: { 
  fatura: FaturaData; 
  index: number; 
  onUpdate: (index: number, field: keyof FaturaData, value: any) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-primary">{fatura.mes}</span>
        <button onClick={() => onRemove(index)} className="text-red-400 hover:text-red-600">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[8px] font-black text-slate-400">kWh Ponta</label>
          <input 
            type="number" 
            value={fatura.consumoAtivoPonta || ''} 
            onChange={(e) => onUpdate(index, 'consumoAtivoPonta', parseFloat(e.target.value) || 0)}
            className="w-full rounded-lg border border-slate-200 p-2 text-xs"
            placeholder="Ex: 2610"
          />
        </div>
        <div>
          <label className="text-[8px] font-black text-slate-400">kWh Fora Ponta</label>
          <input 
            type="number" 
            value={fatura.consumoAtivoForaPonta || ''} 
            onChange={(e) => onUpdate(index, 'consumoAtivoForaPonta', parseFloat(e.target.value) || 0)}
            className="w-full rounded-lg border border-slate-200 p-2 text-xs"
            placeholder="Ex: 40616"
          />
        </div>
        <div>
          <label className="text-[8px] font-black text-slate-400">Demanda (kW)</label>
          <input 
            type="number" 
            value={fatura.demandaPonta || ''} 
            onChange={(e) => onUpdate(index, 'demandaPonta', parseFloat(e.target.value) || 0)}
            className="w-full rounded-lg border border-slate-200 p-2 text-xs"
            placeholder="Ex: 293"
          />
        </div>
        <div>
          <label className="text-[8px] font-black text-slate-400">kVArh Ponta</label>
          <input 
            type="number" 
            value={fatura.energiaReativaPonta || ''} 
            onChange={(e) => onUpdate(index, 'energiaReativaPonta', parseFloat(e.target.value) || 0)}
            className="w-full rounded-lg border border-slate-200 p-2 text-xs"
            placeholder="Ex: 732"
          />
        </div>
        <div className="col-span-2">
          <label className="text-[8px] font-black text-slate-400">kVArh Fora Ponta</label>
          <input 
            type="number" 
            value={fatura.energiaReativaForaPonta || ''} 
            onChange={(e) => onUpdate(index, 'energiaReativaForaPonta', parseFloat(e.target.value) || 0)}
            className="w-full rounded-lg border border-slate-200 p-2 text-xs"
            placeholder="Ex: 5129"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function DimensionarPage() {
  const [transformadores, setTransformadores] = useState<TransformadorConfig[]>([
    { potencia: 225, quantidade: 7 },
    { potencia: 75, quantidade: 1 }
  ]);
  
  const [faturas, setFaturas] = useState<FaturaData[]>([
    { mes: 'Jan/2025', consumoAtivoPonta: 0, consumoAtivoForaPonta: 0, demandaPonta: 0, energiaReativaPonta: 0, energiaReativaForaPonta: 0, totalPagar: 0 },
    { mes: 'Fev/2025', consumoAtivoPonta: 0, consumoAtivoForaPonta: 0, demandaPonta: 0, energiaReativaPonta: 0, energiaReativaForaPonta: 0, totalPagar: 0 },
    { mes: 'Mar/2025', consumoAtivoPonta: 0, consumoAtivoForaPonta: 0, demandaPonta: 0, energiaReativaPonta: 0, energiaReativaForaPonta: 0, totalPagar: 0 },
    { mes: 'Abr/2025', consumoAtivoPonta: 0, consumoAtivoForaPonta: 0, demandaPonta: 0, energiaReativaPonta: 0, energiaReativaForaPonta: 0, totalPagar: 0 },
    { mes: 'Mai/2025', consumoAtivoPonta: 0, consumoAtivoForaPonta: 0, demandaPonta: 0, energiaReativaPonta: 0, energiaReativaForaPonta: 0, totalPagar: 0 },
    { mes: 'Jun/2025', consumoAtivoPonta: 0, consumoAtivoForaPonta: 0, demandaPonta: 0, energiaReativaPonta: 0, energiaReativaForaPonta: 0, totalPagar: 0 },
    { mes: 'Jul/2025', consumoAtivoPonta: 0, consumoAtivoForaPonta: 0, demandaPonta: 0, energiaReativaPonta: 0, energiaReativaForaPonta: 0, totalPagar: 0 },
    { mes: 'Ago/2025', consumoAtivoPonta: 0, consumoAtivoForaPonta: 0, demandaPonta: 0, energiaReativaPonta: 0, energiaReativaForaPonta: 0, totalPagar: 0 },
    { mes: 'Set/2025', consumoAtivoPonta: 0, consumoAtivoForaPonta: 0, demandaPonta: 0, energiaReativaPonta: 0, energiaReativaForaPonta: 0, totalPagar: 0 },
    { mes: 'Out/2025', consumoAtivoPonta: 0, consumoAtivoForaPonta: 0, demandaPonta: 0, energiaReativaPonta: 0, energiaReativaForaPonta: 0, totalPagar: 0 },
    { mes: 'Nov/2025', consumoAtivoPonta: 0, consumoAtivoForaPonta: 0, demandaPonta: 0, energiaReativaPonta: 0, energiaReativaForaPonta: 0, totalPagar: 0 },
    { mes: 'Dez/2025', consumoAtivoPonta: 0, consumoAtivoForaPonta: 0, demandaPonta: 0, energiaReativaPonta: 0, energiaReativaForaPonta: 0, totalPagar: 0 }
  ]);

  const [targetFP, setTargetFP] = useState<number>(0.92);
  const [resultado, setResultado] = useState<ResultadoDimensionamento | null>(null);
  const [calculando, setCalculando] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Calcular potência total dos transformadores
  const potenciaTotalTransformadores = transformadores.reduce((acc, t) => acc + (t.potencia * t.quantidade), 0);

  // Função para adicionar nova fatura
  const addFatura = () => {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const ano = new Date().getFullYear();
    const newMes = `${meses[faturas.length % 12]}/${ano}`;
    setFaturas([...faturas, { 
      mes: newMes, 
      consumoAtivoPonta: 0, 
      consumoAtivoForaPonta: 0, 
      demandaPonta: 0, 
      energiaReativaPonta: 0, 
      energiaReativaForaPonta: 0, 
      totalPagar: 0 
    }]);
  };

  // Função para remover fatura
  const removeFatura = (index: number) => {
    setFaturas(faturas.filter((_, i) => i !== index));
  };

  // Função para atualizar fatura
  const updateFatura = (index: number, field: keyof FaturaData, value: any) => {
    const novasFaturas = [...faturas];
    novasFaturas[index] = { ...novasFaturas[index], [field]: value };
    setFaturas(novasFaturas);
  };

  // Função para carregar dados da fatura exemplo
  const carregarFaturaExemplo = () => {
    const faturasExemplo: FaturaData[] = [
      { mes: 'Jan/2025', consumoAtivoPonta: 2610, consumoAtivoForaPonta: 40616, demandaPonta: 293, energiaReativaPonta: 732, energiaReativaForaPonta: 5129, totalPagar: 34464.69 },
      { mes: 'Fev/2025', consumoAtivoPonta: 2750, consumoAtivoForaPonta: 39800, demandaPonta: 301, energiaReativaPonta: 756, energiaReativaForaPonta: 4980, totalPagar: 34123.45 },
      { mes: 'Mar/2025', consumoAtivoPonta: 2680, consumoAtivoForaPonta: 42100, demandaPonta: 288, energiaReativaPonta: 712, energiaReativaForaPonta: 5350, totalPagar: 35789.23 },
      { mes: 'Abr/2025', consumoAtivoPonta: 2590, consumoAtivoForaPonta: 38900, demandaPonta: 285, energiaReativaPonta: 698, energiaReativaForaPonta: 4920, totalPagar: 33456.78 },
      { mes: 'Mai/2025', consumoAtivoPonta: 2710, consumoAtivoForaPonta: 41200, demandaPonta: 295, energiaReativaPonta: 745, energiaReativaForaPonta: 5210, totalPagar: 35123.12 },
      { mes: 'Jun/2025', consumoAtivoPonta: 2650, consumoAtivoForaPonta: 40500, demandaPonta: 290, energiaReativaPonta: 728, energiaReativaForaPonta: 5080, totalPagar: 34789.56 },
      { mes: 'Jul/2025', consumoAtivoPonta: 2800, consumoAtivoForaPonta: 43000, demandaPonta: 310, energiaReativaPonta: 790, energiaReativaForaPonta: 5450, totalPagar: 36890.34 },
      { mes: 'Ago/2025', consumoAtivoPonta: 2720, consumoAtivoForaPonta: 41800, demandaPonta: 298, energiaReativaPonta: 760, energiaReativaForaPonta: 5300, totalPagar: 36234.67 },
      { mes: 'Set/2025', consumoAtivoPonta: 2580, consumoAtivoForaPonta: 39500, demandaPonta: 282, energiaReativaPonta: 690, energiaReativaForaPonta: 4880, totalPagar: 33234.89 },
      { mes: 'Out/2025', consumoAtivoPonta: 2630, consumoAtivoForaPonta: 40800, demandaPonta: 287, energiaReativaPonta: 715, energiaReativaForaPonta: 5150, totalPagar: 34567.90 },
      { mes: 'Nov/2025', consumoAtivoPonta: 2770, consumoAtivoForaPonta: 42500, demandaPonta: 305, energiaReativaPonta: 780, energiaReativaForaPonta: 5380, totalPagar: 36567.23 },
      { mes: 'Dez/2025', consumoAtivoPonta: 2850, consumoAtivoForaPonta: 44000, demandaPonta: 315, energiaReativaPonta: 810, energiaReativaForaPonta: 5600, totalPagar: 37890.45 }
    ];
    setFaturas(faturasExemplo);
    Swal.fire('Dados carregados!', 'Faturas exemplo preenchidas com sucesso.', 'success');
  };

  // Função principal de dimensionamento
  const calcularDimensionamento = () => {
    setCalculando(true);
    
    try {
      // Filtrar faturas com dados válidos
      const faturasValidas = faturas.filter(f => f.consumoAtivoPonta > 0 || f.consumoAtivoForaPonta > 0);
      
      if (faturasValidas.length === 0) {
        Swal.fire('Atenção', 'Preencha pelo menos uma fatura com dados válidos', 'warning');
        setCalculando(false);
        return;
      }

      // Calcular médias dos 3 piores meses (FP mais baixo)
      const faturasComFP = faturasValidas.map(f => {
        const consumoTotal = f.consumoAtivoPonta + f.consumoAtivoForaPonta;
        const reativoTotal = f.energiaReativaPonta + f.energiaReativaForaPonta;
        const fp = consumoTotal / Math.sqrt(Math.pow(consumoTotal, 2) + Math.pow(reativoTotal, 2));
        const potenciaMedia = consumoTotal / 220; // 220 horas/mês típico
        return { ...f, fp, potenciaMedia };
      });

      // Ordenar por pior FP e pegar os 3 piores
      const pioresFaturas = [...faturasComFP].sort((a, b) => a.fp - b.fp).slice(0, 3);
      
      // Calcular médias dos piores meses
      const mediaPotencia = pioresFaturas.reduce((acc, f) => acc + f.potenciaMedia, 0) / pioresFaturas.length;
      const mediaFP = pioresFaturas.reduce((acc, f) => acc + f.fp, 0) / pioresFaturas.length;
      
      // Cálculo do capacitor necessário
      const phi1 = Math.acos(mediaFP);
      const phi2 = Math.acos(targetFP);
      const kvarProcesso = mediaPotencia * (Math.tan(phi1) - Math.tan(phi2));
      
      // Perdas no transformador (2.5% da potência total)
      const kvarTrafo = potenciaTotalTransformadores * 0.025;
      
      // Total de kVAr necessário
      let totalKvar = kvarProcesso + kvarTrafo;
      
      // Ajustar para o padrão de mercado (múltiplos de 5)
      totalKvar = Math.ceil(totalKvar / 5) * 5;
      
      // Distribuir entre os transformadores proporcionalmente
      const kvarPorTrafo: number[] = [];
      let kvarRestante = totalKvar;
      
      // Distribuir primeiro para os transformadores maiores
      const trafosOrdenados = [...transformadores].sort((a, b) => b.potencia - a.potencia);
      for (const trafo of trafosOrdenados) {
        let kvarParaTrafo = Math.floor(totalKvar * (trafo.potencia * trafo.quantidade) / potenciaTotalTransformadores);
        kvarParaTrafo = Math.ceil(kvarParaTrafo / 5) * 5; // Múltiplo de 5
        for (let i = 0; i < trafo.quantidade; i++) {
          kvarPorTrafo.push(kvarParaTrafo);
        }
        kvarRestante -= kvarParaTrafo * trafo.quantidade;
      }
      
      // Distribuir resto
      if (kvarRestante > 0) {
        const restoPorTrafo = Math.ceil(kvarRestante / kvarPorTrafo.length / 5) * 5;
        for (let i = 0; i < kvarPorTrafo.length; i++) {
          kvarPorTrafo[i] += restoPorTrafo;
        }
      }
      
      // Criar distribuição final (agrupar por potência)
      const distribuicaoMap = new Map<number, number>();
      for (const kvar of kvarPorTrafo) {
        distribuicaoMap.set(kvar, (distribuicaoMap.get(kvar) || 0) + 1);
      }
      const distribuicao = Array.from(distribuicaoMap.entries()).map(([potencia, quantidade]) => ({ potencia, quantidade }));
      
      // Calcular economia
      const energiaReativaMedia = pioresFaturas.reduce((acc, f) => acc + f.energiaReativaPonta + f.energiaReativaForaPonta, 0) / pioresFaturas.length;
      const economiaMensal = energiaReativaMedia * 0.31; // R$ 0,31 por kVArh
      const investimentoTotal = totalKvar * 89.9; // R$ 89,90 por kVAr
      const paybackMeses = economiaMensal > 0 ? Math.ceil(investimentoTotal / economiaMensal) : 0;
      
      // Redução de corrente
      const reducaoCorrentePercentual = ((mediaFP - targetFP) / mediaFP) * 100;
      
      setResultado({
        totalKvar,
        kvarPorTrafo,
        economiaMensal,
        investimentoTotal,
        paybackMeses,
        fpAtual: mediaFP,
        fpProjetado: targetFP,
        reducaoCorrentePercentual,
        distribuicao
      });
      
      Swal.fire({
        title: 'Dimensionamento Concluído!',
        html: `<p>Banco de capacitores recomendado: <strong>${totalKvar} kVAr</strong></p>
               <p>FP atual: ${(mediaFP * 100).toFixed(1)}% → FP projetado: ${(targetFP * 100).toFixed(0)}%</p>
               <p>Economia mensal estimada: <strong>R$ ${economiaMensal.toFixed(2)}</strong></p>`,
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
      pdf.save(`Dimensionamento_Capacitores_${new Date().toISOString().slice(0,10)}.pdf`);
      Swal.close();
      Swal.fire('PDF gerado!', 'Memorial exportado com sucesso.', 'success');
    } catch (error) {
      Swal.close();
      Swal.fire('Erro', 'Falha ao gerar PDF', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-primary">Dimensionamento de Banco de Capacitores</h1>
        <p className="text-slate-500 mt-2">Baseado em 12 faturas e configuração dos transformadores</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Coluna de Entrada */}
        <div className="lg:col-span-5 space-y-6">
          {/* Configuração dos Transformadores */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
              <Package size={20} className="text-secondary" />
              Transformadores
            </h2>
            <div className="space-y-3">
              {transformadores.map((trafo, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="flex-1 flex gap-2">
                    <div className="flex-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase">Potência (kVA)</label>
                      <input type="number" value={trafo.potencia} onChange={(e) => {
                        const novos = [...transformadores];
                        novos[idx].potencia = parseFloat(e.target.value) || 0;
                        setTransformadores(novos);
                      }} className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
                    </div>
                    <div className="w-20">
                      <label className="text-[8px] font-black text-slate-400 uppercase">Qtde</label>
                      <input type="number" value={trafo.quantidade} onChange={(e) => {
                        const novos = [...transformadores];
                        novos[idx].quantidade = parseInt(e.target.value) || 0;
                        setTransformadores(novos);
                      }} className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-primary/5 rounded-xl">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Potência Total:</span>
                <span className="font-bold text-primary">{potenciaTotalTransformadores} kVA</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-500">Referência:</span>
                <span className="font-bold text-secondary">7 x 225 kVA + 1 x 75 kVA</span>
              </div>
            </div>
          </div>

          {/* Faturas (12 meses) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                <History size={20} className="text-secondary" />
                Faturas (12 meses)
              </h2>
              <div className="flex gap-2">
                <button onClick={carregarFaturaExemplo} className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-lg hover:bg-primary/20">
                  Carregar Exemplo
                </button>
              </div>
            </div>
            
            <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
              {faturas.map((fatura, idx) => (
                <FaturaInput key={idx} fatura={fatura} index={idx} onUpdate={updateFatura} onRemove={removeFatura} />
              ))}
            </div>
            
            <button onClick={addFatura} className="w-full mt-4 py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-bold hover:border-secondary hover:text-secondary transition-all flex items-center justify-center gap-2">
              <Plus size={14} /> Adicionar Mês
            </button>
          </div>

          {/* Meta e Calcular */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-2">Fator de Potência Desejado</label>
            <select 
              value={targetFP} 
              onChange={(e) => setTargetFP(parseFloat(e.target.value))}
              className="w-full rounded-xl border border-slate-200 p-3 mb-6"
            >
              <option value={0.92}>0.92 (mínimo regulamentar)</option>
              <option value={0.95}>0.95 (recomendado)</option>
              <option value={0.98}>0.98 (excelente)</option>
            </select>

            <button 
              onClick={calcularDimensionamento}
              disabled={calculando}
              className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {calculando ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
              Dimensionar Banco de Capacitores
            </button>
          </div>
        </div>

        {/* Coluna de Resultados */}
        <div className="lg:col-span-7">
          {resultado ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Memorial */}
              <div ref={reportRef} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                <div className="bg-slate-900 p-6 text-white text-center">
                  <Zap size={32} className="mx-auto text-secondary mb-2" />
                  <h2 className="text-2xl font-black">CapacitorManager</h2>
                  <p className="text-slate-400 text-sm">Memorial de Dimensionamento</p>
                </div>
                
                <div className="p-6 space-y-6">
                  <div className="text-center">
                    <p className="text-sm text-slate-500">Potência Total Recomendada</p>
                    <p className="text-5xl font-bold text-primary">{resultado.totalKvar} <span className="text-2xl">kVAr</span></p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-emerald-50 rounded-xl p-3 text-center">
                      <TrendingUp size={20} className="mx-auto text-emerald-600 mb-1" />
                      <p className="text-xs text-slate-500">FP Atual</p>
                      <p className="text-xl font-bold text-emerald-700">{(resultado.fpAtual * 100).toFixed(1)}%</p>
                    </div>
                    <div className="bg-primary/10 rounded-xl p-3 text-center">
                      <CheckCircle2 size={20} className="mx-auto text-primary mb-1" />
                      <p className="text-xs text-slate-500">FP Projetado</p>
                      <p className="text-xl font-bold text-primary">{(resultado.fpProjetado * 100).toFixed(0)}%</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-3 text-center">
                      <Zap size={20} className="mx-auto text-amber-600 mb-1" />
                      <p className="text-xs text-slate-500">Redução Corrente</p>
                      <p className="text-xl font-bold text-amber-700">{Math.abs(resultado.reducaoCorrentePercentual).toFixed(0)}%</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <h3 className="font-bold text-primary mb-3">📦 Distribuição dos Capacitores</h3>
                    <div className="space-y-2">
                      {resultado.distribuicao.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                          <span className="font-medium">{item.quantidade} bancos</span>
                          <span className="font-bold text-primary">{item.potencia} kVAr cada</span>
                          <span className="text-sm text-slate-500">Total: {item.quantidade * item.potencia} kVAr</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 rounded-xl p-4 text-center">
                      <DollarSign size={20} className="mx-auto text-green-600 mb-1" />
                      <p className="text-xs text-slate-500">Economia Mensal</p>
                      <p className="text-xl font-bold text-green-700">R$ {resultado.economiaMensal.toFixed(2)}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-4 text-center">
                      <DollarSign size={20} className="mx-auto text-blue-600 mb-1" />
                      <p className="text-xs text-slate-500">Investimento Estimado</p>
                      <p className="text-xl font-bold text-blue-700">R$ {resultado.investimentoTotal.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="bg-primary/5 rounded-xl p-4 text-center">
                    <p className="text-sm text-slate-500">⏱️ Payback Estimado</p>
                    <p className="text-2xl font-bold text-primary">{resultado.paybackMeses} meses</p>
                    <p className="text-xs text-slate-400">(~{(resultado.paybackMeses / 12).toFixed(1)} anos)</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={exportarPDF} className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50 flex items-center justify-center gap-2">
                  <Printer size={18} /> Exportar PDF
                </button>
                <button onClick={calcularDimensionamento} className="flex-1 bg-primary text-white py-3 rounded-xl font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
                  <Calculator size={18} /> Recalcular
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <Calculator size={64} className="text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-500">Aguardando Dimensionamento</h3>
              <p className="text-sm text-slate-400 mt-2 max-w-md">
                Preencha os dados dos transformadores e das 12 faturas, depois clique em "Dimensionar".
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}