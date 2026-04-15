'use client';

import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  Upload, Zap, Cpu, TrendingUp, AlertTriangle, 
  Download, CheckCircle2, FileText, FileDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, LineChart, Line
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

              const kw = parseNum(row['kW fornecido'] || row['kw'] || row['Ativa']);
              const kvar = parseNum(row['kVAr indutivo'] || row['kvar'] || row['Reativa']);
              const s = Math.sqrt(Math.pow(kw, 2) + Math.pow(kvar, 2));
              const fp = s > 0 ? kw / s : 1;
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
            Swal.fire('Sucesso', 'Dados processados com sucesso!', 'success');
          } catch (err) {
            Swal.fire('Erro', 'Falha ao ler o arquivo.', 'error');
          } finally { setLoading(false); }
        }
      });
    };
    reader.readAsText(file);
  };

  const projeto = useMemo(() => {
    if (data.length === 0) return null;
    const menorIndutivo = Math.min(...data.map(d => d.kvar));
    const picoNecessidade = Math.max(...data.map(d => d.kvarNecessario));
    const fixo = Math.floor(menorIndutivo * 0.8);
    const auto = Math.ceil(picoNecessidade - fixo);
    return { fixo, auto: auto > 0 ? auto : 0, estagios: `6 estágios de ${Math.ceil((auto / 6) / 2.5) * 2.5} kVAr` };
  }, [data, targetFP]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER COM BOTÃO DE UPLOAD */}
        <header className="bg-slate-900 rounded-[2rem] p-8 text-white flex flex-col md:row justify-between items-center gap-6 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-3 rounded-2xl">
              <Zap size={28} className="fill-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">CAPACITOR MANAGE</h1>
              <p className="text-slate-400 text-sm">Dimensionamento Inteligente</p>
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-bold cursor-pointer transition-all active:scale-95 shadow-lg shadow-blue-900/20">
              <Upload size={20} />
              IMPORTAR MEMÓRIA
              <input type="file" className="hidden" onChange={handleFileUpload} accept=".csv" />
            </label>
          </div>
        </header>

        <AnimatePresence>
          {data.length > 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              
              {/* BOTÕES DE EXPORTAÇÃO (REAPARECERAM AQUI) */}
              <div className="flex justify-end gap-4">
                <button onClick={() => window.print()} className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-all">
                  <FileDown size={18} /> Exportar PDF
                </button>
                <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-all">
                  <Download size={18} /> Baixar CSV
                </button>
              </div>

              {/* CARDS DE RESULTADOS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-5"><Activity size={64} /></div>
                   <span className="text-xs font-bold text-slate-400 uppercase">Banco Fixo</span>
                   <div className="text-4xl font-black text-slate-900 mt-2">{projeto?.fixo} kVAr</div>
                   <div className="flex items-center gap-1 text-emerald-600 text-xs mt-2 font-bold"><CheckCircle2 size={14}/> Recomendado</div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-5"><Cpu size={64} /></div>
                   <span className="text-xs font-bold text-slate-400 uppercase">Banco Automático</span>
                   <div className="text-4xl font-black text-blue-600 mt-2">{projeto?.auto} kVAr</div>
                   <div className="text-xs text-slate-500 mt-2 font-medium">{projeto?.estagios}</div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                   <span className="text-xs font-bold text-slate-400 uppercase">Ajustar Meta FP</span>
                   <div className="text-4xl font-black text-slate-900 mt-2">{targetFP.toFixed(2)}</div>
                   <input type="range" min="0.92" max="1.0" step="0.01" value={targetFP} onChange={(e) => setTargetFP(parseFloat(e.target.value))} className="w-full mt-4 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                </div>
              </div>

              {/* GRÁFICO */}
              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 h-[400px]">
                <h3 className="font-bold text-slate-800 mb-6">Análise de Consumo Reativo (kVAr)</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="hora" hide />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="kvar" stroke="#f59e0b" strokeWidth={3} fill="#f59e0b" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

            </motion.div>
          ) : (
            /* ESTADO VAZIO */
            <div className="py-32 bg-white rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center text-slate-400">
              <Upload size={48} className="mb-4 opacity-20" />
              <p className="font-medium">Carregue o arquivo CSV para visualizar os botes e a análise.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Activity(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>; }