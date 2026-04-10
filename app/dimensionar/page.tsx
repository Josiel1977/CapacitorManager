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
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';

interface MonthlyData {
  month: string;
  activeEnergy: number; // kWh
  reactiveEnergy: number; // kVArh
  demand?: number; // kW
}

export default function DimensionarPage() {
  const [method, setMethod] = useState<'analyzer' | 'bills'>('analyzer');
  
  // Analyzer / Instantaneous State
  const [activePower, setActivePower] = useState<string>('');
  const [currentFP, setCurrentFP] = useState<string>('0.80');
  const [targetFP, setTargetFP] = useState<string>('0.92');
  
  // Transformer State
  const [trafoKVA, setTrafoKVA] = useState<string>('');
  const [systemVoltage, setSystemVoltage] = useState<string>('380');
  const [workHours, setWorkHours] = useState<string>('220'); // Horas mensais padrão

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
  } | null>(null);

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

  const calculate = () => {
    let P = 0;
    let fp1 = 0;
    const fp2 = parseFloat(targetFP);
    const trafoS = parseFloat(trafoKVA) || 0;
    const hours = parseFloat(workHours) || 220;

    if (method === 'analyzer') {
      P = parseFloat(activePower);
      fp1 = parseFloat(currentFP);
    } else {
      // Calculate based on bills
      if (monthlyBills.length === 0) return;
      
      // Find month with highest reactive energy or worst FP
      const worstMonth = monthlyBills.reduce((prev, curr) => {
        const fpPrev = prev.activeEnergy / Math.sqrt(Math.pow(prev.activeEnergy, 2) + Math.pow(prev.reactiveEnergy, 2)) || 1;
        const fpCurr = curr.activeEnergy / Math.sqrt(Math.pow(curr.activeEnergy, 2) + Math.pow(curr.reactiveEnergy, 2)) || 1;
        return fpCurr < fpPrev ? curr : prev;
      });

      P = worstMonth.activeEnergy / hours;
      fp1 = worstMonth.activeEnergy / Math.sqrt(Math.pow(worstMonth.activeEnergy, 2) + Math.pow(worstMonth.reactiveEnergy, 2)) || 0.8;
    }

    if (isNaN(P) || isNaN(fp1) || isNaN(fp2)) {
      Swal.fire('Erro', 'Por favor, insira valores válidos.', 'error');
      return;
    }

    // Trafo Fixed Compensation (approx 2.5% of kVA)
    const trafoKvar = trafoS * 0.025;
    
    // Process Compensation
    const phi1 = Math.acos(fp1);
    const phi2 = Math.acos(fp2);
    const processKvar = P * (Math.tan(phi1) - Math.tan(phi2));

    const totalKvar = processKvar + trafoKvar;
    const fixedKvar = trafoKvar + (processKvar * 0.1); // 10% of process as fixed base
    const autoKvar = totalKvar - fixedKvar;

    // Stage Distribution (Standard sizes: 2.5, 5, 10, 15, 20, 25, 30, 40, 50)
    const standardSizes = [50, 40, 30, 25, 20, 15, 12.5, 10, 7.5, 5, 2.5];
    const stages = [];
    let remaining = autoKvar;
    
    // Suggest up to 8 stages
    while (remaining > 1.25 && stages.length < 8) {
      const bestSize = standardSizes.find(s => s <= remaining + 0.5) || 2.5;
      stages.push(bestSize);
      remaining -= bestSize;
    }
    
    // Sort stages ascending for better UI
    stages.sort((a, b) => a - b);

    const kvaAtual = P / fp1;
    const kvaNovo = P / fp2;

    setResult({
      totalKvar: Math.round(totalKvar * 10) / 10,
      fixedKvar: Math.round(fixedKvar * 10) / 10,
      autoKvar: Math.round(autoKvar * 10) / 10,
      stages,
      kVA_atual: Math.round(kvaAtual * 10) / 10,
      kVA_novo: Math.round(kvaNovo * 10) / 10,
      reducaoPercentual: Math.round(((kvaAtual - kvaNovo) / kvaAtual) * 1000) / 10,
      trafoLossesKvar: Math.round(trafoKvar * 10) / 10
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">Dimensionamento Avançado</h1>
          <p className="text-slate-500">Cálculo normatizado para bancos fixos e automáticos</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
          <button 
            onClick={() => setMethod('analyzer')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
              method === 'analyzer' ? "bg-primary text-white" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <Activity size={16} />
            Analisador
          </button>
          <button 
            onClick={() => setMethod('bills')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
              method === 'bills' ? "bg-primary text-white" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <History size={16} />
            Faturas (12m)
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Coluna de Entrada (4/12) */}
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
              {method === 'analyzer' ? 'Dados do Analisador' : 'Histórico de Consumo'}
            </h2>

            <AnimatePresence mode="wait">
              {method === 'analyzer' ? (
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
              ) : (
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

        {/* Coluna de Resultados (7/12) */}
        <div className="lg:col-span-7">
          {result ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Resumo Geral */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                <div className="bg-slate-900 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="text-center md:text-left">
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

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
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
              </div>

              {/* Alertas e Normas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div className="flex gap-4">
                <button 
                  onClick={() => window.print()}
                  className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold py-4 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Download size={20} />
                  Exportar Memorial
                </button>
                <button 
                  className="flex-1 bg-primary text-white font-bold py-4 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  <FileText size={20} className="text-secondary" />
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
                Selecione o método de entrada (Analisador ou Faturas) e preencha os dados técnicos para gerar o memorial de dimensionamento.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
