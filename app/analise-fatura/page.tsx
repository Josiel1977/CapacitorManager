'use client';

import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  Upload, 
  FileText, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  DollarSign,
  Info,
  CheckCircle2,
  ArrowRight,
  Download,
  Activity,
  Cpu,
  ArrowUpRight,
  FileDown
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts';
import { cn } from '@/lib/utils';
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
  const [tariff, setTariff] = useState(0.95); // R$/kWh

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      
      // Tenta encontrar a linha de cabeçalho real (que começa com "Data")
      const lines = content.split('\n');
      const headerIndex = lines.findIndex(line => 
        line.toLowerCase().includes('data') && 
        (line.includes(';') || line.includes(','))
      );
      
      if (headerIndex === -1) {
        setLoading(false);
        Swal.fire('Erro', 'Não foi possível encontrar o cabeçalho "Data" no arquivo. Certifique-se de que o arquivo contém uma coluna chamada "Data".', 'error');
        return;
      }

      // Reconstrói o CSV a partir do cabeçalho real
      const cleanContent = lines.slice(headerIndex).join('\n');

      Papa.parse(cleanContent, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const parseBrazilianNumber = (val: any) => {
              if (val === undefined || val === null) return 0;
              if (typeof val === 'number') return val;
              const str = String(val).trim();
              if (!str || str === '-' || str === '#VALOR!') return 0;
              // Remove pontos de milhar e troca vírgula por ponto
              const normalized = str.replace(/\./g, '').replace(',', '.');
              const num = parseFloat(normalized);
              return isNaN(num) ? 0 : num;
            };

            const processed = results.data.map((row: any) => {
              // Normaliza as chaves para busca insensível a maiúsculas/minúsculas e espaços
              const normalizedRow: any = {};
              Object.keys(row).forEach(key => {
                normalizedRow[key.trim().toLowerCase()] = row[key];
              });

              const getVal = (possibleKeys: string[]) => {
                // Busca exata
                for (const key of possibleKeys) {
                  if (normalizedRow[key] !== undefined) return normalizedRow[key];
                }
                // Busca parcial
                const foundKey = Object.keys(normalizedRow).find(k => 
                  possibleKeys.some(pk => k.includes(pk.toLowerCase()))
                );
                return foundKey ? normalizedRow[foundKey] : '0';
              };

              const kw = parseBrazilianNumber(getVal(['kw fornecido', 'ativa(kw)', 'kw', 'ativa']));
              const kvar = parseBrazilianNumber(getVal(['kvar indutivo', 'reativa(kvar)', 'kvar', 'reativa']));
              
              // Cálculo do FP Real
              const s = Math.sqrt(Math.pow(kw, 2) + Math.pow(kvar, 2));
              const fp = s > 0 ? kw / s : 1;

              // Cálculo da Correção Necessária
              const phiAtual = Math.acos(Math.min(1, Math.max(0, fp)));
              const phiDesejado = Math.acos(targetFP);
              const kvarNecessario = kw * (Math.tan(phiAtual) - Math.tan(phiDesejado));

              // Trata Data e Hora
              let fullDate = getVal(['data', 'date']) || '';
              let hora = getVal(['hora', 'time']) || '';
              
              if (fullDate.includes(' ') && !hora) {
                const parts = fullDate.split(' ');
                fullDate = parts[0];
                hora = parts[1];
              }

              return {
                data: fullDate,
                hora: hora,
                kw,
                kvar,
                fp: Math.round(fp * 100) / 100,
                kvarNecessario: kvarNecessario > 0 ? Math.round(kvarNecessario * 10) / 10 : 0
              };
            });

            // Filtra linhas inválidas
            const validData = processed.filter(d => d.kw > 0 || d.kvar > 0);

            if (validData.length === 0) {
              console.log('Exemplo de linha processada:', processed[0]);
              throw new Error('Nenhum dado de consumo (kW ou kVAr) válido encontrado. Verifique se as colunas estão nomeadas corretamente.');
            }

            setData(validData);
            Swal.fire('Sucesso', `${validData.length} registros processados com sucesso!`, 'success');
          } catch (error: any) {
            console.error(error);
            Swal.fire('Erro', error.message || 'Falha ao processar o arquivo CSV.', 'error');
          } finally {
            setLoading(false);
          }
        }
      });
    };

    reader.onerror = () => {
      setLoading(false);
      Swal.fire('Erro', 'Falha ao ler o arquivo.', 'error');
    };

    reader.readAsText(file);
  };

  const exportToPDF = async () => {
    const element = document.getElementById('report-content');
    if (!element) return;

    setLoading(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f8fafc'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Relatorio_EnergyWise_${new Date().getTime()}.pdf`);
      Swal.fire('Sucesso', 'Relatório exportado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      Swal.fire('Erro', 'Falha ao gerar o PDF.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (data.length === 0) return;
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `dados_processados_energywise_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = useMemo(() => {
    if (data.length === 0) return null;

    const totalExcedenteKvarh = data.reduce((acc, curr) => acc + (curr.fp < 0.92 ? curr.kvar : 0), 0) / 4; // Assumindo intervalos de 15min
    const multaEstimada = totalExcedenteKvarh * tariff * 0.3; // Estimativa simplificada de multa reativa
    const picoDemanda = Math.max(...data.map(d => d.kw));
    const fpMedio = data.reduce((acc, curr) => acc + curr.fp, 0) / data.length;
    const maxKvarNecessario = Math.max(...data.map(d => d.kvarNecessario));

    return {
      totalExcedenteKvarh,
      multaEstimada,
      picoDemanda,
      fpMedio,
      maxKvarNecessario
    };
  }, [data, tariff]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Hero Section Premium */}
      <motion.section 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-primary rounded-3xl p-8 md:p-12 text-white shadow-2xl"
      >
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-secondary/20 to-transparent pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-secondary text-xs font-bold tracking-wider uppercase">
            <Cpu size={14} />
            IA de Otimização Ativa
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
            EnergyWise: O cérebro que faz sua casa trabalhar para o seu bolso.
          </h1>
          <p className="text-lg text-white/70 leading-relaxed">
            Transforme dados brutos de memória de massa em lucro real. Identificamos desperdícios reativos e sugerimos a correção exata para zerar suas multas.
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <label className="flex items-center gap-2 bg-secondary text-primary px-6 py-3 rounded-xl font-bold shadow-lg shadow-secondary/20 cursor-pointer hover:scale-105 transition-transform">
              <Upload size={20} />
              Importar Memória de Massa
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            </label>
            {data.length > 0 && (
              <button 
                onClick={exportToPDF}
                className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors"
              >
                <FileDown size={20} />
                Exportar PDF
              </button>
            )}
          </div>
        </div>
      </motion.section>

      {data.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200"
        >
          <div className="bg-slate-50 p-6 rounded-full mb-6">
            <FileText size={48} className="text-slate-300" />
          </div>
          <h2 className="text-xl font-semibold text-slate-700 mb-2">Aguardando dados...</h2>
          <p className="text-slate-500 max-w-md text-center">
            Faça o upload do arquivo CSV (ponto e vírgula) exportado do seu medidor para iniciar a consultoria automática.
          </p>
        </motion.div>
      ) : (
        <div id="report-content" className="space-y-8">
          {/* Dashboard de Impacto */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <DollarSign size={64} className="text-red-600" />
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-50 rounded-lg text-red-600">
                  <DollarSign size={20} />
                </div>
                <span className="text-sm font-medium text-slate-500">Multa Estimada</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">R$ {stats?.multaEstimada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertTriangle size={12} />
                Excedente Reativo Detectado
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Zap size={64} className="text-blue-600" />
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                  <Zap size={20} />
                </div>
                <span className="text-sm font-medium text-slate-500">Pico de Demanda</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{stats?.picoDemanda.toFixed(1)} kW</p>
              <p className="text-xs text-slate-400 mt-1">Maior carga registrada</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp size={64} className="text-amber-600" />
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                  <TrendingUp size={20} />
                </div>
                <span className="text-sm font-medium text-slate-500">FP Médio</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{stats?.fpMedio.toFixed(2)}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full transition-all", (stats?.fpMedio || 0) < 0.92 ? "bg-red-500" : "bg-green-500")}
                    style={{ width: `${(stats?.fpMedio || 0) * 100}%` }}
                  />
                </div>
                <span className={cn("text-[10px] font-bold", (stats?.fpMedio || 0) < 0.92 ? "text-red-500" : "text-green-500")}>
                  {Math.round((stats?.fpMedio || 0) * 100)}%
                </span>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Activity size={64} className="text-green-600" />
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-50 rounded-lg text-green-600">
                  <CheckCircle2 size={20} />
                </div>
                <span className="text-sm font-medium text-slate-500">Status do Cérebro</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <p className="text-xl font-bold text-slate-900">Otimização Ativa</p>
              </div>
              <p className="text-xs text-slate-400 mt-1">IA analisando {data.length} pontos</p>
            </motion.div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold text-primary">Curva de Carga (kW)</h3>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="w-3 h-3 bg-blue-500 rounded-full" />
                  <span>Potência Ativa</span>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="colorKw" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="hora" hide />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Area type="monotone" dataKey="kw" stroke="#3b82f6" fillOpacity={1} fill="url(#colorKw)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold text-primary">Fator de Potência</h3>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="w-3 h-3 bg-amber-500 rounded-full" />
                  <span>FP Real</span>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="hora" hide />
                    <YAxis domain={[0.5, 1]} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Line type="monotone" dataKey="fp" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    {/* Linha de referência 0.92 */}
                    <Line type="monotone" dataKey={() => 0.92} stroke="#ef4444" strokeDasharray="5 5" dot={false} strokeWidth={1} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Insights e Sugestões */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-primary mb-6">Análise Detalhada de Intervalos Críticos</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-4">Data/Hora</th>
                      <th className="pb-4">kW</th>
                      <th className="pb-4">FP</th>
                      <th className="pb-4">Correção (kVAr)</th>
                      <th className="pb-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.filter(d => d.fp < 0.92).slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="text-sm">
                        <td className="py-4 font-medium text-slate-700">{row.data} {row.hora}</td>
                        <td className="py-4 text-slate-600">{row.kw}</td>
                        <td className="py-4 font-bold text-red-500">{row.fp}</td>
                        <td className="py-4 text-slate-600">{row.kvarNecessario}</td>
                        <td className="py-4">
                          <span className="px-2 py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded-md uppercase">Crítico</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-primary p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Zap className="text-secondary" />
                  Cérebro EnergyWise
                </h3>
                <p className="text-white/70 text-sm mb-6 leading-relaxed">
                  Com base na sua memória de massa, identificamos que o seu banco de capacitores atual não está suprindo a demanda nos horários de pico.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 p-1 bg-white/10 rounded">
                      <ArrowRight size={14} className="text-secondary" />
                    </div>
                    <p className="text-sm font-medium">Adicionar estágio de {Math.ceil((stats?.maxKvarNecessario || 0) / 2.5) * 2.5} kVAr</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-1 p-1 bg-white/10 rounded">
                      <ArrowRight size={14} className="text-secondary" />
                    </div>
                    <p className="text-sm font-medium">Revisar bombas de recalque às 18h</p>
                  </div>
                </div>
                <button 
                  onClick={exportToPDF}
                  className="w-full mt-8 bg-secondary text-primary font-bold py-3 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-secondary/20"
                >
                  <Download size={18} />
                  Baixar Relatório em PDF
                </button>
                <button 
                  onClick={downloadCSV}
                  className="w-full mt-3 bg-white/10 text-white border border-white/20 font-bold py-3 rounded-xl hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  Baixar Dados Processados (CSV)
                </button>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <h4 className="font-bold text-primary mb-4">Configurações de Análise</h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Meta de Fator de Potência</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={targetFP} 
                      onChange={(e) => setTargetFP(parseFloat(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Tarifa de Energia (R$/kWh)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={tariff} 
                      onChange={(e) => setTariff(parseFloat(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
