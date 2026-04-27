'use client';
import React, { useState, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { 
  Upload, FileText, AlertTriangle, TrendingUp, TrendingDown, Zap, 
  DollarSign, Info, CheckCircle2, ArrowRight, Download, Activity, 
  Cpu, ArrowUpRight, FileDown, Settings, Calendar, Clock, AlertCircle, 
  RefreshCw, Battery, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area, ReferenceLine
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
  diaSemana?: string;
}

interface AnalysisStats {
  totalExcedenteKvarh: number;
  multaEstimada: number;
  multaIndutiva: number;
  multaCapacitiva: number;
  picoDemanda: number;
  fpMedio: number;
  maxKvarNecessario: number;
  registrosCriticos: number;
  percentualConformidade: number;
  periodoAnalise: { inicio: string; fim: string };
  horariosPicoReativo?: { hora: string; mediaKvar: number; ocorrencias: number }[];
  causaPrincipalMulta: 'indutivo' | 'capacitivo' | 'ambos' | 'nenhum';
  percentualMultaIndutiva: number;
  percentualMultaCapacitiva: number;
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
  economiaMensalEstimada: number;
  paybackMeses: number;
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

interface AnaliseDiaSemana {
  dia: string;
  kvarMedio: number;
  count: number;
  multa: number;
}

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

const diasSemana = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const getDiaSemana = (dataStr: string): string => {
  if (!dataStr || dataStr === '') return 'Desconhecido';
  try {
    let dia: number, mes: number, ano: number;
    if (dataStr.includes('/')) {
      const partes = dataStr.split('/');
      if (partes.length === 3) {
        dia = parseInt(partes[0]);
        mes = parseInt(partes[1]) - 1;
        ano = parseInt(partes[2]);
        if (ano < 100) ano = 2000 + ano;
        const data = new Date(ano, mes, dia);
        if (!isNaN(data.getTime())) {
          const diaNum = data.getDay();
          return diasSemana[diaNum === 0 ? 6 : diaNum - 1];
        }
      }
    }
    if (dataStr.includes('-')) {
      const partes = dataStr.split('-');
      if (partes.length === 3) {
        ano = parseInt(partes[0]);
        mes = parseInt(partes[1]) - 1;
        dia = parseInt(partes[2]);
        const data = new Date(ano, mes, dia);
        if (!isNaN(data.getTime())) {
          const diaNum = data.getDay();
          return diasSemana[diaNum === 0 ? 6 : diaNum - 1];
        }
      }
    }
    const data = new Date(dataStr);
    if (!isNaN(data.getTime())) {
      const diaNum = data.getDay();
      return diasSemana[diaNum === 0 ? 6 : diaNum - 1];
    }
    return 'Desconhecido';
  } catch {
    return 'Desconhecido';
  }
};

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

const calcularMultaANEELDetalhada = (
  registros: MassMemoryData[], 
  tarifa: number, 
  fpMinimo: number,
  samplesPerHour: number
): { total: number; indutiva: number; capacitiva: number } => {
  let totalIndutivo = 0;
  let totalCapacitivo = 0;
  
  registros.forEach(reg => {
    if (reg.fp >= fpMinimo) return;
    
    let fatorAjuste = 1;
    if (reg.kw > 0.01) {
      const fpCalculo = Math.max(0.01, reg.fp);
      fatorAjuste = Math.max(0, (fpMinimo / fpCalculo) - 1);
    }
    
    const kvarhIntervalo = Math.abs(reg.kvar) / samplesPerHour;
    const multaParcial = kvarhIntervalo * tarifa * fatorAjuste;
    
    if (reg.tipoReativo === 'indutivo') {
      totalIndutivo += multaParcial;
    } else if (reg.tipoReativo === 'capacitivo') {
      totalCapacitivo += multaParcial;
    }
  });
  
  return {
    total: totalIndutivo + totalCapacitivo,
    indutiva: totalIndutivo,
    capacitiva: totalCapacitivo
  };
};

const detectSamplingInterval = (data: MassMemoryData[]): number => {
  if (data.length < 2) return 15;
  
  const diffMinutes: number[] = [];
  for (let i = 0; i < Math.min(data.length - 1, 50); i++) {
    const t1 = new Date(data[i].timestamp);
    const t2 = new Date(data[i + 1].timestamp);
    if (!isNaN(t1.getTime()) && !isNaN(t2.getTime())) {
      const diff = Math.abs(t2.getTime() - t1.getTime()) / (1000 * 60);
      if (diff > 0 && diff <= 60) {
        diffMinutes.push(diff);
      }
    }
  }
  
  if (diffMinutes.length === 0) return 15;
  const median = diffMinutes.sort((a, b) => a - b)[Math.floor(diffMinutes.length / 2)];
  return Math.round(median);
};

const getPercentile = (arr: number[], percentile: number): number => {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

const estimarOrcamento = (kvar: number, tipo: 'fixo' | 'automatico' | 'hibrido'): { min: number; max: number } => {
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
  potenciaInstalada: number,
  multaMensal: number = 0
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
  
  const paybackMeses = multaMensal > 0 && bancoSugeridoAutomatico > 0 
    ? Math.ceil(orcamentoEstimado.max / multaMensal) 
    : 0;

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
    potenciaInstalada,
    economiaMensalEstimada: multaMensal,
    paybackMeses
  };
};

const gerarEstagios = (totalKvar: number): number[] => {
  if (totalKvar <= 0) return [];
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
  
  if (estagios.length > 3 && estagios[estagios.length - 1] === estagios[0]) {
    const lastIndex = estagios.length - 1;
    if (estagios[lastIndex] > 10) {
      estagios[lastIndex] = Math.floor(estagios[lastIndex] / 2);
      if (estagios[lastIndex] < 5) estagios[lastIndex] = 5;
    }
  }
  
  return estagios.sort((a, b) => a - b);
};

// ============================================================================
// COMPONENTES DE ALERTA
// ============================================================================

const AlertaMultaCapacitiva = ({ multaCapacitiva }: { multaCapacitiva: number }) => {
  if (multaCapacitiva <= 0) return null;
  
  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl mb-6">
      <div className="flex items-start gap-3">
        <Battery size={20} className="text-blue-600 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-blue-800">⚠️ ATENÇÃO: Multa por Reativo Capacitivo Detectada!</p>
          <p className="text-sm text-blue-700 mt-1">
            Sua instalação está com <strong>SOBRECORREÇÃO</strong> (excesso de capacitores ligados). 
            O reativo capacitivo está gerando multa de <strong>R$ {multaCapacitiva.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.
          </p>
          <p className="text-xs text-blue-600 mt-2">
            💡 <strong>Solução:</strong> Desligue ou reduza o banco de capacitores existente. NÃO adicione mais capacitores.
          </p>
        </div>
      </div>
    </div>
  );
};

const AlertaMultaIndutiva = ({ multaIndutiva }: { multaIndutiva: number }) => {
  if (multaIndutiva <= 0) return null;
  
  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl mb-6">
      <div className="flex items-start gap-3">
        <Zap size={20} className="text-red-600 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-red-800">⚠️ Multa por Reativo Indutivo Detectada!</p>
          <p className="text-sm text-red-700 mt-1">
            O reativo indutivo está gerando multa de <strong>R$ {multaIndutiva.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.
          </p>
          <p className="text-xs text-red-600 mt-2">
            💡 <strong>Solução:</strong> Instale um banco de capacitores para corrigir o fator de potência.
          </p>
        </div>
      </div>
    </div>
  );
};

const LoadingOverlay = () => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white p-8 rounded-2xl flex flex-col items-center gap-4 shadow-2xl">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-600 font-medium">Processando arquivo...</p>
      <p className="text-xs text-slate-400">Isso pode levar alguns segundos</p>
    </div>
  </div>
);

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function AnaliseFaturaPage() {
  const [data, setData] = useState<MassMemoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetFP, setTargetFP] = useState(0.92);
  const [tariff, setTariff] = useState(0.306);
  const [potenciaInstalada, setPotenciaInstalada] = useState<number>(1575);
  const [samplingInterval, setSamplingInterval] = useState(15);
  const [fileName, setFileName] = useState<string>('');
  const [recalcKey, setRecalcKey] = useState(0);

  const handleRecalcular = useCallback(() => {
    setRecalcKey(prev => prev + 1);
    Swal.fire({
      title: '✅ Análise Recalculada!',
      text: `Dimensionamento atualizado com potência instalada de ${potenciaInstalada} kVA`,
      icon: 'success',
      timer: 2000,
      showConfirmButton: false
    });
  }, [potenciaInstalada]);

  const handleClearData = useCallback(() => {
    Swal.fire({
      title: 'Limpar dados?',
      text: 'Todos os dados serão removidos do sistema.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, limpar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        setData([]);
        setFileName('');
        Swal.fire('✅ Dados limpos!', 'Faça upload de um novo arquivo.', 'success');
      }
    });
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
        const hasEnergy = lower.includes('kw') || lower.includes('kvar') || lower.includes('ativa') || lower.includes('reativa');
        return hasData && (hasTime || hasEnergy) && (line.includes(';') || line.includes(','));
      });
      
      if (headerIndex === -1) {
        headerIndex = lines.findIndex(line => {
          const lower = line.toLowerCase();
          const parts = line.split(/[,;]/);
          return lower.includes('data') && parts.length >= 3;
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
              
              const kvarAbs = Math.abs(kvar);
              const fp = calcularFP(kw, kvarAbs);
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
              const diaSemana = getDiaSemana(fullDate);
              const isHorarioCritico = tipoReativo === 'indutivo' && kvarAbs > 5 && fp < targetFP;

              return {
                data: fullDate,
                hora: hora,
                timestamp,
                kw,
                kvar: kvarAbs,
                fp: Math.round(fp * 100) / 100,
                kvarNecessario,
                tipoReativo,
                isHorarioCritico,
                diaSemana
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

    reader.readAsText(file, 'ISO-8859-1');
  }, [targetFP]);

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
      
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const imgWidth = img.width;
      const imgHeight = img.height;
      const ratio = pdfWidth / imgWidth;
      
      pdf.addImage(dataUrl, 'PNG', 0, 10, pdfWidth, imgHeight * ratio);
      
      const dataAtual = new Date().toISOString().slice(0, 10).split('-').reverse().join('/');
      pdf.save(`Relatorio_CapacitorManager_${dataAtual}.pdf`);
      
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
      'Dia Semana': d.diaSemana,
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
    link.setAttribute('download', `dados_processados_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    Swal.fire('Sucesso', 'CSV exportado com sucesso!', 'success');
  };

  const horariosCriticos = useMemo(() => {
    if (data.length === 0) return [];
    return analisarHorariosCriticos(data);
  }, [data]);

  const periodosAnalise = useMemo(() => {
    if (data.length === 0) return [];
    return analisarPeriodosCriticos(data, targetFP);
  }, [data, targetFP]);

  const analiseDiasSemana = useMemo((): AnaliseDiaSemana[] => {
    if (data.length === 0) return [];
    
    const diasMap = new Map<string, { somaKvar: number; count: number; multa: number }>();
    const samplesPerHour = 60 / samplingInterval;
    
    diasSemana.forEach(dia => {
      diasMap.set(dia, { somaKvar: 0, count: 0, multa: 0 });
    });
    
    data.forEach(reg => {
      const dia = reg.diaSemana || getDiaSemana(reg.data);
      const info = diasMap.get(dia);
      if (info) {
        info.somaKvar += reg.kvar;
        info.count++;
        if (reg.fp < targetFP && reg.tipoReativo === 'indutivo') {
          const fpCalculo = Math.max(0.01, reg.fp);
          const fatorAjuste = Math.max(0, (targetFP / fpCalculo) - 1);
          const kvarh = reg.kvar / samplesPerHour;
          info.multa += kvarh * tariff * fatorAjuste;
        }
      }
    });
    
    return diasSemana.map(dia => {
      const info = diasMap.get(dia)!;
      return {
        dia,
        kvarMedio: info.count > 0 ? info.somaKvar / info.count : 0,
        count: info.count,
        multa: info.multa
      };
    }).filter(d => d.count > 0);
  }, [data, targetFP, tariff, samplingInterval]);

  const stats: AnalysisStats | null = useMemo(() => {
    if (data.length === 0) return null;

    const samplesPerHour = 60 / samplingInterval;
    const multaDetalhada = calcularMultaANEELDetalhada(data, tariff, targetFP, samplesPerHour);
    const registrosIndutivos = data.filter(d => d.tipoReativo === 'indutivo');
    
    const totalExcedenteKvarh = registrosIndutivos
      .filter(d => d.fp < targetFP)
      .reduce((acc, curr) => acc + Math.abs(curr.kvar), 0) / samplesPerHour;
    
    const picoDemanda = Math.max(...data.map(d => d.kw));
    const fpMedio = data.reduce((acc, curr) => acc + curr.fp, 0) / data.length;
    const maxKvarNecessario = Math.max(...data.map(d => d.kvarNecessario), 0);
    
    const registrosCriticos = data.filter(d => d.fp < targetFP && d.tipoReativo === 'indutivo').length;
    const percentualConformidade = ((data.length - registrosCriticos) / data.length) * 100;

    const periodoAnalise = {
      inicio: `${data[0].data} ${data[0].hora}`,
      fim: `${data[data.length - 1].data} ${data[data.length - 1].hora}`
    };
    
    const percentualMultaIndutiva = multaDetalhada.total > 0 
      ? (multaDetalhada.indutiva / multaDetalhada.total) * 100 
      : 0;
    const percentualMultaCapacitiva = multaDetalhada.total > 0 
      ? (multaDetalhada.capacitiva / multaDetalhada.total) * 100 
      : 0;
    
    let causaPrincipalMulta: 'indutivo' | 'capacitivo' | 'ambos' | 'nenhum' = 'nenhum';
    if (multaDetalhada.total > 0) {
      if (percentualMultaIndutiva > 70) causaPrincipalMulta = 'indutivo';
      else if (percentualMultaCapacitiva > 70) causaPrincipalMulta = 'capacitivo';
      else causaPrincipalMulta = 'ambos';
    }

    return {
      totalExcedenteKvarh,
      multaEstimada: multaDetalhada.total,
      multaIndutiva: multaDetalhada.indutiva,
      multaCapacitiva: multaDetalhada.capacitiva,
      picoDemanda,
      fpMedio,
      maxKvarNecessario,
      registrosCriticos,
      percentualConformidade,
      periodoAnalise,
      horariosPicoReativo: horariosCriticos,
      causaPrincipalMulta,
      percentualMultaIndutiva,
      percentualMultaCapacitiva
    };
  }, [data, tariff, targetFP, samplingInterval, horariosCriticos]);

  const dimensionamento: DimensionamentoStats | null = useMemo(() => {
    if (data.length === 0) return null;
    return analisarDimensionamento(data, targetFP, potenciaInstalada, stats?.multaEstimada || 0);
  }, [data, targetFP, potenciaInstalada, stats?.multaEstimada, recalcKey]);

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

  if (loading) return <LoadingOverlay />;

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
            Capacitor Manager
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
                <button 
                  onClick={handleClearData}
                  className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 rounded-xl font-bold hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={20} />
                  Limpar
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
          
          {/* ALERTAS ESPECÍFICOS POR TIPO DE MULTA */}
          <AlertaMultaIndutiva multaIndutiva={stats?.multaIndutiva || 0} />
          <AlertaMultaCapacitiva multaCapacitiva={stats?.multaCapacitiva || 0} />

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
            </motion.div>
          )}

          {/* ANÁLISE POR DIA DA SEMANA */}
          {analiseDiasSemana.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-green-50 to-teal-50 p-8 rounded-3xl border border-green-200"
            >
              <h3 className="text-2xl font-bold text-primary mb-6 flex items-center gap-2">
                <Calendar size={24} />
                Análise por Dia da Semana
              </h3>
              
              <div className="space-y-3">
                {analiseDiasSemana.map((dia, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
                      <span className="font-bold text-slate-700 w-24">{dia.dia}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-500">kVAr Médio</span>
                          <span className="text-red-600 font-bold">{dia.kvarMedio.toFixed(1)} kVAr</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div 
                            className="bg-red-500 h-2 rounded-full" 
                            style={{ width: `${Math.min(100, (dia.kvarMedio / 50) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <p className="text-xs text-slate-500">Multa Estimada</p>
                        <p className="text-sm font-bold text-red-600">R$ {dia.multa.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ANÁLISE POR PERÍODO DO DIA */}
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
                    </div>
                  </div>
                ))}
              </div>

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
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-50 rounded-lg text-red-600">
                  <DollarSign size={20} />
                </div>
                <span className="text-sm font-medium text-slate-500">Multa Estimada</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                R$ {stats?.multaEstimada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                  <Zap size={20} />
                </div>
                <span className="text-sm font-medium text-slate-500">Pico de Demanda</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{stats?.picoDemanda.toFixed(1)} kW</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                  <TrendingUp size={20} />
                </div>
                <span className="text-sm font-medium text-slate-500">FP Médio</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{stats?.fpMedio.toFixed(3)}</p>
              <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5">
                <div 
                  className={cn("h-1.5 rounded-full", (stats?.fpMedio || 0) < targetFP ? "bg-red-500" : "bg-green-500")}
                  style={{ width: `${(stats?.fpMedio || 0) * 100}%` }}
                />
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-50 rounded-lg text-green-600">
                  <CheckCircle2 size={20} />
                </div>
                <span className="text-sm font-medium text-slate-500">Conformidade</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{stats?.percentualConformidade.toFixed(1)}%</p>
            </div>
          </div>

          {/* DIMENSIONAMENTO */}
          {dimensionamento && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-3xl border border-blue-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-primary flex items-center gap-2">
                  <Cpu size={24} />
                  Dimensionamento do Banco
                </h3>
                <button onClick={handleRecalcular} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg">
                  <RefreshCw size={16} />
                  Recalcular
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl">
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

                <div className="bg-white p-6 rounded-2xl">
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
                      <span className="font-bold">{dimensionamento.coeficienteVariacao.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border-2 border-secondary">
                  <h4 className="text-sm font-bold text-secondary uppercase mb-4">Recomendação</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Tipo:</span>
                      <span className="px-2 py-1 rounded text-xs font-bold uppercase bg-blue-100 text-blue-700">
                        {dimensionamento.tipoRecomendado}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Capacidade:</span>
                      <span className="font-bold text-2xl text-primary">{dimensionamento.bancoSugeridoAutomatico} kVAr</span>
                    </div>
                    {dimensionamento.paybackMeses > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Payback:</span>
                        <span className="font-bold text-green-600">{dimensionamento.paybackMeses} meses</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl">
                <p className="text-slate-700 leading-relaxed">{dimensionamento.justificativa}</p>
              </div>

              {dimensionamento.tipoRecomendado !== 'fixo' && dimensionamento.bancoSugeridoAutomatico > 0 && (
                <div className="mt-6 bg-white p-6 rounded-2xl">
                  <h4 className="text-sm font-bold text-slate-400 uppercase mb-4">Estágios Recomendados</h4>
                  <div className="flex flex-wrap gap-3">
                    {gerarEstagios(dimensionamento.bancoSugeridoAutomatico).map((estagio, idx) => (
                      <div key={idx} className="bg-blue-50 px-4 py-2 rounded-lg">
                        <span className="text-xs">Estágio {idx + 1}:</span>
                        <span className="font-bold text-blue-700 ml-2">{estagio} kVAr</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 bg-white p-6 rounded-2xl border-2 border-green-500">
                <h4 className="text-sm font-bold text-green-600 uppercase mb-4">Orçamento Estimado</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Investimento:</span>
                      <span className="font-bold text-lg">
                        R$ {dimensionamento.orcamentoEstimado.min.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - R$ {dimensionamento.orcamentoEstimado.max.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Economia Mensal:</span>
                      <span className="font-bold text-green-600 text-lg">
                        R$ {dimensionamento.economiaMensalEstimada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* GRÁFICOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-primary mb-6">Curva de Carga (kW)</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.slice(0, 500)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="horaLabel" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="kw" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-primary mb-6">Fator de Potência</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.slice(0, 500)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="horaLabel" />
                    <YAxis domain={[0.5, 1]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="fp" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <ReferenceLine y={targetFP} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Meta', fill: '#ef4444', fontSize: 10 }} />
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

          {/* CONFIGURAÇÃO E RESUMO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100">
              <h4 className="font-bold text-primary mb-4 flex items-center gap-2">
                <Settings size={16} />
                Configuração
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                    Potência Instalada (kVA)
                  </label>
                  <input 
                    type="number" 
                    step="10" 
                    value={potenciaInstalada} 
                    onChange={(e) => setPotenciaInstalada(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border rounded-lg px-4 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                    Meta Fator de Potência
                  </label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0.7" 
                    max="0.99" 
                    value={targetFP} 
                    onChange={(e) => setTargetFP(parseFloat(e.target.value) || 0.92)}
                    className="w-full bg-slate-50 border rounded-lg px-4 py-2"
                  />
                </div>
                <button onClick={handleRecalcular} className="w-full bg-primary text-white py-2 rounded-lg">
                  Recalcular
                </button>
              </div>
            </div>

            <div className="bg-primary p-6 rounded-3xl text-white shadow-xl col-span-2 relative overflow-hidden">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Zap className="text-secondary" />
                Resumo Executivo
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-white/60 text-xs">Multa Mensal</p>
                  <p className="text-xl font-bold">R$ {stats?.multaEstimada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs">Banco Recomendado</p>
                  <p className="text-xl font-bold">{dimensionamento?.bancoSugeridoAutomatico || 0} kVAr</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs">Payback</p>
                  <p className="text-xl font-bold">{dimensionamento?.paybackMeses || 0} meses</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs">Conformidade</p>
                  <p className="text-xl font-bold">{stats?.percentualConformidade.toFixed(0)}%</p>
                </div>
              </div>
              <button onClick={exportToPDF} className="w-full bg-secondary text-primary font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                <Download size={18} /> Exportar PDF
              </button>
            </div>
          </div>

          {/* TABELA DE REGISTROS CRÍTICOS */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-primary mb-6 flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" />
              Top 10 Registros com Maior Críticidade
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100">
                    <th className="pb-4">Data/Hora</th>
                    <th className="pb-4">Dia</th>
                    <th className="pb-4">kW</th>
                    <th className="pb-4">kVAr</th>
                    <th className="pb-4">FP</th>
                    <th className="pb-4">Correção</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data
                    .filter(d => d.fp < targetFP && d.tipoReativo === 'indutivo')
                    .sort((a, b) => b.kvar - a.kvar)
                    .slice(0, 10)
                    .map((row, idx) => (
                      <tr key={idx} className="text-sm hover:bg-slate-50">
                        <td className="py-3 font-medium text-slate-700">{row.data} {row.hora}</td>
                        <td className="py-3 text-slate-600">{row.diaSemana || '-'}</td>
                        <td className="py-3 text-slate-600">{row.kw.toFixed(1)}</td>
                        <td className="py-3 font-bold text-red-600">{row.kvar.toFixed(1)}</td>
                        <td className="py-3 font-bold text-red-500">{row.fp.toFixed(3)}</td>
                        <td className="py-3 text-slate-600">{row.kvarNecessario > 0 ? `${row.kvarNecessario.toFixed(0)} kVAr` : '-'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
