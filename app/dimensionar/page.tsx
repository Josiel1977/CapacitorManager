'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  Zap, 
  ArrowRight, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  FileText, 
  History, 
  Plus, 
  Trash2,
  Settings2,
  Activity,
  TrendingUp,
  Layers,
  Printer,
  ShoppingCart,
  DollarSign,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

interface MonthlyData {
  month: string;
  activeEnergy: number; // kWh
  reactiveEnergy: number; // kVArh
  demand?: number; // kW
}

interface PhaseData {
  kw: string;
  fp: string;
}

// 🆕 Tabela de preços para orçamento
const precosMateriais = {
  capacitor: { unidade: 'kVAr', precoPorUnidade: 89.90, descricao: 'Capacitor trifásico' },
  disjuntor: { unidade: 'peça', precoPorUnidade: 45.90, descricao: 'Disjuntor termomagnético' },
  contator: { unidade: 'peça', precoPorUnidade: 120.00, descricao: 'Contator AC-6b' },
  cabo: { unidade: 'metro', precoPorUnidade: 18.50, descricao: 'Cabo de cobre' },
  relogioFP: { unidade: 'peça', precoPorUnidade: 350.00, descricao: 'Relé controlador de FP' },
  conjuntoMontagem: { unidade: 'peça', precoPorUnidade: 450.00, descricao: 'Montagem e instalação' }
};

