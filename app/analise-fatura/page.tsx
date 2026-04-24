'use client';
import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { 
  Upload, FileText, AlertTriangle, TrendingUp, TrendingDown, Zap, 
  DollarSign, Info, CheckCircle2, ArrowRight, Download, Activity, 
  Cpu, ArrowUpRight, FileDown, Settings, Calendar, Clock, AlertCircle, RefreshCw
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, ReferenceLine
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
  isHorarioCritico?: boolean;
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
  horariosPicoReativo?: { hora: string; mediaKvar: number; ocorrencias: number }[];
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
  orcamentoEstimado: { min: number; max: number };
  alertaTransformador: boolean;
  potenciaInstalada: number;
}

interface PeriodoAnalise {
  nome: string;
  inicio: number;
  fim: number;
  cor: string;
  totalRegistros: number;
  registrosCriticos: number;
  percentualCritico: number;
  fpMedio: number;
  kvarMedio: number;
  nivelCriticidade: string;
}

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

const parseBrazilianNumber = (val: any): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  let str = String(val).trim();
  if (!str || str === '-' || str === '#VALOR!') return 0;
  
  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');
  
  if (lastComma > lastDot) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    str = str.replace(/,/g, '');
  }
  
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const calcularFP = (kw: number, kvar: number): number => {
  const s = Math.sqrt(Math.pow(kw, 2) + Math.pow(kvar, 2));
  return s > 0 ? Math.abs(kw) / s : 1;
};

