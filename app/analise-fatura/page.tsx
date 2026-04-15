'use client';

import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  Upload, Zap, Cpu, TrendingUp, AlertTriangle, 
  FileDown, Download, CheckCircle2, ArrowRight,
  Info, BarChart3, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, LineChart, Line,
  BarChart, Bar
} from 'recharts';
import Swal from 'sweetalert2';

interface MassMemoryData {
  data: string;
  hora: string;
  kw: number;
  kvar: number;
  fp: number;
  kvarNecessario: number;
}

export default function AnaliseFaturaPage() {
  const [data, setData] = useState<MassMemoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetFP, setTargetFP] = useState(0.92);

  // --- LÓGICA DE TRATAMENTO DE DADOS ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      
      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const processed = results.data.map((row: any) => {
              const parseNum = (val: any) => {
                if (!val) return 0;
                return parseFloat(String(val).replace(/\./g, '').replace(',', '.')) || 0;
              };

              // Mapeamento automático das colunas do seu CSV (Equatorial/Outras)
              const kw = parseNum(row['kW fornecido'] || row['kw'] || row['Ativa']);
              const kvar = parseNum(row['kVAr indutivo'] || row['kvar'] || row['Reativa']);
              
              const s = Math.sqrt(Math.pow(kw, 2) + Math.pow(kvar, 2));
              const fp = s > 0 ? kw / s : 1;
              
              // Cálculo de correção trigonométrica
              const phiAtual = Math.acos(Math.min(1, fp));
              const phiDesejado = Math.acos(targetFP);
              const qcCálculo = kw * (Math.tan(phiAtual) - Math.tan(phiDesejado));

              return {
                data: row['Data'] || '',
                hora: (row['Data'] || '').split(' ')[1] || '',
                kw,
                kvar,
                fp: Number(fp.toFixed(2)),
                kvarNecessario: qcCálculo > 0 ? Number(qcCálculo.toFixed(1)) : 0
              };
            }).filter((d: any) => d.kw > 0);

            setData(processed);
            Swal.fire({
              title: 'Análise Concluída',
              text: `${processed.length} intervalos processados com sucesso.`,
              icon: 'success',
              confirmButtonColor: '#2563eb'
            });
          } catch (err) {
            Swal.fire('Erro', 'O formato do CSV não é reconhecido.', 'error');
          } finally { setLoading(false); }
        }
      });
    };
    reader.readAsText(file);
  };

  // --- INTELIGÊNCIA DE DIMENSIONAMENTO (DELEGADA) ---
  const projeto = useMemo(() => {
    if (data.length === 0) return null;

    const indutivos = data.map(d => d.kvar);
    const menorIndutivo = Math.min(...indutivos);
    const picoNecessidade = Math.max(...data.map(d => d.kvarNecessario));

    // Mitigação: Banco fixo em 80% do mínimo para evitar excesso capacitivo
    const fixo = Math.floor(menorIndutivo * 0.8);
    const auto = Math.ceil(picoNecessidade - fixo);

    return {
      fixo,
      auto: auto > 0 ? auto : 0,
      total: fixo + (auto > 0 ? auto : 0),
      estagios: `Sugestão: 6 estágios de ${Math.ceil(((auto > 0 ? auto : 0) / 6) / 2.5) * 2.5} kVAr`
    };
  }, [data, targetFP]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Premium */}
        <header className="bg-gradient-to-r from-slate-900 to-blue-900 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="text-blue-400 fill-blue-400" size={24} />
                <span className="font-black tracking-tighter text-2xl">CAPACITOR MANAGE</span>
              </div>
              <p className="text-blue-100/70 max-w-md">Análise inteligente de memória de massa para dimensionamento de bancos de capacitores automáticos e fixos.</p>
            </div>
            <label className="group relative bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-blue-900/40 cursor-pointer overflow-hidden">
              <span className="relative z-10 flex items-center gap-2">
                <Upload size={20} /> Importar Memória de Massa
              </span>
              <input type="file" className="hidden" onChange={handleFileUpload} accept=".csv" />
            </label>
          </div>
        </header>

        <AnimatePresence>
          {data.length > 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* KPIs de Engenharia */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <CardResumo title="Banco Fixo" value={`${projeto?.fixo} kVAr`} sub="Compensação de fundo" icon={<Activity className="text-blue-600" />} color="blue" />
                <CardResumo title="Banco Automático" value={`${projeto?.auto} kVAr`} sub={projeto?.estagios || ""} icon={<Cpu className="text-purple-600" />} color="purple" />
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-400 text-xs font-bold uppercase">Meta de FP</span>
                    <TrendingUp size={18} className="text-emerald-500" />
                  </div>
                  <div className="text-4xl font-black text-slate-900 mb-4">{targetFP.toFixed(2)}</div>
                  <input type="range" min="0.92" max="1.0" step="0.01" value={targetFP} onChange={(e) => setTargetFP(parseFloat(e.target.value))} className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                </div>
              </div>

              {/* Gráficos de Análise */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><BarChart3 size={20} /> Curva de Carga Reativa (kVAr)</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data}>
                        <defs>
                          <linearGradient id="colorKvar" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="hora" hide />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Area type="monotone" dataKey="kvar" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorKvar)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><Activity size={20} /> Monitoramento de Fator de Potência</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="hora" hide />
                        <YAxis domain={[0.5, 1]} stroke="#94a3b8" fontSize={12} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                        <Line type="monotone" dataKey="fp" stroke="#3b82f6" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey={() => 0.92} stroke="#ef4444" strokeDasharray="5 5" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-32 bg-white rounded-[2rem] border-2 border-dashed border-slate-200 text-slate-400"
            >
              <div className="bg-slate-50 p-6 rounded-full mb-6">
                <Upload size={48} className="opacity-20" />
              </div>
              <h2 className="text-xl font-medium mb-2">Nenhum dado carregado</h2>
              <p className="text-sm">Importe o ficheiro CSV da concessionária para iniciar o dimensionamento.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CardResumo({ title, value, sub, icon, color }: any) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
        {React.cloneElement(icon, { size: 48 })}
      </div>
      <span className="text-slate-400 text-xs font-bold uppercase">{title}</span>
      <div className="text-4xl font-black text-slate-900 mt-2">{value}</div>
      <p className="text-xs text-slate-500 mt-2 font-medium flex items-center gap-1">
        <CheckCircle2 size={12} className="text-emerald-500" /> {sub}
      </p>
    </div>
  );
}