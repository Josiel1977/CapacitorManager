'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Calculator, Zap, TrendingUp, DollarSign, CheckCircle2, 
  FileText, Loader2, AlertTriangle, Package, History,
  Calendar, Download, Printer, Activity, Layers, Plus, Trash2,
  Save, Database, BarChart3, TrendingDown, Edit3, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { supabase } from '@/lib/supabase';

// ============================================
// TIPOS
// ============================================
interface Transformador {
  id?: string;
  potencia_kva: number;
  quantidade: number;
  tensao_v: number;
  horas_trabalho: number;
}

interface Fatura {
  id?: string;
  mes_referencia: string;
  consumo_ponta_kwh: number;
  consumo_fora_ponta_kwh: number;
  demanda_kw: number;
  reativo_ponta_kvarh: number;
  reativo_fora_ponta_kvarh: number;
  total_pagar: number;
}

interface ResultadoDimensionamento {
  totalKvar: number;
  stages: number[];
  economiaMensal: number;
  investimentoEstimado: number;
  paybackMeses: number;
  fpAtual: number;
  fpProjetado: number;
  multaAtual: number;
  consumoTotalMedio: number;
  demandaMedia: number;
  piorMes: Fatura | null;
  distribuicaoPorTrafo: { trafoId: number; kvar: number }[];
}