const calcularCorrecaoNecessaria = (kw: number, fpAtual: number, fpDesejado: number): number => {
  if (kw <= 0) return 0;
  const fpCalculo = Math.max(0.01, Math.abs(fpAtual));
  const phiAtual = Math.acos(Math.min(1, fpCalculo));
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
    
    let fatorAjuste = 0;
    if (reg.kw <= 0.01) {
      fatorAjuste = 1;
    } else {
      const fpCalculo = Math.max(0.01, reg.fp);
      fatorAjuste = Math.max(0, (fpMinimo / fpCalculo) - 1);
    }
    
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

const estimarOrcamento = (kvar: number, tipo: 'fixo' | 'automatico' | 'hibrido'): { min: number, max: number } => {
  if (kvar <= 0) return { min: 0, max: 0 };
  
  const precoKvarFixo = 90;
  const precoKvarAuto = 180;
  const custoControlador = 2500;

  if (tipo === 'fixo') {
    return {
      min: kvar * precoKvarFixo * 0.8,
      max: kvar * precoKvarFixo * 1.2
    };
  } else {
    return {
      min: (kvar * precoKvarAuto + custoControlador) * 0.8,
      max: (kvar * precoKvarAuto + custoControlador) * 1.2
    };
  }
};

const analisarHorariosCriticos = (data: MassMemoryData[]): { hora: string; mediaKvar: number; ocorrencias: number }[] => {
  const horariosMap = new Map<string, { somaKvar: number; count: number }>();
  
  data.forEach(registro => {
    if (registro.tipoReativo === 'indutivo' && registro.kvar > 5) {
      const horaBase = registro.hora.substring(0, 5);
      const existing = horariosMap.get(horaBase);
      if (existing) {
        existing.somaKvar += registro.kvar;
        existing.count++;
      } else {
        horariosMap.set(horaBase, { somaKvar: registro.kvar, count: 1 });
      }
    }
  });
  
  const resultados = Array.from(horariosMap.entries())
    .map(([hora, { somaKvar, count }]) => ({
      hora,
      mediaKvar: somaKvar / count,
      ocorrencias: count
    }))
    .sort((a, b) => b.mediaKvar - a.mediaKvar)
    .slice(0, 10);
  
  return resultados;
};

/**
 * Analisa períodos do dia com pior fator de potência
 */
const analisarPeriodosCriticos = (data: MassMemoryData[], targetFP: number): PeriodoAnalise[] => {
  const periodos = [
    { nome: 'Madrugada (00:00 - 06:00)', inicio: 0, fim: 6, cor: 'bg-slate-100' },
    { nome: 'Início da Manhã (06:00 - 09:00)', inicio: 6, fim: 9, cor: 'bg-blue-50' },
    { nome: 'Meio da Manhã (09:00 - 12:00)', inicio: 9, fim: 12, cor: 'bg-red-50' },
    { nome: 'Início da Tarde (12:00 - 15:00)', inicio: 12, fim: 15, cor: 'bg-orange-50' },
    { nome: 'Final da Tarde (15:00 - 18:00)', inicio: 15, fim: 18, cor: 'bg-amber-50' },
    { nome: 'Noite (18:00 - 22:00)', inicio: 18, fim: 22, cor: 'bg-purple-50' },
    { nome: 'Final da Noite (22:00 - 00:00)', inicio: 22, fim: 24, cor: 'bg-slate-100' }
  ];

  return periodos.map(periodo => {
    const registrosPeriodo = data.filter(reg => {
      const hora = parseInt(reg.hora.split(':')[0]);
      return hora >= periodo.inicio && hora < periodo.fim;
    });

    if (registrosPeriodo.length === 0) {
      return {
        ...periodo,
        totalRegistros: 0,
        registrosCriticos: 0,
        percentualCritico: 0,
        fpMedio: 0,
        kvarMedio: 0,
        nivelCriticidade: 'NORMAL'
      };
    }

    const registrosCriticos = registrosPeriodo.filter(reg => 
      reg.fp < targetFP && reg.tipoReativo === 'indutivo'
    );

    const fpMedio = registrosPeriodo.reduce((acc, reg) => acc + reg.fp, 0) / registrosPeriodo.length;
    const kvarMedio = registrosPeriodo.reduce((acc, reg) => acc + Math.abs(reg.kvar), 0) / registrosPeriodo.length;
    const percentualCritico = (registrosCriticos.length / registrosPeriodo.length) * 100;
    
    let nivelCriticidade = 'NORMAL';
    if (percentualCritico > 50) nivelCriticidade = 'CRÍTICO';
    else if (percentualCritico > 25) nivelCriticidade = 'ATENÇÃO';

    return {
      ...periodo,
      totalRegistros: registrosPeriodo.length,
      registrosCriticos: registrosCriticos.length,
      percentualCritico,
      fpMedio,
      kvarMedio,
      nivelCriticidade
    };
  }).sort((a, b) => b.percentualCritico - a.percentualCritico);
};

const analisarDimensionamento = (
  data: MassMemoryData[],
  targetFP: number,
  potenciaInstalada: number
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
  
  let bancoSugeridoFixo = Math.ceil(mediaKvarCritico / 5) * 5;
  let bancoSugeridoAutomatico = Math.ceil(percentil90KvarCritico / 5) * 5;

  const limiteInstalado = potenciaInstalada > 0 ? potenciaInstalada * 0.4 : Infinity;
  const alertaTransformador = bancoSugeridoAutomatico > limiteInstalado;

  if (alertaTransformador) {
    bancoSugeridoAutomatico = Math.floor(limiteInstalado / 5) * 5;
    bancoSugeridoFixo = Math.min(bancoSugeridoFixo, bancoSugeridoAutomatico);
    justificativa += ` ATENÇÃO: O dimensionamento original excedia 40% da potência instalada (${potenciaInstalada} kVA). O valor foi limitado por segurança.`;
  }

  const orcamentoEstimado = estimarOrcamento(
    tipoRecomendado === 'fixo' ? bancoSugeridoFixo : bancoSugeridoAutomatico, 
    tipoRecomendado
  );

  return {
    mediaKW,
    mediaKvar,
    mediaFP,
    periodosCriticos: periodosCriticos.length,
    percentualCritico: (periodosCriticos.length / data.length) * 100,
    mediaKvarCritico,
    percentil90KvarCritico,
    maxKvarCritico,
    bancoSugeridoFixo,
    bancoSugeridoAutomatico,
    tipoRecomendado,
    justificativa,
    coeficienteVariacao,
    orcamentoEstimado,
    alertaTransformador,
    potenciaInstalada
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
  
  return estagios.sort((a, b) => a - b);
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function AnaliseFaturaPage() {
  const [data, setData] = useState<MassMemoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetFP, setTargetFP] = useState(0.92);
  const [tariff, setTariff] = useState(0.95);
  const [potenciaInstalada, setPotenciaInstalada] = useState<number>(1575);
  const [samplingInterval, setSamplingInterval] = useState(15);
  const [fileName, setFileName] = useState<string>('');
  const [showHorariosCriticos, setShowHorariosCriticos] = useState(false);
  const [recalcKey, setRecalcKey] = useState(0);

  const handleRecalcular = () => {
    setRecalcKey(prev => prev + 1);
    Swal.fire({
      title: '✅ Análise Recalculada!',
      text: `Dimensionamento atualizado com potência instalada de ${potenciaInstalada} kVA`,
      icon: 'success',
      timer: 2000,
      showConfirmButton: false
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      
      const lines = content.split('\n');
      let headerIndex = lines.findIndex(line => {
        const lower = line.toLowerCase();
        const hasData = lower.includes('data') || lower.includes('date');
        const hasTime = lower.includes('hora') || lower.includes('time') || lower.includes('horário');
        const hasEnergy = lower.includes('kw') || lower.includes('kvar') || lower.includes('ativa') || lower.includes('reativa') || lower.includes('consumo') || lower.includes('demanda');
        return hasData && (hasTime || hasEnergy) && (line.includes(';') || line.includes(','));
      });
      
      if (headerIndex === -1) {
        headerIndex = lines.findIndex(line => {
          const lower = line.toLowerCase();
          const parts = line.split(/[,;]/);
          return lower.includes('data') && parts.length >= 3 && !lower.includes('leitora') && !lower.includes('modelo');
        });
      }
      
      if (headerIndex === -1) {
        headerIndex = lines.findIndex(line => 
          (line.includes(';') || line.includes(',')) && 
          !line.toLowerCase().includes('leitora') && 
          !line.toLowerCase().includes('modelo')
        );
      }
      
      if (headerIndex === -1) {
        setLoading(false);
        Swal.fire('Erro', 'Não foi possível encontrar o cabeçalho com "Data" e "Hora" (ou kW/kVAr) no arquivo.', 'error');
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

              const kw = parseBrazilianNumber(getVal(['kw fornecido', 'ativa(kw)', 'kw', 'ativa', 'demanda ativa', 'consumo ativo', 'potencia ativa', 'canal 1', 'ch1', 'ch 1']));
              let kvar = parseBrazilianNumber(getVal(['kvar indutivo', 'kvar capacitivo', 'reativa(kvar)', 'kvar', 'reativa', 'consumo reativo', 'potencia reativa', 'canal 2', 'ch2', 'ch 2']));
              
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
              
              const isHorarioCritico = tipoReativo === 'indutivo' && kvar > 5 && fp < targetFP;

              return {
                data: fullDate,
                hora: hora,
                timestamp,
                kw,
                kvar,
                fp: Math.round(fp * 100) / 100,
                kvarNecessario,
                tipoReativo,
                isHorarioCritico
              };
            });

            const validData = processed.filter(d => d.kw > 0 || d.kvar !== 0);

            if (validData.length === 0) {
              const columns = results.meta.fields ? results.meta.fields.join(', ') : 'Nenhuma';
              throw new Error(`Nenhum dado de consumo (kW) válido encontrado. Colunas detectadas: ${columns}`);
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
      'Horário Crítico': d.isHorarioCritico ? 'SIM' : 'NÃO',
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

  const horariosCriticos = useMemo(() => {
    if (data.length === 0) return [];
    return analisarHorariosCriticos(data);
  }, [data]);

  const periodosAnalise = useMemo(() => {
    if (data.length === 0) return [];
    return analisarPeriodosCriticos(data, targetFP);
  }, [data, targetFP]);

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
      periodoAnalise,
      horariosPicoReativo: horariosCriticos
    };
  }, [data, tariff, targetFP, samplingInterval, horariosCriticos]);

  const dimensionamento: DimensionamentoStats | null = useMemo(() => {
    if (data.length === 0) return null;
    return analisarDimensionamento(data, targetFP, potenciaInstalada);
  }, [data, targetFP, potenciaInstalada, recalcKey]);

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

  const piorPeriodo = periodosAnalise.length > 0 ? periodosAnalise[0] : null;

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
            Análise Avançada • ANEEL 414/2010
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
            Memória de Massa
          </h1>
          <p className="text-lg text-white/70 leading-relaxed">
            Transforme dados brutos em economia real. Detectamos reativo excedente, calculamos multas conforme ANEEL e sugerimos a correção exata.
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
          
          {/* HORÁRIOS CRÍTICOS DETALHADOS */}
          {horariosCriticos.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-red-50 to-orange-50 p-8 rounded-3xl border border-red-200"
            >
              <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <h3 className="text-2xl font-bold text-red-800 flex items-center gap-2">
                  <AlertCircle size={24} />
                  Horários de Baixo Fator de Potência (Reativo Indutivo)
                </h3>
                <span className="text-xs bg-red-200 text-red-700 px-3 py-1 rounded-full font-bold">
                  Multa aplicável pela ANEEL
                </span>
              </div>
              
              <p className="text-red-700 mb-4 text-sm">
                ⚠️ Nestes horários o fator de potência ficou abaixo de {targetFP} com consumo de reativo indutivo, gerando multa conforme Resolução ANEEL 414/2010.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {horariosCriticos.map((horario, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-red-500" />
                        <span className="font-mono text-lg font-bold text-red-700">{horario.hora}</span>
                      </div>
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                        {horario.ocorrencias} ocorrências
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Média de Reativo:</span>
                        <span className="font-bold text-red-600">{horario.mediaKvar.toFixed(1)} kVAr</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div 
                          className="bg-red-500 h-1.5 rounded-full" 
                          style={{ width: `${Math.min(100, (horario.mediaKvar / 100) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      💡 Recomendação: Instalar banco de capacitores automático para correção neste período
                    </p>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-3 bg-red-100 rounded-lg">
                <p className="text-xs text-red-700 flex items-center gap-2">
                  <Info size={14} />
                  O reativo indutivo é gerado por equipamentos como motores, ar condicionado, transformadores e reatores magnéticos.
                </p>
              </div>
            </motion.div>
          )}

          {/* ANÁLISE POR PERÍODO DO DIA - NOVO COMPONENTE */}
          {periodosAnalise.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-3xl border border-blue-200"
            >
              <h3 className="text-2xl font-bold text-primary mb-6 flex items-center gap-2">
                <Clock size={24} />
                Análise por Período do Dia
              </h3>
              
              <p className="text-slate-600 mb-6 text-sm">
                📊 Identificação dos períodos mais críticos para instalação de banco de capacitores
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {periodosAnalise.map((periodo, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "rounded-xl p-4 border-2 transition-all",
                      periodo.nivelCriticidade === 'CRÍTICO' ? "border-red-400 bg-red-50" :
                      periodo.nivelCriticidade === 'ATENÇÃO' ? "border-amber-400 bg-amber-50" :
                      "border-green-400 bg-green-50"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-slate-700">{periodo.nome}</span>
                      <span className={cn(
                        "text-xs font-bold px-2 py-1 rounded-full",
                        periodo.nivelCriticidade === 'CRÍTICO' ? "bg-red-500 text-white" :
                        periodo.nivelCriticidade === 'ATENÇÃO' ? "bg-amber-500 text-white" :
                        "bg-green-500 text-white"
                      )}>
                        {periodo.nivelCriticidade}
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">FP Médio:</span>
                        <span className={cn(
                          "font-bold",
                          periodo.fpMedio < targetFP ? "text-red-600" : "text-green-600"
                        )}>
                          {(periodo.fpMedio * 100).toFixed(1)}%
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-slate-500">kVAr Médio:</span>
                        <span className="font-bold text-primary">{periodo.kvarMedio.toFixed(1)} kVAr</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-slate-500">Registros Críticos:</span>
                        <span className="font-bold text-red-600">
                          {periodo.registrosCriticos} / {periodo.totalRegistros}
                        </span>
                      </div>
                      
                      <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                        <div 
                          className={cn(
                            "h-2 rounded-full",
                            periodo.nivelCriticidade === 'CRÍTICO' ? "bg-red-500" :
                            periodo.nivelCriticidade === 'ATENÇÃO' ? "bg-amber-500" :
                            "bg-green-500"
                          )}
                          style={{ width: `${periodo.percentualCritico}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 text-center">
                        {periodo.percentualCritico.toFixed(1)}% do período em FP baixo
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Resumo da recomendação baseada no pior período */}
              {piorPeriodo && (
                <div className="mt-6 p-4 bg-white rounded-xl border border-blue-200">
                  <h4 className="font-bold text-primary mb-2 flex items-center gap-2">
                    <Zap size={18} className="text-secondary" />
                    Recomendação de Instalação
                  </h4>
                  {piorPeriodo.nivelCriticidade === 'CRÍTICO' && (
                    <p className="text-sm text-slate-700">
                      ⚠️ O período mais crítico é <strong>{piorPeriodo.nome}</strong> com 
                      <strong className="text-red-600"> {piorPeriodo.percentualCritico.toFixed(1)}%</strong> do tempo com FP abaixo de {targetFP}.
                      <br />
                      💡 Recomenda-se instalar banco de capacitores <strong>automático</strong> com atuação prioritária neste período.
                    </p>
                  )}
                  {piorPeriodo.nivelCriticidade === 'ATENÇÃO' && (
                    <p className="text-sm text-slate-700">
                      ⚠️ O período que requer atenção é <strong>{piorPeriodo.nome}</strong> com 
                      <strong className="text-amber-600"> {piorPeriodo.percentualCritico.toFixed(1)}%</strong> do tempo com FP abaixo de {targetFP}.
                      <br />
                      💡 Considere instalar banco de capacitores ou ajustar a carga neste período.
                    </p>
                  )}
                  {piorPeriodo.nivelCriticidade === 'NORMAL' && (
                    <p className="text-sm text-slate-700">
                      ✅ Todos os períodos estão dentro da conformidade. 
                      Não há necessidade urgente de instalação de banco de capacitores.
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          )}

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
                R$ {stats?.multaEstimada.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              <p className="text-3xl font-bold text-slate-900">{stats?.fpMedio.toFixed(3)}</p>
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
              <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <h3 className="text-2xl font-bold text-primary flex items-center gap-2">
                  <Cpu size={24} />
                  Análise de Dimensionamento Inteligente
                </h3>
                <button
                  onClick={handleRecalcular}
                  className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-all text-sm font-bold shadow-md"
                >
                  <RefreshCw size={16} />
                  Recalcular
                </button>
              </div>
              
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
                    {dimensionamento.potenciaInstalada > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Potência Instalada:</span>
                        <span className="font-medium text-primary">{dimensionamento.potenciaInstalada} kVA</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm">
                <h4 className="text-sm font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <Info size={16} />
                  Justificativa Técnica
                </h4>
                <p className="text-slate-700 leading-relaxed">{dimensionamento.justificativa}</p>
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

              {/* ORÇAMENTO ESTIMADO */}
              <div className="mt-6 bg-white p-6 rounded-2xl shadow-sm border-2 border-green-500">
                <h4 className="text-sm font-bold text-green-600 uppercase mb-4 flex items-center gap-2">
                  <DollarSign size={16} />
                  Orçamento Estimado
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Investimento Mínimo:</span>
                      <span className="font-bold text-lg text-slate-900">
                        R$ {dimensionamento.orcamentoEstimado.min.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Investimento Máximo:</span>
                      <span className="font-bold text-lg text-slate-900">
                        R$ {dimensionamento.orcamentoEstimado.max.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3 md:border-l md:border-slate-100 md:pl-6">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Payback Estimado:</span>
                      <span className="font-bold text-green-600 text-lg">
                        {stats?.multaEstimada && stats.multaEstimada > 0 
                          ? `${(dimensionamento.orcamentoEstimado.max / stats.multaEstimada).toFixed(1)} meses` 
                          : 'N/A'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      * Valores baseados em estimativas de mercado.
                    </p>
                  </div>
                </div>
              </div>
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
                    <ReferenceLine 
                      y={targetFP} 
                      stroke="#ef4444" 
                      strokeDasharray="5 5" 
                      strokeWidth={1.5} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          {/* CARD DE OBSERVAÇÃO TÉCNICA - ADICIONE ESTE BLOCO */}
{dimensionamento && (
  <motion.div 
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="bg-amber-50 border-2 border-amber-200 p-6 rounded-3xl mt-6 shadow-sm"
  >
    <div className="flex items-start gap-4">
      <div className="bg-amber-100 p-3 rounded-full text-amber-600">
        <AlertTriangle size={24} />
      </div>
      <div className="space-y-2">
        <h4 className="text-amber-900 font-bold text-lg flex items-center gap-2">
          Observação de Instalação do Banco
        </h4>
        <p className="text-amber-800 leading-relaxed">
          O sistema solicita <strong>{dimensionamento.tipoRecomendado === 'fixo' ? dimensionamento.bancoSugeridoFixo : dimensionamento.bancoSugeridoAutomatico} kVAr</strong> para corrigir o fator de potência, mas verifique as configurações de instalação do seu banco existente se houver, para ver a real necessidade.
        </p>
        <div className="pt-2 flex items-center gap-2 text-xs text-amber-700 font-medium italic">
          <Info size={14} />
          <span>Nota técnica: Se houver capacitores fixos instalados após o ponto de medição (TC), a necessidade real pode ser diferente do valor calculado.</span>
        </div>
      </div>
    </div>
  </motion.div>
)}

          {/* TABELA DE INTERVALOS CRÍTICOS + SIDEBAR */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                  <AlertTriangle size={18} className="text-red-500" />
                  Intervalos Críticos (FP &lt; {targetFP} e Reativo Indutivo)
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
                          <td className="py-3 font-bold text-red-600">{row.kvar.toFixed(1)}</td>
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
              {/* PAINEL DE POTÊNCIA INSTALADA COM BOTÃO RECALCULAR */}
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <h4 className="font-bold text-primary mb-4 flex items-center gap-2">
                  <Settings size={16} />
                  Configuração da Instalação
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 block flex items-center justify-between">
                      <span>Potência Instalada Total (kVA)</span>
                      <button
                        onClick={handleRecalcular}
                        className="flex items-center gap-1 bg-primary text-white px-3 py-1 rounded-lg hover:bg-primary/90 transition-all text-xs"
                      >
                        <RefreshCw size={12} />
                        Recalcular
                      </button>
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        step="10" 
                        min="0" 
                        value={potenciaInstalada} 
                        onChange={(e) => setPotenciaInstalada(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Exemplo: 7 trafos × 225kVA = 1575 kVA
                    </p>
                  </div>
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
                    <p className="text-[10px] text-slate-400 mt-1">Padrão ANEEL: 0.92 | Grupo A: todo reativo é cobrado</p>
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
                    {potenciaInstalada > 0 && (
                      <div className="flex items-center justify-between text-sm mt-2">
                        <span className="text-slate-500">Limite seguro (40%):</span>
                        <span className="font-bold text-primary">
                          {Math.floor(potenciaInstalada * 0.4)} kVAr
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-primary p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Zap className="text-secondary" />
                  Cérebro EnergyWise
                </h3>
                <p className="text-white/70 text-sm mb-6 leading-relaxed">
                  {(stats?.maxKvarNecessario ?? 0) > 0 
                    ? `Identificamos necessidade de correção de até ${stats?.maxKvarNecessario?.toFixed(1)} kVAr para manter FP ≥ ${targetFP}.`
                    : "Seu sistema está dentro da conformidade! Mantenha a monitoração."
                  }
                </p>
                
                {(stats?.maxKvarNecessario ?? 0) > 0 && (
                  <div className="space-y-4 mb-6">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 p-1 bg-white/10 rounded">
                        <ArrowRight size={14} className="text-secondary" />
                      </div>
                      <p className="text-sm font-medium">
                        Banco sugerido: <span className="text-secondary font-bold">{dimensionamento?.bancoSugeridoAutomatico || Math.ceil((stats?.maxKvarNecessario ?? 0) / 5) * 5} kVAr</span>
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
                        Economia estimada: <span className="text-green-300 font-bold">R$ {(stats?.multaEstimada ?? 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}/mês</span>
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