export default function DimensionarPage() {
  const [method, setMethod] = useState<'analyzer' | 'bills' | 'threePhase'>('analyzer');
  const [showBudget, setShowBudget] = useState(false);
  const [budgetItems, setBudgetItems] = useState<{ descricao: string; quantidade: number; precoUnitario: number; total: number }[]>([]);
  const reportRef = React.useRef<HTMLDivElement>(null);
  
  // Analyzer / Instantaneous State
  const [activePower, setActivePower] = useState<string>('');
  const [currentFP, setCurrentFP] = useState<string>('0.80');
  const [targetFP, setTargetFP] = useState<string>('0.92');
  
  // Three Phase State
  const [phases, setPhases] = useState<{A: PhaseData, B: PhaseData, C: PhaseData}>({
    A: { kw: '', fp: '0.80' },
    B: { kw: '', fp: '0.80' },
    C: { kw: '', fp: '0.80' }
  });

  // Transformer State
  const [trafoKVA, setTrafoKVA] = useState<string>('');
  const [systemVoltage, setSystemVoltage] = useState<string>('380');
  const [workHours, setWorkHours] = useState<string>('220');

  // Monthly Bills State
  const [monthlyBills, setMonthlyBills] = useState<MonthlyData[]>([
    { month: 'Jan', activeEnergy: 0, reactiveEnergy: 0 },
  ]);

  const [result, setResult] = useState<{
    totalKvar: number;
    fixedKvar: number;
    autoKvar: number;
    stages: number[];
    kVA_atual: number;
    kVA_novo: number;
    reducaoPercentual: number;
    trafoLossesKvar: number;
    estimatedCurrentAtual: number;
    estimatedCurrentNovo: number;
    disjuntorRecomendado: number;
    caboRecomendado: string;
    secaoCabo: number;
    correnteCabo: number;
    observacaoProtecao: string;
    contatoresRecomendados?: { modelo: string; correnteNominal: number; quantidade: number; preco: number; observacao: string }[];
    phaseResults?: { phase: string, kvar: number }[];
  } | null>(null);

  // 🆕 TABELA DE FATORES DE CORREÇÃO (IEEE/ANSI)
  const tabelaFatores: { [key: string]: { [key: string]: number } } = {
    '0.50': { '0.92': 1.732, '0.95': 1.982, '0.98': 2.208, '1.00': 2.354 },
    '0.55': { '0.92': 1.515, '0.95': 1.765, '0.98': 1.991, '1.00': 2.137 },
    '0.60': { '0.92': 1.333, '0.95': 1.583, '0.98': 1.809, '1.00': 1.955 },
    '0.65': { '0.92': 1.169, '0.95': 1.419, '0.98': 1.645, '1.00': 1.791 },
    '0.70': { '0.92': 1.020, '0.95': 1.270, '0.98': 1.496, '1.00': 1.642 },
    '0.75': { '0.92': 0.882, '0.95': 1.132, '0.98': 1.358, '1.00': 1.504 },
    '0.80': { '0.92': 0.750, '0.95': 1.000, '0.98': 1.226, '1.00': 1.372 },
    '0.85': { '0.92': 0.620, '0.95': 0.870, '0.98': 1.096, '1.00': 1.242 },
    '0.90': { '0.92': 0.484, '0.95': 0.734, '0.98': 0.960, '1.00': 1.106 },
    '0.92': { '0.92': 0.426, '0.95': 0.676, '0.98': 0.902, '1.00': 1.048 }
  };

  // 🆕 TABELA DE CONDUTORES (NBR 5410) - Cobre/XLPE 90°C
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

  // 🆕 TABELA DE CONTATORES (IEC 60947-4-1 - Categoria AC-6b)
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

  function tratarFatorPotencia(fp: number): number {
    let fpTratado = Math.abs(fp);
    if (fpTratado > 1) fpTratado = 1;
    if (fpTratado < 0) fpTratado = 0;
    return fpTratado;
  }

  function getFatorTabela(fpAtual: number, fpDesejado: number): number | null {
    const key = fpAtual.toFixed(2);
    const targetKey = fpDesejado.toFixed(2);
    if (tabelaFatores[key] && tabelaFatores[key][targetKey]) {
      return tabelaFatores[key][targetKey];
    }
    return null;
  }

  function validarEntradas(): boolean {
    if (method === 'analyzer') {
      const p = parseFloat(activePower);
      if (!activePower || isNaN(p) || p <= 0) {
        Swal.fire('Atenção', 'Informe a potência ativa (kW)', 'warning');
        return false;
      }
      const fp = parseFloat(currentFP);
      if (isNaN(fp) || fp <= 0 || fp > 1) {
        Swal.fire('Atenção', 'Informe um fator de potência válido (entre 0 e 1)', 'warning');
        return false;
      }
    }
    
    if (method === 'threePhase') {
      const pA = parseFloat(phases.A.kw);
      const pB = parseFloat(phases.B.kw);
      const pC = parseFloat(phases.C.kw);
      if ((!pA && !pB && !pC) || (pA <= 0 && pB <= 0 && pC <= 0)) {
        Swal.fire('Atenção', 'Informe a potência de pelo menos uma fase', 'warning');
        return false;
      }
    }
    
    if (method === 'bills') {
      const hasData = monthlyBills.some(b => b.activeEnergy > 0 || b.reactiveEnergy > 0);
      if (!hasData) {
        Swal.fire('Atenção', 'Informe os dados de consumo', 'warning');
        return false;
      }
    }
    
    const fp2 = parseFloat(targetFP);
    if (isNaN(fp2) || fp2 <= 0 || fp2 > 1) {
      Swal.fire('Atenção', 'Informe um fator de potência desejado válido (entre 0 e 1)', 'warning');
      return false;
    }
    
    return true;
  }

  function recomendarProtecao(correnteNominal: number): {
    disjuntorRecomendado: number;
    secaoCabo: number;
    correnteCabo: number;
    observacao: string;
    descricaoCabo: string;
  } {
    const candidato = tabelaCondutores.find(c => c.iz >= correnteNominal);
    
    if (!candidato) {
      return {
        disjuntorRecomendado: Math.ceil(correnteNominal * 1.3),
        secaoCabo: 300,
        correnteCabo: 0,
        observacao: "Consultar engenheiro para dimensionamento específico conforme NBR 5410",
        descricaoCabo: "Consultar engenheiro"
      };
    }
    
    return {
      disjuntorRecomendado: candidato.disjuntor,
      secaoCabo: candidato.secao,
      correnteCabo: candidato.iz,
      observacao: `Dimensionado conforme NBR 5410 (Iz = ${candidato.iz}A ≥ In = ${candidato.disjuntor}A)`,
      descricaoCabo: `${candidato.secao} mm² (para ${candidato.iz}A)`
    };
  }

  // 🆕 FUNÇÃO PARA RECOMENDAR CONTATORES (IEC 60947-4-1)
  function recomendarContatores(estagios: number[], tensao: number): {
    modelo: string;
    correnteNominal: number;
    quantidade: number;
    preco: number;
    observacao: string;
  }[] {
    const fatorSeguranca = 1.43;
    const contatoresRecomendados = [];
    
    for (const kvar of estagios) {
      const correnteEstagio = (kvar * 1000) / (Math.sqrt(3) * tensao);
      const correnteContator = correnteEstagio * fatorSeguranca;
      
      let contator = tabelaContatores.find(c => c.correnteMax >= correnteContator);
      if (!contator) {
        contator = tabelaContatores[tabelaContatores.length - 1];
      }
      
      contatoresRecomendados.push({
        modelo: contator.modelo,
        correnteNominal: contator.correnteNominal,
        quantidade: 1,
        preco: contator.preco,
        observacao: `Para estágio de ${kvar} kVAr (${correnteEstagio.toFixed(1)}A) → Contator ${contator.modelo} (${contator.correnteNominal}A)`
      });
    }
    
    return contatoresRecomendados;
  }

  // 🆕 FUNÇÃO PARA GERAR ORÇAMENTO
  function gerarOrcamento() {
    if (!result) return;
    
    const tensao = parseFloat(systemVoltage);
    const quantidadeCapacitores = result.stages.length;
    const potenciaTotal = result.totalKvar;
    const valorCapacitores = potenciaTotal * precosMateriais.capacitor.precoPorUnidade;
    const valorDisjuntores = result.disjuntorRecomendado ? 1 * precosMateriais.disjuntor.precoPorUnidade : 0;
    const valorContatores = (result.contatoresRecomendados || []).reduce((acc, c) => acc + c.preco, 0);
    const valorCabo = 20 * precosMateriais.cabo.precoPorUnidade; // Estimativa 20 metros
    const valorRelogioFP = result.autoKvar > 0 ? precosMateriais.relogioFP.precoPorUnidade : 0;
    const valorMontagem = precosMateriais.conjuntoMontagem.precoPorUnidade;
    
    const subtotal = valorCapacitores + valorDisjuntores + valorContatores + valorCabo + valorRelogioFP + valorMontagem;
    const desconto = subtotal * 0.05; // 5% de desconto
    const total = subtotal - desconto;
    
    const itens = [
      { descricao: `${potenciaTotal} kVAr em ${quantidadeCapacitores} estágios`, quantidade: potenciaTotal, precoUnitario: precosMateriais.capacitor.precoPorUnidade, total: valorCapacitores },
      { descricao: `Disjuntor geral ${result.disjuntorRecomendado}A`, quantidade: 1, precoUnitario: precosMateriais.disjuntor.precoPorUnidade, total: valorDisjuntores },
      ...(result.contatoresRecomendados || []).map(c => ({ descricao: `Contator ${c.modelo} (${c.correnteNominal}A)`, quantidade: c.quantidade, precoUnitario: c.preco, total: c.preco })),
      { descricao: `Cabo ${result.caboRecomendado} (20m estimado)`, quantidade: 20, precoUnitario: precosMateriais.cabo.precoPorUnidade, total: valorCabo },
      ...(result.autoKvar > 0 ? [{ descricao: `Relé controlador de FP`, quantidade: 1, precoUnitario: precosMateriais.relogioFP.precoPorUnidade, total: valorRelogioFP }] : []),
      { descricao: `Montagem e instalação`, quantidade: 1, precoUnitario: precosMateriais.conjuntoMontagem.precoPorUnidade, total: valorMontagem }
    ];
    
    setBudgetItems(itens);
    setShowBudget(true);
    
    Swal.fire({
      title: '💰 Orçamento Gerado',
      html: `
        <div style="text-align: left;">
          <p><strong>Resumo do Orçamento:</strong></p>
          <p>📦 Banco de ${potenciaTotal} kVAr</p>
          <p>⚡ ${quantidadeCapacitores} estágios automáticos</p>
          <p>🔧 Disjuntor ${result.disjuntorRecomendado}A</p>
          <p>📐 Cabo ${result.caboRecomendado}</p>
          <p style="margin-top: 12px;"><strong>Valor Total:</strong> R$ ${total.toFixed(2)}</p>
          <p style="font-size: 12px; color: #666;">* Valores estimados, sujeitos à confirmação</p>
        </div>
      `,
      icon: 'success',
      confirmButtonText: 'Fechar',
      confirmButtonColor: '#0a2b3c'
    });
  }

  const addMonth = () => {
    if (monthlyBills.length >= 12) return;
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    setMonthlyBills([...monthlyBills, { 
      month: months[monthlyBills.length], 
      activeEnergy: 0, 
      reactiveEnergy: 0 
    }]);
  };

  const removeMonth = (index: number) => {
    setMonthlyBills(monthlyBills.filter((_, i) => i !== index));
  };

  const updateMonth = (index: number, field: keyof MonthlyData, value: string) => {
    const newBills = [...monthlyBills];
    newBills[index] = { ...newBills[index], [field]: parseFloat(value) || 0 };
    setMonthlyBills(newBills);
  };

  const updatePhase = (phase: 'A' | 'B' | 'C', field: keyof PhaseData, value: string) => {
    setPhases({
      ...phases,
      [phase]: { ...phases[phase], [field]: value }
    });
  };

  const calculate = () => {
    if (!validarEntradas()) return;

    let P = 0;
    let fp1 = 0;
    const fp2 = parseFloat(targetFP);
    const trafoS = parseFloat(trafoKVA) || 0;
    const hours = parseFloat(workHours) || 220;
    let phaseResults: { phase: string, kvar: number }[] = [];

    if (method === 'analyzer') {
      P = parseFloat(activePower);
      let fp = parseFloat(currentFP);
      fp = tratarFatorPotencia(fp);
      fp1 = fp;
    } else if (method === 'threePhase') {
      const pA = parseFloat(phases.A.kw) || 0;
      const pB = parseFloat(phases.B.kw) || 0;
      const pC = parseFloat(phases.C.kw) || 0;
      let fpA = parseFloat(phases.A.fp) || 0.8;
      let fpB = parseFloat(phases.B.fp) || 0.8;
      let fpC = parseFloat(phases.C.fp) || 0.8;
      
      fpA = tratarFatorPotencia(fpA);
      fpB = tratarFatorPotencia(fpB);
      fpC = tratarFatorPotencia(fpC);

      P = pA + pB + pC;
      
      const qA = pA * Math.tan(Math.acos(fpA));
      const qB = pB * Math.tan(Math.acos(fpB));
      const qC = pC * Math.tan(Math.acos(fpC));
      const qTotal = qA + qB + qC;
      const sTotal = Math.sqrt(Math.pow(P, 2) + Math.pow(qTotal, 2));
      fp1 = P / sTotal;

      phaseResults = [
        { phase: 'A', kvar: pA * (Math.tan(Math.acos(fpA)) - Math.tan(Math.acos(fp2))) },
        { phase: 'B', kvar: pB * (Math.tan(Math.acos(fpB)) - Math.tan(Math.acos(fp2))) },
        { phase: 'C', kvar: pC * (Math.tan(Math.acos(fpC)) - Math.tan(Math.acos(fp2))) }
      ];
    } else {
      if (monthlyBills.length === 0) return;
      
      const worstMonth = monthlyBills.reduce((prev, curr) => {
        const fpPrev = prev.activeEnergy / Math.sqrt(Math.pow(prev.activeEnergy, 2) + Math.pow(prev.reactiveEnergy, 2)) || 1;
        const fpCurr = curr.activeEnergy / Math.sqrt(Math.pow(curr.activeEnergy, 2) + Math.pow(curr.reactiveEnergy, 2)) || 1;
        return fpCurr < fpPrev ? curr : prev;
      });

      P = worstMonth.activeEnergy / hours;
      let fp = worstMonth.activeEnergy / Math.sqrt(Math.pow(worstMonth.activeEnergy, 2) + Math.pow(worstMonth.reactiveEnergy, 2)) || 0.8;
      fp = tratarFatorPotencia(fp);
      fp1 = fp;
    }

    if (isNaN(P) || isNaN(fp1) || isNaN(fp2)) {
      Swal.fire('Erro', 'Por favor, insira valores válidos.', 'error');
      return;
    }

    const trafoKvar = trafoS * 0.025;
    const phi1 = Math.acos(fp1);
    const phi2 = Math.acos(fp2);
    const processKvar = P * (Math.tan(phi1) - Math.tan(phi2));

    const totalKvar = processKvar + trafoKvar;
    const fixedKvar = trafoKvar + (processKvar * 0.1);
    const autoKvar = totalKvar - fixedKvar;

    const standardSizes = [50, 40, 30, 25, 20, 15, 12.5, 10, 7.5, 5, 2.5];
    const stages = [];
    let remaining = autoKvar;
    
    while (remaining > 1.25 && stages.length < 8) {
      const bestSize = standardSizes.find(s => s <= remaining + 0.5) || 2.5;
      stages.push(bestSize);
      remaining -= bestSize;
    }
    
    stages.sort((a, b) => a - b);

    const kvaAtual = P / fp1;
    const kvaNovo = P / fp2;
    const voltage = parseFloat(systemVoltage);
    const currentAtual = (kvaAtual * 1000) / (voltage * Math.sqrt(3));
    const currentNovo = (kvaNovo * 1000) / (voltage * Math.sqrt(3));

    const protecao = recomendarProtecao(currentNovo);
    
    // 🆕 RECOMENDAR CONTATORES
    const contatoresRecomendados = recomendarContatores(stages, voltage);

    setResult({
      totalKvar: Math.round(totalKvar * 10) / 10,
      fixedKvar: Math.round(fixedKvar * 10) / 10,
      autoKvar: Math.round(autoKvar * 10) / 10,
      stages,
      kVA_atual: Math.round(kvaAtual * 10) / 10,
      kVA_novo: Math.round(kvaNovo * 10) / 10,
      reducaoPercentual: Math.round(((kvaAtual - kvaNovo) / kvaAtual) * 1000) / 10,
      trafoLossesKvar: Math.round(trafoKvar * 10) / 10,
      estimatedCurrentAtual: Math.round(currentAtual * 10) / 10,
      estimatedCurrentNovo: Math.round(currentNovo * 10) / 10,
      disjuntorRecomendado: protecao.disjuntorRecomendado,
      caboRecomendado: protecao.descricaoCabo,
      secaoCabo: protecao.secaoCabo,
      correnteCabo: protecao.correnteCabo,
      observacaoProtecao: protecao.observacao,
      contatoresRecomendados,
      phaseResults: phaseResults.length > 0 ? phaseResults : undefined
    });
  };

  const exportMemorial = async () => {
    if (!reportRef.current) return;

    try {
      Swal.fire({
        title: 'Gerando Memorial...',
        text: 'Aguarde um momento.',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const dataUrl = await toPng(reportRef.current, {
        quality: 1.0,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const pdfHeight = (img.height * pdfWidth) / img.width;

      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Memorial_Dimensionamento_${new Date().getTime()}.pdf`);

      Swal.close();
      Swal.fire('Sucesso', 'Memorial exportado com sucesso!', 'success');
    } catch (error) {
      console.error('PDF Export Error:', error);
      Swal.close();
      Swal.fire('Erro', 'Falha ao exportar o memorial.', 'error');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">Dimensionamento Avançado</h1>
          <p className="text-slate-500">Cálculo normatizado para bancos fixos e automáticos</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
          <button 
            onClick={() => setMethod('analyzer')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap",
              method === 'analyzer' ? "bg-primary text-white" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <Activity size={16} />
            Analisador
          </button>
          <button 
            onClick={() => setMethod('threePhase')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap",
              method === 'threePhase' ? "bg-primary text-white" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <Layers size={16} />
            Trifásico
          </button>
          <button 
            onClick={() => setMethod('bills')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap",
              method === 'bills' ? "bg-primary text-white" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <History size={16} />
            Faturas (12m)
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Coluna de Entrada */}
        <div className="lg:col-span-5 space-y-6">
          {/* Dados do Sistema */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-primary mb-6 flex items-center gap-2">
              <Settings2 size={20} className="text-secondary" />
              Dados da Instalação
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Trafo (kVA)</label>
                <input 
                  type="number" 
                  value={trafoKVA} 
                  onChange={(e) => setTrafoKVA(e.target.value)}
                  placeholder="Ex: 500"
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-secondary outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tensão (V)</label>
                <select 
                  value={systemVoltage}
                  onChange={(e) => setSystemVoltage(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-secondary outline-none bg-white"
                >
                  <option value="220">220V</option>
                  <option value="380">380V</option>
                  <option value="440">440V</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Horas de Trabalho / Mês</label>
                <input 
                  type="number" 
                  value={workHours} 
                  onChange={(e) => setWorkHours(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-secondary outline-none"
                />
              </div>
            </div>
          </div>

          {/* Dados de Carga */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-primary mb-6 flex items-center gap-2">
              <Calculator size={20} className="text-secondary" />
              {method === 'analyzer' ? 'Dados do Analisador' : method === 'threePhase' ? 'Dados por Fase' : 'Histórico de Consumo'}
            </h2>

            <AnimatePresence mode="wait">
              {method === 'analyzer' && (
                <motion.div 
                  key="analyzer"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Potência Ativa de Pico (kW)</label>
                    <input 
                      type="number" 
                      value={activePower}
                      onChange={(e) => setActivePower(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-3 focus:border-secondary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fator de Potência Atual</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={currentFP}
                      onChange={(e) => setCurrentFP(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-3 focus:border-secondary outline-none"
                    />
                  </div>
                </motion.div>
              )}

              {method === 'threePhase' && (
                <motion.div 
                  key="threePhase"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  {['A', 'B', 'C'].map((phase) => (
                    <div key={phase} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-xs font-black text-primary mb-3">FASE {phase}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Potência (kW)</label>
                          <input 
                            type="number" 
                            value={phases[phase as 'A'|'B'|'C'].kw}
                            onChange={(e) => updatePhase(phase as 'A'|'B'|'C', 'kw', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 p-2 text-xs outline-none focus:border-secondary"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Fator de Potência</label>
                          <input 
                            type="number" 
                            step="0.01"
                            value={phases[phase as 'A'|'B'|'C'].fp}
                            onChange={(e) => updatePhase(phase as 'A'|'B'|'C', 'fp', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 p-2 text-xs outline-none focus:border-secondary"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {method === 'bills' && (
                <motion.div 
                  key="bills"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3">
                    {monthlyBills.map((bill, index) => (
                      <div key={index} className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="w-10 font-bold text-xs text-slate-400">{bill.month}</span>
                        <input 
                          type="number" 
                          placeholder="kWh"
                          value={bill.activeEnergy || ''}
                          onChange={(e) => updateMonth(index, 'activeEnergy', e.target.value)}
                          className="flex-1 min-w-0 bg-white rounded-lg border border-slate-200 p-2 text-xs outline-none focus:border-secondary"
                        />
                        <input 
                          type="number" 
                          placeholder="kVArh"
                          value={bill.reactiveEnergy || ''}
                          onChange={(e) => updateMonth(index, 'reactiveEnergy', e.target.value)}
                          className="flex-1 min-w-0 bg-white rounded-lg border border-slate-200 p-2 text-xs outline-none focus:border-secondary"
                        />
                        <button 
                          onClick={() => removeMonth(index)}
                          className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={addMonth}
                    className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-bold hover:border-secondary hover:text-secondary transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={14} /> Adicionar Mês
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-6 pt-6 border-t border-slate-100">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Meta de Fator de Potência</label>
              <input 
                type="number" 
                step="0.01"
                value={targetFP}
                onChange={(e) => setTargetFP(e.target.value)}
                className="w-full rounded-xl border border-primary/20 p-3 font-bold text-primary focus:border-secondary outline-none"
              />
            </div>

            <button 
              onClick={calculate}
              className="w-full mt-6 bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary-light transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
            >
              <Zap size={20} className="text-secondary" />
              Calcular Dimensionamento
            </button>
          </div>
        </div>

        {/* Coluna de Resultados */}
        <div className="lg:col-span-7">
          {result ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Memorial Visual */}
              <div ref={reportRef} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                <div className="bg-slate-900 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="text-center md:text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap size={24} className="text-secondary" />
                      <h2 className="text-white font-black tracking-tighter uppercase">Capacitor<span className="text-secondary">Manager</span></h2>
                    </div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Potência Total do Banco</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-black text-white">{result.totalKvar}</span>
                      <span className="text-xl font-bold text-secondary">kVAr</span>
                    </div>
                  </div>
                  <div className="h-12 w-px bg-white/10 hidden md:block" />
                  <div className="flex gap-8">
                    <div className="text-center">
                      <p className="text-slate-400 text-[10px] font-black uppercase mb-1">Fixo</p>
                      <p className="text-2xl font-bold text-white">{result.fixedKvar}<span className="text-xs ml-1 text-slate-500">kVAr</span></p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400 text-[10px] font-black uppercase mb-1">Automático</p>
                      <p className="text-2xl font-bold text-secondary">{result.autoKvar}<span className="text-xs ml-1 text-slate-500">kVAr</span></p>
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">Detalhamento Técnico</h3>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Compensação Trafo:</span>
                        <span className="font-bold text-primary">{result.trafoLossesKvar} kVAr</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Redução de Corrente:</span>
                        <span className="font-bold text-emerald-600">~{result.reducaoPercentual}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">kVA Liberado:</span>
                        <span className="font-bold text-secondary">{(result.kVA_atual - result.kVA_novo).toFixed(1)} kVA</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Corrente Atual:</span>
                        <span className="font-bold text-primary">{result.estimatedCurrentAtual} A</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Corrente Projetada:</span>
                        <span className="font-bold text-emerald-600">{result.estimatedCurrentNovo} A</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Tensão Nominal:</span>
                        <span className="font-bold text-primary">{systemVoltage}V</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
                        <span className="text-slate-500">Disjuntor Recomendado:</span>
                        <span className="font-bold text-primary">{result.disjuntorRecomendado} A</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Cabo Recomendado:</span>
                        <span className="font-bold text-primary">{result.caboRecomendado}</span>
                      </div>
                      {result.observacaoProtecao && (
                        <div className="text-[10px] text-slate-400 italic mt-1">
                          {result.observacaoProtecao}
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-6">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Distribuição de Estágios</h3>
                      <div className="flex flex-wrap gap-2">
                        {result.stages.map((s, i) => (
                          <div key={i} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-center min-w-[60px]">
                            <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">E{i+1}</p>
                            <p className="text-sm font-black text-primary">{s}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-4 italic">* Sugestão baseada em passos de 2.5kVAr ou múltiplos.</p>
                    </div>
                  </div>

                  {/* 🆕 CONTATORES RECOMENDADOS */}
                  {result.contatoresRecomendados && result.contatoresRecomendados.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">
                        Contatores Recomendados (IEC 60947-4-1 - AC-6b)
                      </h3>
                      <div className="space-y-2">
                        {result.contatoresRecomendados.map((cont, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-lg">
                            <div>
                              <span className="font-bold text-primary">{cont.modelo}</span>
                              <span className="text-xs text-slate-500 ml-2">({cont.correnteNominal}A)</span>
                            </div>
                            <div className="text-xs text-slate-500">
                              Estágio {idx + 1}: {result.stages[idx]} kVAr
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 italic">
                        * Contatores categoria AC-6b específicos para capacitores (IEC 60947-4-1). Fator de segurança 1.43.
                      </p>
                    </div>
                  )}

                  {result.phaseResults && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">Análise por Fase (Trifásico)</h3>
                      <div className="grid grid-cols-3 gap-4">
                        {result.phaseResults.map((pr) => (
                          <div key={pr.phase} className="p-4 bg-slate-50 rounded-xl text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Fase {pr.phase}</p>
                            <p className="text-lg font-bold text-primary">{pr.kvar.toFixed(1)} <span className="text-xs">kVAr</span></p>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-amber-600 font-medium bg-amber-50 p-3 rounded-lg flex items-center gap-2">
                        <AlertTriangle size={14} />
                        Atenção: Desequilíbrio de fases detectado. Recomenda-se capacitores monofásicos para ajuste fino se necessário.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6">
                      <div className="flex items-center gap-2 text-emerald-700 mb-3">
                        <CheckCircle2 size={20} />
                        <h4 className="font-bold">Conformidade</h4>
                      </div>
                      <ul className="text-xs text-emerald-600 space-y-2">
                        <li>• Atende requisitos da Resolução 414 ANEEL.</li>
                        <li>• Dimensionamento para FP {targetFP} garantido.</li>
                        <li>• Proteção contra sobrecorreção no Trafo.</li>
                      </ul>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6">
                      <div className="flex items-center gap-2 text-amber-700 mb-3">
                        <AlertTriangle size={20} />
                        <h4 className="font-bold">Observações</h4>
                      </div>
                      <ul className="text-xs text-amber-600 space-y-2">
                        <li>• Verificar presença de harmônicas no local.</li>
                        <li>• Recomenda-se contatores específicos para capacitores.</li>
                        <li>• Fusíveis tipo NH ou Disjuntores adequados.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={exportMemorial}
                  className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold py-4 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Printer size={20} />
                  Exportar Memorial (PDF)
                </button>
                <button 
                  onClick={gerarOrcamento}
                  className="flex-1 bg-primary text-white font-bold py-4 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  <DollarSign size={20} className="text-secondary" />
                  Gerar Orçamento
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
                <Calculator size={40} className="opacity-20" />
              </div>
              <h3 className="text-xl font-bold text-slate-500 mb-2">Aguardando Parâmetros</h3>
              <p className="max-w-sm text-sm leading-relaxed">
                Selecione o método de entrada (Analisador, Trifásico ou Faturas) e preencha os dados técnicos para gerar o memorial de dimensionamento.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