// ============================================
// TABELAS DE REFERÊNCIA
// ============================================
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
// COMPONENTE PRINCIPAL
// ============================================
export default function DimensionarPage() {
  const reportRef = useRef<HTMLDivElement>(null);
  
  // Estados
  const [transformadores, setTransformadores] = useState<Transformador[]>([
    { potencia_kva: 225, quantidade: 7, tensao_v: 380, horas_trabalho: 220 }
  ]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [targetFP, setTargetFP] = useState<number>(0.92);
  const [result, setResult] = useState<ResultadoDimensionamento | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [showFaturaModal, setShowFaturaModal] = useState(false);
  const [currentFatura, setCurrentFatura] = useState<Partial<Fatura>>({});
  const [editandoFatura, setEditandoFatura] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Carregar dados salvos
  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const { data: trafos } = await supabase.from('transformadores').select('*').order('created_at');
      if (trafos && trafos.length > 0) {
        setTransformadores(trafos);
      }
      
      const { data: faturasData } = await supabase.from('faturas').select('*').order('created_at', { ascending: false });
      if (faturasData) {
        setFaturas(faturasData);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setCarregando(false);
    }
  };

  const salvarTransformadores = async () => {
    setSalvando(true);
    try {
      await supabase.from('transformadores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      const { error } = await supabase.from('transformadores').insert(transformadores);
      if (error) throw error;
      Swal.fire('Sucesso', 'Configuração salva!', 'success');
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setSalvando(false);
    }
  };

  const salvarFatura = async () => {
    if (!currentFatura.mes_referencia) {
      Swal.fire('Atenção', 'Informe o mês de referência', 'warning');
      return;
    }
    
    setSalvando(true);
    try {
      if (editandoFatura !== null) {
        const { error } = await supabase
          .from('faturas')
          .update(currentFatura)
          .eq('id', faturas[editandoFatura].id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('faturas').insert([currentFatura]);
        if (error) throw error;
      }
      await carregarDados();
      setShowFaturaModal(false);
      setCurrentFatura({});
      setEditandoFatura(null);
      Swal.fire('Sucesso', 'Fatura salva!', 'success');
    } catch (error) {
      console.error('Erro ao salvar fatura:', error);
    } finally {
      setSalvando(false);
    }
  };

  const removerFatura = async (index: number) => {
    const result = await Swal.fire({
      title: 'Remover fatura?',
      text: 'Esta ação não pode ser desfeita.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e74c3c',
      confirmButtonText: 'Remover'
    });
    
    if (result.isConfirmed) {
      const fatura = faturas[index];
      if (fatura.id) {
        await supabase.from('faturas').delete().eq('id', fatura.id);
        await carregarDados();
      }
    }
  };

  const adicionarTransformador = () => {
    setTransformadores([...transformadores, { potencia_kva: 100, quantidade: 1, tensao_v: 380, horas_trabalho: 220 }]);
  };

  const removerTransformador = (index: number) => {
    if (transformadores.length > 1) {
      setTransformadores(transformadores.filter((_, i) => i !== index));
    }
  };

  const atualizarTransformador = (index: number, field: keyof Transformador, value: number) => {
   const novos = [...transformadores];
   novos[index] = { ...novos[index], [field]: value };
   setTransformadores(novos);
  };

  const potenciaTotalTransformadores = transformadores.reduce((acc, t) => acc + (t.potencia_kva * t.quantidade), 0);

  const calcularDimensionamento = () => {
    if (faturas.length === 0) {
      Swal.fire('Atenção', 'Cadastre pelo menos uma fatura para análise', 'warning');
      return;
    }
    
    setCalculando(true);
    
    try {
      // Calcular FP de cada fatura
      const faturasComFP = faturas.map(f => {
        const consumoTotal = f.consumo_ponta_kwh + f.consumo_fora_ponta_kwh;
        const reativoTotal = f.reativo_ponta_kvarh + f.reativo_fora_ponta_kvarh;
        const fp = consumoTotal > 0 ? consumoTotal / Math.sqrt(Math.pow(consumoTotal, 2) + Math.pow(reativoTotal, 2)) : 0.8;
        const potenciaMedia = consumoTotal / 220;
        return { ...f, fp, potenciaMedia, consumoTotal, reativoTotal };
      });
      
      // Pegar os 3 piores meses (menor FP)
      const pioresFaturas = [...faturasComFP].sort((a, b) => a.fp - b.fp).slice(0, Math.min(3, faturasComFP.length));
      
      // Calcular médias dos piores meses
      const mediaPotencia = pioresFaturas.reduce((acc, f) => acc + f.potenciaMedia, 0) / pioresFaturas.length;
      const mediaFP = pioresFaturas.reduce((acc, f) => acc + f.fp, 0) / pioresFaturas.length;
      const mediaConsumo = pioresFaturas.reduce((acc, f) => acc + f.consumoTotal, 0) / pioresFaturas.length;
      const mediaDemanda = pioresFaturas.reduce((acc, f) => acc + f.demanda_kw, 0) / pioresFaturas.length;
      const piorMes = pioresFaturas[0];
      
      // Cálculo do capacitor necessário
      const phi1 = Math.acos(mediaFP);
      const phi2 = Math.acos(targetFP);
      const kvarProcesso = mediaPotencia * (Math.tan(phi1) - Math.tan(phi2));
      const kvarTrafo = potenciaTotalTransformadores * 0.025;
      let totalKvar = Math.ceil((kvarProcesso + kvarTrafo) / 5) * 5;
      
      // Distribuição dos estágios
      const stages = [];
      let restante = totalKvar;
      
      const qtdTrafo225 = transformadores.filter(t => t.potencia_kva === 225).reduce((acc, t) => acc + t.quantidade, 0);
      for (let i = 0; i < qtdTrafo225 && restante >= 60; i++) {
        stages.push(60);
        restante -= 60;
      }
      
      if (restante >= 30) {
        stages.push(30);
        restante -= 30;
      }
      
      const sizes = [20, 15, 10, 5];
      for (const size of sizes) {
        while (restante >= size) {
          stages.push(size);
          restante -= size;
        }
      }
      stages.sort((a, b) => a - b);
      
      // Distribuição por transformador
      const distribuicaoPorTrafo = transformadores.map((t, idx) => ({
        trafoId: idx,
        kvar: Math.round((totalKvar * (t.potencia_kva * t.quantidade) / potenciaTotalTransformadores) / 5) * 5
      }));
      
      // Multa atual
      const multaAtual = pioresFaturas.reduce((acc, f) => acc + (f.reativo_ponta_kvarh + f.reativo_fora_ponta_kvarh) * 0.382537, 0) / pioresFaturas.length;
      const economiaMensal = multaAtual * 0.95;
      const investimentoEstimado = totalKvar * 89.90 + 2000;
      const paybackMeses = economiaMensal > 0 ? Math.ceil(investimentoEstimado / economiaMensal) : 0;
      
      setResult({
        totalKvar,
        stages,
        economiaMensal,
        investimentoEstimado,
        paybackMeses,
        fpAtual: mediaFP * 100,
        fpProjetado: targetFP * 100,
        multaAtual,
        consumoTotalMedio: mediaConsumo,
        demandaMedia: mediaDemanda,
        piorMes,
        distribuicaoPorTrafo
      });
      
      Swal.fire({
        title: '✅ Dimensionamento Concluído!',
        html: `<div class="text-left">
          <p><strong>📊 Análise de ${faturas.length} faturas:</strong></p>
          <p>Piores ${pioresFaturas.length} meses considerados</p>
          <p>FP médio dos piores meses: ${(mediaFP * 100).toFixed(1)}%</p>
          <hr class="my-3">
          <p><strong>🎯 Banco de capacitores: ${totalKvar} kVAr</strong></p>
          <p>💰 Economia mensal: <strong class="text-green-600">R$ ${economiaMensal.toFixed(2)}</strong></p>
          <p>⏱️ Payback: ${paybackMeses} meses</p>
        </div>`,
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

  if (carregando) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-primary" size={32} /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-primary">Dimensionamento de Banco de Capacitores</h1>
        <p className="text-slate-500 mt-2">Análise de múltiplas faturas + configuração de transformadores</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          {/* Transformadores */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                <Package size={20} className="text-secondary" />
                Transformadores
              </h2>
              <button onClick={salvarTransformadores} disabled={salvando} className="text-xs bg-primary text-white px-3 py-1 rounded-lg hover:bg-primary/90">
                <Save size={12} /> Salvar
              </button>
            </div>
            
            <div className="space-y-3">
              {transformadores.map((trafo, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="flex-1 flex gap-2">
                    <div className="flex-1"><label className="text-[8px] font-black text-slate-400 uppercase">Potência (kVA)</label><input type="number" value={trafo.potencia_kva} onChange={(e) => atualizarTransformador(idx, 'potencia_kva', parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 p-2 text-sm" /></div>
                    <div className="w-20"><label className="text-[8px] font-black text-slate-400 uppercase">Qtde</label><input type="number" value={trafo.quantidade} onChange={(e) => atualizarTransformador(idx, 'quantidade', parseInt(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 p-2 text-sm" /></div>
                    <div className="w-24"><label className="text-[8px] font-black text-slate-400 uppercase">Tensão (V)</label><input type="number" value={trafo.tensao_v} onChange={(e) => atualizarTransformador(idx, 'tensao_v', parseFloat(e.target.value) || 380)} className="w-full rounded-lg border border-slate-200 p-2 text-sm" /></div>
                  </div>
                  {transformadores.length > 1 && <button onClick={() => removerTransformador(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>}
                </div>
              ))}
              <button onClick={adicionarTransformador} className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-bold hover:border-secondary hover:text-secondary transition-all flex items-center justify-center gap-2"><Plus size={14} /> Adicionar Transformador</button>
            </div>
            <div className="mt-4 p-3 bg-primary/5 rounded-xl">
              <div className="flex justify-between text-sm"><span>Potência Total Instalada:</span><span className="font-bold text-primary">{potenciaTotalTransformadores} kVA</span></div>
            </div>
          </div>

          {/* Faturas */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                <History size={20} className="text-secondary" />
                Faturas ({faturas.length})
              </h2>
              <button onClick={() => { setCurrentFatura({}); setEditandoFatura(null); setShowFaturaModal(true); }} className="text-xs bg-primary text-white px-3 py-1 rounded-lg hover:bg-primary/90">
                <Plus size={12} /> Adicionar
              </button>
            </div>
            
            <div className="max-h-80 overflow-y-auto space-y-2">
              {faturas.length === 0 ? (
                <div className="text-center py-8 text-slate-400">Nenhuma fatura cadastrada</div>
              ) : (
                faturas.map((fat, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-primary">{fat.mes_referencia}</span>
                      <div className="flex gap-1">
                        <button onClick={() => { setCurrentFatura(fat); setEditandoFatura(idx); setShowFaturaModal(true); }} className="text-blue-500 hover:text-blue-700"><Edit3 size={14} /></button>
                        <button onClick={() => removerFatura(idx)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs mt-2">
                      <div>Consumo: {(fat.consumo_ponta_kwh + fat.consumo_fora_ponta_kwh).toLocaleString()} kWh</div>
                      <div>Demanda: {fat.demanda_kw} kW</div>
                      <div>Reativo: {(fat.reativo_ponta_kvarh + fat.reativo_fora_ponta_kvarh).toLocaleString()} kVArh</div>
                      <div>Total: R$ {fat.total_pagar.toLocaleString()}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Parâmetros */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-2">Fator de Potência Desejado</label>
            <select value={targetFP} onChange={(e) => setTargetFP(parseFloat(e.target.value))} className="w-full rounded-xl border border-slate-200 p-3 mb-6">
              <option value={0.92}>0.92 (mínimo regulamentar)</option>
              <option value={0.95}>0.95 (recomendado)</option>
              <option value={0.98}>0.98 (excelente)</option>
            </select>
            <button onClick={calcularDimensionamento} disabled={calculando || faturas.length === 0} className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {calculando ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />} Calcular Dimensionamento
            </button>
            {faturas.length === 0 && <p className="text-xs text-amber-600 mt-2 text-center">⚠️ Cadastre pelo menos uma fatura</p>}
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
                    <p className="text-xs text-slate-400 mt-1">Distribuição: {result.stages.length} estágios</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50 rounded-xl p-3 text-center"><TrendingUp size={20} className="mx-auto text-emerald-600 mb-1" /><p className="text-xs">FP Médio (piores meses)</p><p className="text-xl font-bold text-emerald-700">{result.fpAtual.toFixed(1)}%</p></div>
                    <div className="bg-primary/10 rounded-xl p-3 text-center"><CheckCircle2 size={20} className="mx-auto text-primary mb-1" /><p className="text-xs">FP Projetado</p><p className="text-xl font-bold text-primary">{result.fpProjetado.toFixed(0)}%</p></div>
                  </div>
                  {result.piorMes && (
                    <div className="bg-amber-50 rounded-xl p-3">
                      <p className="text-xs font-bold text-amber-700 mb-1">⚠️ Pior Mês Analisado</p>
                      <p className="text-sm">{result.piorMes.mes_referencia} - FP: {(result.piorMes.fp * 100).toFixed(1)}%</p>
                    </div>
                  )}
                  <div><h3 className="font-bold text-primary mb-2">📦 Distribuição dos Estágios</h3><div className="flex flex-wrap gap-2">{result.stages.map((s, i) => (<div key={i} className="bg-slate-100 rounded-lg px-3 py-2"><span className="font-bold text-primary">{s} kVAr</span></div>))}</div></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-50 rounded-xl p-4 text-center"><DollarSign size={20} className="mx-auto text-red-600 mb-1" /><p className="text-xs">Multa Média Mensal</p><p className="text-xl font-bold text-red-600">R$ {result.multaAtual.toFixed(2)}</p></div>
                    <div className="bg-green-50 rounded-xl p-4 text-center"><DollarSign size={20} className="mx-auto text-green-600 mb-1" /><p className="text-xs">Economia Mensal</p><p className="text-xl font-bold text-green-700">R$ {result.economiaMensal.toFixed(2)}</p></div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 text-center"><p className="text-sm text-slate-500">⏱️ Payback Estimado</p><p className="text-2xl font-bold text-primary">{result.paybackMeses} meses</p><p className="text-xs text-slate-400">(~{(result.paybackMeses / 12).toFixed(1)} anos)</p></div>
                </div>
              </div>
              <div className="flex gap-4"><button onClick={exportMemorial} className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50 flex items-center justify-center gap-2"><Printer size={18} /> Exportar PDF</button></div>
            </motion.div>
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <Calculator size={64} className="text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-500">Aguardando Dados</h3>
              <p className="text-sm text-slate-400 mt-2">Configure os transformadores, cadastre as faturas e clique em "Calcular Dimensionamento"</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal para adicionar/editar fatura */}
      <AnimatePresence>
        {showFaturaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-primary">{editandoFatura !== null ? 'Editar Fatura' : 'Nova Fatura'}</h3><button onClick={() => setShowFaturaModal(false)}><X size={20} /></button></div>
              <div className="space-y-3">
                <div><label className="text-sm font-medium">Mês/Ano</label><input type="text" placeholder="Ex: 07/2025" value={currentFatura.mes_referencia || ''} onChange={(e) => setCurrentFatura({...currentFatura, mes_referencia: e.target.value})} className="w-full rounded-lg border p-2" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs">Consumo Ponta (kWh)</label><input type="number" value={currentFatura.consumo_ponta_kwh || ''} onChange={(e) => setCurrentFatura({...currentFatura, consumo_ponta_kwh: parseFloat(e.target.value) || 0})} className="w-full rounded-lg border p-2" /></div>
                  <div><label className="text-xs">Consumo Fora Ponta (kWh)</label><input type="number" value={currentFatura.consumo_fora_ponta_kwh || ''} onChange={(e) => setCurrentFatura({...currentFatura, consumo_fora_ponta_kwh: parseFloat(e.target.value) || 0})} className="w-full rounded-lg border p-2" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs">Demanda (kW)</label><input type="number" value={currentFatura.demanda_kw || ''} onChange={(e) => setCurrentFatura({...currentFatura, demanda_kw: parseFloat(e.target.value) || 0})} className="w-full rounded-lg border p-2" /></div>
                  <div><label className="text-xs">Total (R$)</label><input type="number" step="0.01" value={currentFatura.total_pagar || ''} onChange={(e) => setCurrentFatura({...currentFatura, total_pagar: parseFloat(e.target.value) || 0})} className="w-full rounded-lg border p-2" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs">Reativo Ponta (kVArh)</label><input type="number" value={currentFatura.reativo_ponta_kvarh || ''} onChange={(e) => setCurrentFatura({...currentFatura, reativo_ponta_kvarh: parseFloat(e.target.value) || 0})} className="w-full rounded-lg border p-2" /></div>
                  <div><label className="text-xs">Reativo Fora Ponta (kVArh)</label><input type="number" value={currentFatura.reativo_fora_ponta_kvarh || ''} onChange={(e) => setCurrentFatura({...currentFatura, reativo_fora_ponta_kvarh: parseFloat(e.target.value) || 0})} className="w-full rounded-lg border p-2" /></div>
                </div>
              </div>
              <div className="flex gap-3 mt-6"><button onClick={() => setShowFaturaModal(false)} className="flex-1 py-2 border rounded-lg">Cancelar</button><button onClick={salvarFatura} disabled={salvando} className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">Salvar</button></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}