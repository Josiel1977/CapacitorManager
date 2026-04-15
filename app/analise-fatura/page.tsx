'use client';

import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { 
  Upload, FileText, AlertTriangle, TrendingUp, TrendingDown, Zap, 
  DollarSign, Info, CheckCircle2, ArrowRight, Download, Activity, 
  Cpu, ArrowUpRight, FileDown, Settings, Calendar, Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar
} from 'recharts';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================
interface MassMemoryData {
  data: string;
  hora: string;
  timestamp: string;
  kw: number;
  kvar: number;
  fp: number;
  kvarNecessario: number;
  kWh?: number;
  kVArh?: number;
  tipoReativo: 'indutivo' | 'capacitivo' | 'neutro';
}

interface AnalysisStats {
  totalExcedenteKvarh: number;
  multaEstimada: number;
  picoDemanda: number;
  fpMedio: number;
  maxKvarNecessario: number;
  registrosCriticos: number;
  percentualConformidade: number;
  periodoAnalise: { inicio: string; fim: string };
}

interface DimensionamentoStats {
  mediaKW: number;
  mediaKvar: number;
  mediaFP: number;
  periodosCriticos: number;
  percentualCritico: number;
  mediaKvarCritico: number;
  percentil90KvarCritico: number;
  maxKvarCritico: number;
  bancoSugeridoFixo: number;
  bancoSugeridoAutomatico: number;
  tipoRecomendado: 'fixo' | 'automatico' | 'hibrido';
  justificativa: string;
  coeficienteVariacao: number;
}

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

const parseBrazilianNumber = (val: any): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  if (!str || str === '-' || str === '#VALOR!') return 0;
  const normalized = str.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
};

const calcularFP = (kw: number, kvar: number): number => {
  const s = Math.sqrt(Math.pow(kw, 2) + Math.pow(kvar, 2));
  return s > 0 ? Math.abs(kw) / s : 1;
};

const calcularCorrecaoNecessaria = (kw: number, fpAtual: number, fpDesejado: number): number => {
  if (kw <= 0) return 0;
  const phiAtual = Math.acos(Math.min(1, Math.max(0, Math.abs(fpAtual))));
  const phiDesejado = Math.acos(Math.min(1, Math.max(0, fpDesejado)));
  const kvarNecessario = kw * (Math.tan(phiAtual) - Math.tan(phiDesejado));
  return kvarNecessario > 0 ? Math.round(kvarNecessario * 10) / 10 : 0;
};

const calcularMultaANEEL = (
  registros: MassMemoryData[], 
  tarifa: number, 
  fpMinimo: number,
  samplesPerHour: number
): number => {
  return registros.reduce((total, reg) => {
    if (reg.fp >= fpMinimo || reg.tipoReativo !== 'indutivo') return total;
    const fatorAjuste = Math.max(0, (fpMinimo / reg.fp) - 1);
    const kvarhIntervalo = Math.abs(reg.kvar) / samplesPerHour;
    return total + (kvarhIntervalo * tarifa * fatorAjuste);
  }, 0);
};

const detectSamplingInterval = (data: MassMemoryData[]): number => {
  if (data.length < 2) return 15;
  
  for (let i = 0; i < Math.min(data.length - 1, 10); i++) {
    const t1 = new Date(`${data[i].data.split('/').reverse().join('-')}T${data[i].hora}`);
    const t2 = new Date(`${data[i + 1].data.split('/').reverse().join('-')}T${data[i + 1].hora}`);
    
    if (!isNaN(t1.getTime()) && !isNaN(t2.getTime())) {
      const diffMinutes = Math.abs(t2.getTime() - t1.getTime()) / (1000 * 60);
      if (diffMinutes > 0 && diffMinutes <= 60) {
        return Math.round(diffMinutes);
      }
    }
  }
  return 15;
};

