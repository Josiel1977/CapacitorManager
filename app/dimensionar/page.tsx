'use client';

import React, { useState, useRef } from 'react';
import { 
  Calculator, Zap, TrendingUp, DollarSign, CheckCircle2, 
  FileText, Loader2, AlertTriangle, Package, History,
  Calendar, Download, Printer, Activity, Layers, Edit3, Save
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

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
// COMPONENTE PRINCIPAL
// ============================================
export default function DimensionarPage() {
  const reportRef = useRef<HTMLDivElement>(null);
  
  // Estado dos transformadores
  const [transformadores, setTransformadores] = useState([
    { potencia: 225, quantidade: 7 },
    { potencia: 75, quantidade: 1 }
  ]);
  
  // DADOS DA FATURA - EDITÁVEIS PELO USUÁRIO
  const [faturaData, setFaturaData] = useState({
    mesReferencia: '07/2025',
    consumoAtivoPonta: 5811,
    consumoAtivoForaPonta: 50092,
    demandaPonta: 348,
    energiaReativaExcPonta: 741,
    energiaReativaExcForaPonta: 4851,
    totalPagar: 46336.47
  });
  
  const [targetFP, setTargetFP] = useState<number>(0.92);
  const [result, setResult] = useState<any>(null);
  const [calculando, setCalculando] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const potenciaTotalTransformadores = transformadores.reduce((acc, t) => acc + (t.potencia * t.quantidade), 0);

  const updateFaturaField = (field: string, value: number | string) => {
    setFaturaData(prev => ({ ...prev, [field]: value }));
  };

  const updateTransformador = (index: number, field: 'potencia' | 'quantidade', value: number) => {
    const novos = [...transformadores];
    novos[index][field] = value;
    setTransformadores(novos);
  };

  const addTransformador = () => {
    setTransformadores([...transformadores, { potencia: 100, quantidade: 1 }]);
  };

  const removeTransformador = (index: number) => {
    setTransformadores(transformadores.filter((_, i) => i !== index));
  };

  const recomendarProtecao = (correnteNominal: number) => {
    const candidato = tabelaCondutores.find(c => c.iz >= correnteNominal);
    if (!candidato) {
      return {
        disjuntorRecomendado: Math.ceil(correnteNominal * 1.3),
        secaoCabo: 300,
        descricaoCabo: "Consultar engenheiro"
      };
    }
    return {
      disjuntorRecomendado: candidato.disjuntor,
      secaoCabo: candidato.secao,
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
        preco: contator.preco
      };
    });
  };

  const calcularDimensionamento = () => {
    setCalculando(true);
    
    try {
      const consumoTotal = faturaData.consumoAtivoPonta + faturaData.consumoAtivoForaPonta;
      const potenciaMedia = consumoTotal / 220;
      const energiaReativaTotal = faturaData.energiaReativaExcPonta + faturaData.energiaReativaExcForaPonta;
      const fpAtual = consumoTotal > 0 ? consumoTotal / Math.sqrt(Math.pow(consumoTotal, 2) + Math.pow(energiaReativaTotal, 2)) : 0.8;
      
      const phi1 = Math.acos(fpAtual);
      const phi2 = Math.acos(targetFP);
      const kvarProcesso = potenciaMedia * (Math.tan(phi1) - Math.tan(phi2));
      const kvarTrafo = potenciaTotalTransformadores * 0.025;
      let totalKvar = Math.ceil((kvarProcesso + kvarTrafo) / 5) * 5;
      
      // Distribuição inteligente dos estágios
      const stages = [];
      let restante = totalKvar;
      
      // Prioriza estágios de 60 kVAr para os transformadores de 225 kVA
      const qtdTrafo225 = transformadores.find(t => t.potencia === 225)?.quantidade || 7;
      for (let i = 0; i < qtdTrafo225 && restante >= 60; i++) {
        stages.push(60);
        restante -= 60;
      }
      
      // Adiciona estágio de 30 kVAr se necessário
      if (restante >= 30) {
        stages.push(30);
        restante -= 30;
      }
      
      // Ajusta o restante com estágios menores
      const sizes = [20, 15, 10, 5];
      for (const size of sizes) {
        while (restante >= size) {
          stages.push(size);
          restante -= size;
        }
      }
      
      stages.sort((a, b) => a - b);
      
      const voltage = 380;
      const currentNovo = (totalKvar * 1000) / (voltage * Math.sqrt(3));
      const protecao = recomendarProtecao(currentNovo);
      const contatoresRecomendados = recomendarContatores(stages, voltage);
      
      // Cálculo da multa atual
      const multaAtual = (faturaData.energiaReativaExcPonta + faturaData.energiaReativaExcForaPonta) * 0.382537;
      const economiaMensal = multaAtual * 0.95;
      const investimentoEstimado = totalKvar * 89.90 + 2000;
      const paybackMeses = economiaMensal > 0 ? Math.ceil(investimentoEstimado / economiaMensal) : 0;
      
      setResult({
        totalKvar,
        stages,
        economiaMensal,
        investimentoEstimado,
        paybackMeses,
        fpAtual: fpAtual * 100,
        fpProjetado: targetFP * 100,
        disjuntorRecomendado: protecao.disjuntorRecomendado,
        caboRecomendado: protecao.descricaoCabo,
        contatoresRecomendados,
        multaAtual,
        consumoTotal,
        energiaReativaTotal,
        fpAtualDecimal: fpAtual
      });
      
      Swal.fire({
        title: '✅ Dimensionamento Concluído!',
        html: `<div class="text-left">
          <p><strong>📊 Dados da Fatura:</strong></p>
          <p>Consumo: ${consumoTotal.toLocaleString()} kWh</p>
          <p>Demanda: ${faturaData.demandaPonta} kW</p>
          <p>Multa por Reativo: <strong class="text-red-600">R$ ${multaAtual.toFixed(2)}</strong></p>
          <hr class="my-3">
          <p><strong>🎯 Banco de capacitores: ${totalKvar} kVAr</strong></p>
          <p>FP atual: ${(fpAtual * 100).toFixed(1)}% → FP projetado: ${(targetFP * 100).toFixed(0)}%</p>
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

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-primary">Dimensionamento de Banco de Capacitores</h1>
        <p className="text-slate-500 mt-2">Informe os dados da fatura para análise personalizada</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          {/* Dados da Fatura - EDITÁVEIS */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                <FileText size={20} className="text-secondary" />
                Dados da Fatura
              </h2>
              <button
                onClick={() => setEditMode(!editMode)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Edit3 size={12} /> {editMode ? 'Ocultar' : 'Editar'}
              </button>
            </div>
            
            {editMode ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">Mês/Ano</label>
                  <input type="text" value={faturaData.mesReferencia} onChange={(e) => updateFaturaField('mesReferencia', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium text-slate-500">Consumo Ponta (kWh)</label><input type="number" value={faturaData.consumoAtivoPonta} onChange={(e) => updateFaturaField('consumoAtivoPonta', parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 p-2 text-sm" /></div>
                  <div><label className="text-xs font-medium text-slate-500">Consumo Fora Ponta (kWh)</label><input type="number" value={faturaData.consumoAtivoForaPonta} onChange={(e) => updateFaturaField('consumoAtivoForaPonta', parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 p-2 text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium text-slate-500">Demanda (kW)</label><input type="number" value={faturaData.demandaPonta} onChange={(e) => updateFaturaField('demandaPonta', parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 p-2 text-sm" /></div>
                  <div><label className="text-xs font-medium text-slate-500">Total (R$)</label><input type="number" step="0.01" value={faturaData.totalPagar} onChange={(e) => updateFaturaField('totalPagar', parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 p-2 text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium text-slate-500">Reativo Ponta (kVArh)</label><input type="number" value={faturaData.energiaReativaExcPonta} onChange={(e) => updateFaturaField('energiaReativaExcPonta', parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 p-2 text-sm" /></div>
                  <div><label className="text-xs font-medium text-slate-500">Reativo Fora Ponta (kVArh)</label><input type="number" value={faturaData.energiaReativaExcForaPonta} onChange={(e) => updateFaturaField('energiaReativaExcForaPonta', parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 p-2 text-sm" /></div>
                </div>
              </div>
            ) : (
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between"><span>Mês:</span><strong>{faturaData.mesReferencia}</strong></div>
                  <div className="flex justify-between"><span>Demanda:</span><strong>{faturaData.demandaPonta} kW</strong></div>
                  <div className="flex justify-between"><span>Consumo Ponta:</span><strong>{faturaData.consumoAtivoPonta.toLocaleString()} kWh</strong></div>
                  <div className="flex justify-between"><span>Consumo Fora Ponta:</span><strong>{faturaData.consumoAtivoForaPonta.toLocaleString()} kWh</strong></div>
                  <div className="flex justify-between"><span>Reativo Ponta:</span><strong>{faturaData.energiaReativaExcPonta.toLocaleString()} kVArh</strong></div>
                  <div className="flex justify-between"><span>Reativo Fora Ponta:</span><strong>{faturaData.energiaReativaExcForaPonta.toLocaleString()} kVArh</strong></div>
                  <div className="flex justify-between col-span-2 pt-2 border-t border-green-200"><span>Total:</span><strong className="text-primary">R$ {faturaData.totalPagar.toLocaleString()}</strong></div>
                </div>
              </div>
            )}
          </div>

          {/* Transformadores - EDITÁVEIS */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
              <Package size={20} className="text-secondary" />
              Transformadores
            </h2>
            <div className="space-y-3">
              {transformadores.map((trafo, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="flex-1 flex gap-2">
                    <div className="flex-1"><label className="text-[8px] font-black text-slate-400 uppercase">Potência (kVA)</label><input type="number" value={trafo.potencia} onChange={(e) => updateTransformador(idx, 'potencia', parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 p-2 text-sm" /></div>
                    <div className="w-20"><label className="text-[8px] font-black text-slate-400 uppercase">Qtde</label><input type="number" value={trafo.quantidade} onChange={(e) => updateTransformador(idx, 'quantidade', parseInt(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 p-2 text-sm" /></div>
                  </div>
                  {transformadores.length > 1 && <button onClick={() => removeTransformador(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>}
                </div>
              ))}
              <button onClick={addTransformador} className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-bold hover:border-secondary hover:text-secondary transition-all flex items-center justify-center gap-2"><Plus size={14} /> Adicionar Transformador</button>
            </div>
            <div className="mt-4 p-3 bg-primary/5 rounded-xl">
              <div className="flex justify-between text-sm"><span>Potência Total:</span><span className="font-bold text-primary">{potenciaTotalTransformadores} kVA</span></div>
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
            <button onClick={calcularDimensionamento} disabled={calculando} className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {calculando ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />} Calcular Dimensionamento
            </button>
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
                    <div className="bg-emerald-50 rounded-xl p-3 text-center"><TrendingUp size={20} className="mx-auto text-emerald-600 mb-1" /><p className="text-xs">FP Atual</p><p className="text-xl font-bold text-emerald-700">{result.fpAtual.toFixed(1)}%</p></div>
                    <div className="bg-primary/10 rounded-xl p-3 text-center"><CheckCircle2 size={20} className="mx-auto text-primary mb-1" /><p className="text-xs">FP Projetado</p><p className="text-xl font-bold text-primary">{result.fpProjetado.toFixed(0)}%</p></div>
                  </div>
                  <div><h3 className="font-bold text-primary mb-2">📦 Distribuição dos Estágios</h3><div className="flex flex-wrap gap-2">{result.stages.map((s: number, i: number) => (<div key={i} className="bg-slate-100 rounded-lg px-3 py-2"><span className="font-bold text-primary">{s} kVAr</span></div>))}</div></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-50 rounded-xl p-4 text-center"><DollarSign size={20} className="mx-auto text-red-600 mb-1" /><p className="text-xs">Multa Atual</p><p className="text-xl font-bold text-red-600">R$ {result.multaAtual.toFixed(2)}</p></div>
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
              <h3 className="text-xl font-bold text-slate-500">Aguardando Cálculo</h3>
              <p className="text-sm text-slate-400 mt-2">Informe os dados da fatura e clique em "Calcular Dimensionamento"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}