const getPercentile = (arr: number[], percentile: number): number => {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

const analisarDimensionamento = (
  data: MassMemoryData[],
  targetFP: number
): DimensionamentoStats => {
  const periodosCriticos = data.filter(d => 
    d.fp < targetFP && d.tipoReativo === 'indutivo'
  );
  
  const mediaKW = data.reduce((acc, d) => acc + d.kw, 0) / data.length;
  const mediaKvar = data.reduce((acc, d) => acc + Math.abs(d.kvar), 0) / data.length;
  const mediaFP = data.reduce((acc, d) => acc + d.fp, 0) / data.length;
  
  const kvarCriticos = periodosCriticos.map(d => d.kvarNecessario);
  const mediaKvarCritico = kvarCriticos.length > 0 
    ? kvarCriticos.reduce((a, b) => a + b, 0) / kvarCriticos.length 
    : 0;
  const percentil90KvarCritico = getPercentile(kvarCriticos, 90);
  const maxKvarCritico = Math.max(...kvarCriticos, 0);
  
  const variancia = periodosCriticos.length > 0
    ? periodosCriticos.reduce((acc, d) => acc + Math.pow(d.kvar - mediaKvar, 2), 0) / periodosCriticos.length
    : 0;
  const desvioPadrao = Math.sqrt(variancia);
  const coeficienteVariacao = mediaKvar > 0 ? desvioPadrao / mediaKvar : 0;
  
  let tipoRecomendado: 'fixo' | 'automatico' | 'hibrido';
  let justificativa: string;
  
  if (periodosCriticos.length === 0) {
    tipoRecomendado = 'fixo';
    justificativa = "Sistema já está conforme. Nenhum banco necessário.";
  } else if (coeficienteVariacao < 0.3 && periodosCriticos.length > data.length * 0.7) {
    tipoRecomendado = 'fixo';
    justificativa = `Carga estável (CV=${coeficienteVariacao.toFixed(2)}) com FP baixo constante. Banco fixo é mais econômico.`;
  } else if (coeficienteVariacao > 0.6) {
    tipoRecomendado = 'automatico';
    justificativa = `Alta variabilidade (CV=${coeficienteVariacao.toFixed(2)}). Banco automático com estágios evita sobre/sub-correção.`;
  } else {
    tipoRecomendado = 'hibrido';
    justificativa = `Variabilidade moderada (CV=${coeficienteVariacao.toFixed(2)}). Considere banco híbrido (fixo + automático).`;
  }
  
  return {
    mediaKW,
    mediaKvar,
    mediaFP,
    periodosCriticos: periodosCriticos.length,
    percentualCritico: (periodosCriticos.length / data.length) * 100,
    mediaKvarCritico,
    percentil90KvarCritico,
    maxKvarCritico,
    bancoSugeridoFixo: Math.ceil(mediaKvarCritico / 5) * 5,
    bancoSugeridoAutomatico: Math.ceil(percentil90KvarCritico / 5) * 5,
    tipoRecomendado,
    justificativa,
    coeficienteVariacao
  };
};

const gerarEstagios = (totalKvar: number): number[] => {
  const estagios: number[] = [];
  let restante = totalKvar;
  
  const tamanhoEstagio = totalKvar <= 30 ? 5 : 
                         totalKvar <= 90 ? 10 : 
                         totalKvar <= 200 ? 20 : 30;
  
  while (restante > 0) {
    const estagio = Math.min(tamanhoEstagio, restante);
    estagios.push(estagio);
    restante -= estagio;
  }
  
  return estagios;
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function AnaliseFaturaPage() {
  const [data, setData] = useState<MassMemoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetFP, setTargetFP] = useState(0.92);
  const [tariff, setTariff] = useState(0.95);
  const [samplingInterval, setSamplingInterval] = useState(15);
  const [fileName, setFileName] = useState<string>('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      
      const lines = content.split('\n');
      const headerIndex = lines.findIndex(line => 
        line.toLowerCase().includes('data') && 
        (line.includes(';') || line.includes(','))
      );
      
      if (headerIndex === -1) {
        setLoading(false);
        Swal.fire('Erro', 'Não foi possível encontrar o cabeçalho "Data" no arquivo.', 'error');
        return;
      }

      const cleanContent = lines.slice(headerIndex).join('\n');

      Papa.parse(cleanContent, {
        header: true,
        skipEmptyLines: true,
        delimiter: '',
        complete: (results) => {
          try {
            const processed = results.data.map((row: any) => {
              const normalizedRow: any = {};
              Object.keys(row).forEach(key => {
                normalizedRow[key.trim().toLowerCase()] = row[key];
              });

              const getVal = (possibleKeys: string[]) => {
                for (const key of possibleKeys) {
                  if (normalizedRow[key] !== undefined) return normalizedRow[key];
                }
                const foundKey = Object.keys(normalizedRow).find(k => 
                  possibleKeys.some(pk => k.includes(pk.toLowerCase()))
                );
                return foundKey ? normalizedRow[foundKey] : '0';
              };

              const kw = parseBrazilianNumber(getVal(['kw fornecido', 'ativa(kw)', 'kw', 'ativa', 'demanda ativa']));
              let kvar = parseBrazilianNumber(getVal(['kvar indutivo', 'kvar capacitivo', 'reativa(kvar)', 'kvar', 'reativa']));
              
              const tipoReativo: 'indutivo' | 'capacitivo' | 'neutro' = 
                kvar > 0.01 ? 'indutivo' : kvar < -0.01 ? 'capacitivo' : 'neutro';
              
              const fp = calcularFP(kw, kvar);
              const kvarNecessario = (tipoReativo === 'indutivo' && fp < targetFP) 
                ? calcularCorrecaoNecessaria(kw, fp, targetFP) 
                : 0;

              let fullDate = getVal(['data', 'date']) || '';
              let hora = getVal(['hora', 'time', 'horario']) || '';
              
              if (fullDate.includes(' ') && !hora) {
                const parts = fullDate.split(' ');
                fullDate = parts[0];
                hora = parts[1];
              }

              const timestamp = `${fullDate}T${hora.padStart(5, '0')}`;

              return {
                data: fullDate,
                hora: hora,
                timestamp,
                kw,
                kvar,
                fp: Math.round(fp * 100) / 100,
                kvarNecessario,
                tipoReativo
              };
            });

            const validData = processed.filter(d => d.kw > 0);

            if (validData.length === 0) {
              throw new Error('Nenhum dado de consumo (kW) válido encontrado.');
            }

            validData.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

            const detectedInterval = detectSamplingInterval(validData);
            setSamplingInterval(detectedInterval);

            setData(validData);
            Swal.fire('Sucesso', `${validData.length} registros processados! Amostragem: ${detectedInterval}min`, 'success');
          } catch (error: any) {
            console.error(error);
            Swal.fire('Erro', error.message || 'Falha ao processar o arquivo CSV.', 'error');
          } finally {
            setLoading(false);
          }
        },
        error: (error: any) => {
          console.error('Erro no Papa.parse:', error);
          Swal.fire('Erro', 'Falha ao analisar o CSV. Verifique o formato do arquivo.', 'error');
          setLoading(false);
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
      const dataUrl = await toPng(element, {
        quality: 1.0,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const imgWidth = img.width;
      const imgHeight = img.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;
      
      pdf.addImage(dataUrl, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      
      const dataAtual = new Date().toISOString().slice(0, 10).split('-').reverse().join('/');
      pdf.save(`Relatorio_EnergyWise_${dataAtual}.pdf`);
      
      Swal.fire('Sucesso', 'Relatório PDF exportado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      Swal.fire('Erro', 'Falha ao gerar o PDF. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (data.length === 0) return;
    
    const csvData = data.map(d => ({
      'Data': d.data,
      'Hora': d.hora,
      'kW': d.kw.toString().replace('.', ','),
      'kVAr': d.kvar.toString().replace('.', ','),
      'Tipo Reativo': d.tipoReativo,
      'FP Medido': d.fp.toString().replace('.', ','),
      'FP Meta': targetFP.toString().replace('.', ','),
      'Correcao Necessaria (kVAr)': d.kvarNecessario.toString().replace('.', ',')
    }));
    
    const csv = Papa.unparse(csvData, {
      delimiter: ';',
      header: true,
      skipEmptyLines: false
    });
    
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `dados_processados_energywise_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    Swal.fire('Sucesso', 'CSV exportado com separação correta!', 'success');
  };

  const stats: AnalysisStats | null = useMemo(() => {
    if (data.length === 0) return null;

    const samplesPerHour = 60 / samplingInterval;
    const registrosIndutivos = data.filter(d => d.tipoReativo === 'indutivo');
    
    const totalExcedenteKvarh = registrosIndutivos
      .filter(d => d.fp < targetFP)
      .reduce((acc, curr) => acc + Math.abs(curr.kvar), 0) / samplesPerHour;
    
    const multaEstimada = calcularMultaANEEL(data, tariff, targetFP, samplesPerHour);
    const picoDemanda = Math.max(...data.map(d => d.kw));
    const fpMedio = data.reduce((acc, curr) => acc + curr.fp, 0) / data.length;
    const maxKvarNecessario = Math.max(...data.map(d => d.kvarNecessario), 0);
    
    const registrosCriticos = data.filter(d => d.fp < targetFP && d.tipoReativo === 'indutivo').length;
    const percentualConformidade = ((data.length - registrosCriticos) / data.length) * 100;

    const periodoAnalise = {
      inicio: `${data[0].data} ${data[0].hora}`,
      fim: `${data[data.length - 1].data} ${data[data.length - 1].hora}`
    };

    return {
      totalExcedenteKvarh,
      multaEstimada,
      picoDemanda,
      fpMedio,
      maxKvarNecessario,
      registrosCriticos,
      percentualConformidade,
      periodoAnalise
    };
  }, [data, tariff, targetFP, samplingInterval]);

  const dimensionamento: DimensionamentoStats | null = useMemo(() => {
    if (data.length === 0) return null;
    return analisarDimensionamento(data, targetFP);
  }, [data, targetFP]);

  const chartData = useMemo(() => {
    if (data.length === 0) return [];
    
    let prevDate = '';
    return data.map((d, idx) => {
      const showFullLabel = d.data !== prevDate || idx % 4 === 0;
      prevDate = d.data;
      return {
        ...d,
        horaLabel: showFullLabel ? `${d.hora}` : '',
        tooltipLabel: `${d.data} ${d.hora}`
      };
    });
  }, [data]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* HERO SECTION */}
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
            IA de Otimização Ativa • ANEEL 414/2010
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
            EnergyWise: O cérebro que faz sua instalação trabalhar para o seu bolso.
          </h1>
          <p className="text-lg text-white/70 leading-relaxed">
            Transforme memória de massa em economia real. Detectamos reativo excedente, calculamos multas conforme ANEEL e sugerimos a correção exata.
          </p>
          
          <div className="flex flex-wrap gap-4 pt-4">
            <label className="flex items-center gap-2 bg-secondary text-primary px-6 py-3 rounded-xl font-bold shadow-lg shadow-secondary/20 cursor-pointer hover:scale-105 transition-transform">
              <Upload size={20} />
              Importar CSV
              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
            </label>
            
            {data.length > 0 && (
              <>
                <button 
                  onClick={exportToPDF}
                  disabled={loading}
                  className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors disabled:opacity-50"
                >
                  <FileDown size={20} />
                  PDF
                </button>
                <button 
                  onClick={downloadCSV}
                  disabled={loading}
                  className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors disabled:opacity-50"
                >
                  <Download size={20} />
                  CSV
                </button>
              </>
            )}
          </div>
          
          {fileName && (
            <p className="text-xs text-white/50 flex items-center gap-2">
              <FileText size={12} />
              {fileName} • {data.length} registros • Amostragem: {samplingInterval}min
            </p>
          )}
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
          <p className="text-slate-500 max-w-md text-center mb-4">
            Faça upload do CSV da concessionária (Copel, Enel, Cemig, etc.) com colunas de kW e kVAr.
          </p>
          <details className="text-sm text-slate-400 max-w-lg">
            <summary className="cursor-pointer hover:text-slate-600 flex items-center gap-2">
              <Info size={14} />
              Formato esperado
            </summary>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Colunas: <code className="bg-slate-100 px-1 rounded">Data</code>, <code className="bg-slate-100 px-1 rounded">Hora</code>, <code className="bg-slate-100 px-1 rounded">kW</code>, <code className="bg-slate-100 px-1 rounded">kVAr</code></li>
              <li>Separador: vírgula ou ponto-e-vírgula</li>
              <li>Números: formato brasileiro (1.234,56)</li>
              <li>Intervalo: 15 ou 30 minutos (detectado automaticamente)</li>
            </ul>
          </details>
        </motion.div>
      ) : (
        <div id="report-content" className="space-y-8">
          
          {/* DASHBOARD DE IMPACTO */}
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
                <span className="text-sm font-medium text-slate-500">Multa Estimada (ANEEL)</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                R$ {stats?.multaEstimada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertTriangle size={12} />
                {stats?.registrosCriticos} intervalos com FP &lt; {targetFP}
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
              <p className="text-xs text-slate-400 mt-1">Maior carga ativa registrada</p>
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
                    className={cn("h-full transition-all", (stats?.fpMedio || 0) < targetFP ? "bg-red-500" : "bg-green-500")}
                    style={{ width: `${Math.min(100, (stats?.fpMedio || 0) * 100)}%` }}
                  />
                </div>
                <span className={cn("text-[10px] font-bold", (stats?.fpMedio || 0) < targetFP ? "text-red-500" : "text-green-500")}>
                  {stats?.percentualConformidade.toFixed(1)}% conforme
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
                <span className="text-sm font-medium text-slate-500">Status da Análise</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <p className="text-xl font-bold text-slate-900">Concluída</p>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {stats?.periodoAnalise.inicio} até {stats?.periodoAnalise.fim}
              </p>
            </motion.div>
          </div>

          {/* ANÁLISE DE DIMENSIONAMENTO */}
          {dimensionamento && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-3xl border border-blue-200"
            >
              <h3 className="text-2xl font-bold text-primary mb-6 flex items-center gap-2">
                <Cpu size={24} />
                Análise de Dimensionamento Inteligente
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm">
                  <h4 className="text-sm font-bold text-slate-400 uppercase mb-4">Médias Gerais</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-600">kW Médio:</span>
                      <span className="font-bold text-primary">{dimensionamento.mediaKW.toFixed(1)} kW</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">kVAr Médio:</span>
                      <span className="font-bold text-primary">{dimensionamento.mediaKvar.toFixed(1)} kVAr</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">FP Médio:</span>
                      <span className={cn(
                        "font-bold",
                        dimensionamento.mediaFP >= targetFP ? "text-green-600" : "text-red-600"
                      )}>{dimensionamento.mediaFP.toFixed(3)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm">
                  <h4 className="text-sm font-bold text-slate-400 uppercase mb-4">Períodos Críticos</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Ocorrências:</span>
                      <span className="font-bold text-red-600">{dimensionamento.periodosCriticos}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">% do Total:</span>
                      <span className="font-bold text-red-600">{dimensionamento.percentualCritico.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Variabilidade (CV):</span>
                      <span className={cn(
                        "font-bold",
                        dimensionamento.coeficienteVariacao < 0.3 ? "text-green-600" :
                        dimensionamento.coeficienteVariacao < 0.6 ? "text-amber-600" : "text-red-600"
                      )}>{dimensionamento.coeficienteVariacao.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-secondary">
                  <h4 className="text-sm font-bold text-secondary uppercase mb-4">Recomendação</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Tipo:</span>
                      <span className={cn(
                        "px-2 py-1 rounded text-xs font-bold uppercase",
                        dimensionamento.tipoRecomendado === 'fixo' ? "bg-green-100 text-green-700" :
                        dimensionamento.tipoRecomendado === 'automatico' ? "bg-blue-100 text-blue-700" :
                        "bg-amber-100 text-amber-700"
                      )}>{dimensionamento.tipoRecomendado}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Capacidade:</span>
                      <span className="font-bold text-2xl text-primary">{dimensionamento.bancoSugeridoAutomatico} kVAr</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Percentil 90:</span>
                      <span className="font-semibold">{dimensionamento.percentil90KvarCritico.toFixed(1)} kVAr</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm">
                <h4 className="text-sm font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <Info size={16} />
                  Justificativa Técnica
                </h4>
                <p className="text-slate-700 leading-relaxed">{dimensionamento.justificativa}</p>
                
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                    <div className="text-xs font-bold text-red-600 uppercase mb-1">Média Simples</div>
                    <div className="text-2xl font-bold text-red-700">{dimensionamento.bancoSugeridoFixo} kVAr</div>
                    <div className="text-xs text-red-600 mt-1">❌ Risco de subdimensionamento</div>
                  </div>
                  
                  <div className="p-4 bg-green-50 rounded-xl border border-green-200 ring-2 ring-green-500">
                    <div className="text-xs font-bold text-green-600 uppercase mb-1">Percentil 90 (Recomendado)</div>
                    <div className="text-2xl font-bold text-green-700">{dimensionamento.bancoSugeridoAutomatico} kVAr</div>
                    <div className="text-xs text-green-600 mt-1">✅ Atende 90% dos casos</div>
                  </div>
                  
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="text-xs font-bold text-amber-600 uppercase mb-1">Máximo Absoluto</div>
                    <div className="text-2xl font-bold text-amber-700">{Math.ceil(dimensionamento.maxKvarCritico / 5) * 5} kVAr</div>
                    <div className="text-xs text-amber-600 mt-1">⚠️ Pode superdimensionar</div>
                  </div>
                </div>
              </div>

              {dimensionamento.tipoRecomendado !== 'fixo' && dimensionamento.bancoSugeridoAutomatico > 0 && (
                <div className="mt-6 bg-white p-6 rounded-2xl shadow-sm">
                  <h4 className="text-sm font-bold text-slate-400 uppercase mb-4">Configuração Sugerida de Estágios</h4>
                  <div className="flex flex-wrap gap-3">
                    {gerarEstagios(dimensionamento.bancoSugeridoAutomatico).map((estagio, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg">
                        <span className="text-xs text-slate-500">Estágio {idx + 1}:</span>
                        <span className="font-bold text-blue-700">{estagio} kVAr</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-3">
                    Total: {dimensionamento.bancoSugeridoAutomatico} kVAr • Controlador com {gerarEstagios(dimensionamento.bancoSugeridoAutomatico).length} estágios
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* GRÁFICOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                  <Activity size={18} />
                  Curva de Carga Ativa
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="w-3 h-3 bg-blue-500 rounded-full" />
                  <span>Potência (kW)</span>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorKw" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="horaLabel" 
                      tick={{ fontSize: 10 }} 
                      interval="preserveStartEnd"
                      stroke="#94a3b8"
                    />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      labelFormatter={(label) => chartData.find(d => d.horaLabel === label)?.tooltipLabel || label}
                      formatter={(value: any, name: any) => [`${value} kW`, 'Demanda Ativa']}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Area type="monotone" dataKey="kw" stroke="#3b82f6" fillOpacity={1} fill="url(#colorKw)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                  <TrendingUp size={18} />
                  Fator de Potência
                </h3>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-amber-500 rounded-full" />
                    <span className="text-slate-400">FP Medido</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-8 border-t-2 border-dashed border-red-500" />
                    <span className="text-slate-400">Meta: {targetFP}</span>
                  </div>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="horaLabel" 
                      tick={{ fontSize: 10 }} 
                      interval="preserveStartEnd"
                      stroke="#94a3b8"
                    />
                    <YAxis domain={[0.5, 1]} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      labelFormatter={(label) => chartData.find(d => d.horaLabel === label)?.tooltipLabel || label}
                      formatter={(value: any) => [value.toFixed(3), 'Fator de Potência']}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Line type="monotone" dataKey="fp" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line 
                      yDomain={[0.5, 1]}
                      dataKey={() => targetFP} 
                      stroke="#ef4444" 
                      strokeDasharray="5 5" 
                      dot={false} 
                      strokeWidth={1.5} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* TABELA DE INTERVALOS CRÍTICOS + SIDEBAR */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                  <AlertTriangle size={18} className="text-red-500" />
                  Intervalos Críticos (FP &lt; {targetFP})
                </h3>
                <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded font-bold">
                  {stats?.registrosCriticos} ocorrências
                </span>
              </div>
              
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-4">Data/Hora</th>
                      <th className="pb-4">kW</th>
                      <th className="pb-4">kVAr</th>
                      <th className="pb-4">FP</th>
                      <th className="pb-4">Correção (kVAr)</th>
                      <th className="pb-4">Tipo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data
                      .filter(d => d.fp < targetFP && d.tipoReativo === 'indutivo')
                      .slice(0, 15)
                      .map((row, idx) => (
                        <tr key={idx} className="text-sm hover:bg-slate-50 transition-colors">
                          <td className="py-3 font-medium text-slate-700">{row.data} {row.hora}</td>
                          <td className="py-3 text-slate-600">{row.kw.toFixed(1)}</td>
                          <td className="py-3 text-slate-600">{row.kvar.toFixed(1)}</td>
                          <td className="py-3 font-bold text-red-500">{row.fp.toFixed(3)}</td>
                          <td className="py-3 text-slate-600 font-medium">{row.kvarNecessario > 0 ? `+${row.kvarNecessario}` : '-'}</td>
                          <td className="py-3">
                            <span className={cn(
                              "px-2 py-1 text-[10px] font-bold rounded-md uppercase",
                              row.tipoReativo === 'indutivo' ? "bg-red-50 text-red-600" :
                              row.tipoReativo === 'capacitivo' ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-600"
                            )}>
                              {row.tipoReativo}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              
              {data.filter(d => d.fp < targetFP && d.tipoReativo === 'indutivo').length > 15 && (
                <p className="text-xs text-slate-400 mt-4 text-center">
                  Exibindo 15 de {data.filter(d => d.fp < targetFP && d.tipoReativo === 'indutivo').length} registros críticos
                </p>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-primary p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Zap className="text-secondary" />
                  Cérebro EnergyWise
                </h3>
                <p className="text-white/70 text-sm mb-6 leading-relaxed">
                  {stats?.maxKvarNecessario > 0 
                    ? `Identificamos necessidade de correção de até ${stats.maxKvarNecessario.toFixed(1)} kVAr para manter FP ≥ ${targetFP}.`
                    : "Seu sistema está dentro da conformidade! Mantenha a monitoração."
                  }
                </p>
                
                {stats?.maxKvarNecessario > 0 && (
                  <div className="space-y-4 mb-6">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 p-1 bg-white/10 rounded">
                        <ArrowRight size={14} className="text-secondary" />
                      </div>
                      <p className="text-sm font-medium">
                        Banco sugerido: <span className="text-secondary font-bold">{Math.ceil(stats.maxKvarNecessario / 5) * 5} kVAr</span>
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-1 p-1 bg-white/10 rounded">
                        <ArrowRight size={14} className="text-secondary" />
                      </div>
                      <p className="text-sm font-medium">
                        Controlador automático com medição em tempo real
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-1 p-1 bg-white/10 rounded">
                        <ArrowRight size={14} className="text-secondary" />
                      </div>
                      <p className="text-sm font-medium">
                        Economia estimada: <span className="text-green-300 font-bold">R$ {stats.multaEstimada.toLocaleString('pt-BR', {minimumFractionDigits: 2})}/mês</span>
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="space-y-3">
                  <button 
                    onClick={exportToPDF}
                    disabled={loading}
                    className="w-full bg-secondary text-primary font-bold py-3 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-secondary/20 disabled:opacity-50"
                  >
                    <Download size={18} />
                    Relatório Completo (PDF)
                  </button>
                  <button 
                    onClick={downloadCSV}
                    disabled={loading}
                    className="w-full bg-white/10 text-white border border-white/20 font-bold py-3 rounded-xl hover:bg-white/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <FileDown size={18} />
                    Dados Processados (CSV)
                  </button>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <h4 className="font-bold text-primary mb-4 flex items-center gap-2">
                  <Settings size={16} />
                  Parâmetros ANEEL
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                      Fator de Potência Mínimo (Meta)
                    </label>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0.80" 
                      max="1" 
                      value={targetFP} 
                      onChange={(e) => setTargetFP(Math.min(1, Math.max(0.8, parseFloat(e.target.value) || 0.92)))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Padrão ANEEL: 0.92 indutivo</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                      Tarifa de Energia (R$/kWh)
                    </label>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      value={tariff} 
                      onChange={(e) => setTariff(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Consulte sua fatura para valor exato</p>
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Intervalo detectado:</span>
                      <span className="font-bold text-primary flex items-center gap-1">
                        <Clock size={12} />
                        {samplingInterval} minutos
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h5 className="text-xs font-bold text-slate-400 uppercase mb-3">Legenda</h5>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full" />
                    <span className="text-slate-600">FP abaixo da meta (multa)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                    <span className="text-slate-600">FP conforme (sem multa)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-bold">INDUTIVO</span>
                    <span className="text-slate-600">Reativo que gera multa</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold">CAPACITIVO</span>
                    <span className="text-slate-600">Reativo que pode causar sobretensão</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}