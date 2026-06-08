'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart3, TrendingUp, AlertCircle, Zap, Download, Calendar, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  BarElement
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// ==============================
// TIPAGENS
// ==============================
interface Cliente {
  id: string;
  nome: string;
}

interface Banco {
  id: string;
  nome_banco: string;
}

interface Capacitor {
  id: string;
  codigo_identificacao: string;
  potencia_kvar: number;
  capacitancia_nominal_uf: number;
  tensao_nominal_v: number;
  banco_id: string;
  bancos_capacitores?: {
    nome_banco: string;
    cliente_id: string;
  };
}

interface Medicao {
  id: string;
  capacitor_id: string;
  created_at: string;
  tipo_teste: 'corrente' | 'capacitancia';
  corrente_medida_a?: number;
  capacitancia_medida_uf?: number;
  desvio_percentual: number | null;
}

// Para a comparação: estende Capacitor e adiciona os campos de último desvio/data
interface CapacitorComparacao extends Capacitor {
  ultimoDesvio: number;
  ultimaData: string | null;
}

// ==============================
// FUNÇÕES DE CÁLCULO (utilitários)
// ==============================
function calcularCapacitanciaTeoricaDelta(capacitanciaNominalFase: number): number {
  return capacitanciaNominalFase * 1.5;
}

function calcularCorrenteTeorica(potenciaKvar: number, tensaoNominal: number): number {
  if (!tensaoNominal || tensaoNominal === 0) return 0;
  return (potenciaKvar * 1000) / (Math.sqrt(3) * tensaoNominal);
}

function recalcularDesvio(medicao: Medicao, capacitor: Capacitor): number {
  if (medicao.tipo_teste === 'corrente' && medicao.corrente_medida_a) {
    const teorico = calcularCorrenteTeorica(capacitor.potencia_kvar, capacitor.tensao_nominal_v);
    if (teorico === 0) return 0;
    return ((medicao.corrente_medida_a - teorico) / teorico) * 100;
  }
  if (medicao.tipo_teste === 'capacitancia' && medicao.capacitancia_medida_uf) {
    const teorico = calcularCapacitanciaTeoricaDelta(capacitor.capacitancia_nominal_uf);
    if (teorico === 0) return 0;
    return ((medicao.capacitancia_medida_uf - teorico) / teorico) * 100;
  }
  return medicao.desvio_percentual ?? 0;
}

// Previsão linear baseada em tempo real (dias)
function calcularPrevisao(history: Medicao[], capacitor: Capacitor): {
  slope: number;
  intercept: number;
  proximos: number[];
  atingir15: number | null;
  tendencia: 'alta' | 'moderada' | 'estavel';
} | null {
  if (history.length < 2) return null;
  
  // Converte datas para dias desde a primeira medição
  const primeiraData = new Date(history[0].created_at).getTime();
  const dias = history.map(h => (new Date(h.created_at).getTime() - primeiraData) / (1000 * 3600 * 24));
  const desvios = history.map(h => recalcularDesvio(h, capacitor));
  
  const n = dias.length;
  const sumX = dias.reduce((a, b) => a + b, 0);
  const sumY = desvios.reduce((a, b) => a + b, 0);
  const sumXY = dias.reduce((a, b, i) => a + b * desvios[i], 0);
  const sumX2 = dias.reduce((a, b) => a + b * b, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Projetar para os próximos 90, 180, 270 dias (3 medições trimestrais)
  const ultimoDia = dias[dias.length - 1];
  const proximosDias = [ultimoDia + 90, ultimoDia + 180, ultimoDia + 270];
  const proximos = proximosDias.map(d => slope * d + intercept);
  
  // Quando atinge 15%?
  const atingir15 = slope > 0 ? (15 - intercept) / slope : null;
  const mesesPara15 = atingir15 ? Math.round((atingir15 - ultimoDia) / 30) : null;
  
  let tendencia: 'alta' | 'moderada' | 'estavel' = 'estavel';
  if (slope > 0.02) tendencia = 'alta';      // degradação > 0.02% ao dia (~0.6%/mês)
  else if (slope > 0.005) tendencia = 'moderada';
  
  return {
    slope,
    intercept,
    proximos,
    atingir15: mesesPara15 && mesesPara15 > 0 ? mesesPara15 : null,
    tendencia
  };
}

// ==============================
// COMPONENTE PRINCIPAL
// ==============================
export default function GraficosPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [capacitores, setCapacitores] = useState<Capacitor[]>([]);
  const [selectedCapacitorId, setSelectedCapacitorId] = useState('');
  const [selectedCapacitor, setSelectedCapacitor] = useState<Capacitor | null>(null);
  const [history, setHistory] = useState<Medicao[]>([]);
  const [comparacaoCapacitores, setComparacaoCapacitores] = useState<CapacitorComparacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const chartRef = useRef<any>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [selection, setSelection] = useState({
    cliente_id: '',
    banco_id: '',
  });

  // Carrega clientes
  useEffect(() => {
    const loadClientes = async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) console.error(error);
      else setClientes(data || []);
    };
    loadClientes();
  }, []);

  // Carrega bancos ao mudar cliente
  useEffect(() => {
    const loadBancos = async () => {
      if (!selection.cliente_id) {
        setBancos([]);
        setSelection(s => ({ ...s, banco_id: '' }));
        return;
      }
      const { data, error } = await supabase
        .from('bancos_capacitores')
        .select('id, nome_banco')
        .eq('cliente_id', selection.cliente_id)
        .eq('ativo', true)
        .order('nome_banco');
      if (error) console.error(error);
      else setBancos(data || []);
    };
    loadBancos();
  }, [selection.cliente_id]);

  // Carrega capacitores ao mudar banco
  useEffect(() => {
    const loadCapacitores = async () => {
      if (!selection.banco_id) {
        setCapacitores([]);
        setSelectedCapacitorId('');
        return;
      }
      const { data, error } = await supabase
        .from('capacitores')
        .select('*, bancos_capacitores(nome_banco, cliente_id)')
        .eq('banco_id', selection.banco_id)
        .eq('ativo', true)
        .order('codigo_identificacao');
      if (error) console.error(error);
      else setCapacitores(data || []);
    };
    loadCapacitores();
  }, [selection.banco_id]);

  // Carrega histórico e comparação ao selecionar capacitor
  useEffect(() => {
    const loadHistoryAndComparison = async () => {
      if (!selectedCapacitorId) {
        setHistory([]);
        setSelectedCapacitor(null);
        setComparacaoCapacitores([]);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        // 1. Buscar dados do capacitor
        const { data: capData, error: capError } = await supabase
          .from('capacitores')
          .select('*, bancos_capacitores(nome_banco, cliente_id)')
          .eq('id', selectedCapacitorId)
          .single();
        if (capError) throw capError;
        setSelectedCapacitor(capData);
        
        // 2. Buscar medições do capacitor
        const { data: medicoes, error: medError } = await supabase
          .from('medicoes')
          .select('*')
          .eq('capacitor_id', selectedCapacitorId)
          .order('created_at', { ascending: true });
        if (medError) throw medError;
        
        // Recalcular desvios com base na tensão nominal
        const processedHistory = (medicoes || []).map(med => ({
          ...med,
          desvio_percentual: recalcularDesvio(med as Medicao, capData)
        }));
        setHistory(processedHistory);
        
        // 3. Comparação com outros capacitores do mesmo banco (UMA ÚNICA CONSULTA)
        if (capData && selection.banco_id) {
          // Buscar todos os capacitores do banco
          const { data: outrosCapacitores, error: outrosError } = await supabase
            .from('capacitores')
            .select('id, codigo_identificacao, potencia_kvar, capacitancia_nominal_uf, tensao_nominal_v, banco_id')
            .eq('banco_id', selection.banco_id)
            .eq('ativo', true);
          if (outrosError) throw outrosError;
          
          if (outrosCapacitores && outrosCapacitores.length > 0) {
            // Buscar a última medição de cada capacitor de uma só vez
            const { data: ultimasMedicoes, error: ultimasError } = await supabase
              .from('medicoes')
              .select('capacitor_id, desvio_percentual, created_at')
              .in('capacitor_id', outrosCapacitores.map(c => c.id))
              .order('created_at', { ascending: false });
            if (ultimasError) throw ultimasError;
            
            // Mapear a última medição por capacitor_id
            const ultimaPorCapacitor = new Map<string, { desvio: number; data: string }>();
            for (const med of ultimasMedicoes || []) {
              if (!ultimaPorCapacitor.has(med.capacitor_id)) {
                ultimaPorCapacitor.set(med.capacitor_id, {
                  desvio: med.desvio_percentual ?? 0,
                  data: med.created_at
                });
              }
            }
            
            // Montar array de comparação - espalhando todas as propriedades do capacitor original
            const comparacao: CapacitorComparacao[] = outrosCapacitores.map(cap => {
              const ultima = ultimaPorCapacitor.get(cap.id);
              return {
                ...cap,  // mantém id, banco_id, codigo_identificacao, etc.
                ultimoDesvio: ultima?.desvio ?? 0,
                ultimaData: ultima?.data || null
              };
            });
            setComparacaoCapacitores(comparacao);
          } else {
            setComparacaoCapacitores([]);
          }
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Erro ao carregar dados');
        Swal.fire('Erro', 'Falha ao carregar os dados do capacitor', 'error');
      } finally {
        setLoading(false);
      }
    };
    
    loadHistoryAndComparison();
  }, [selectedCapacitorId, selection.banco_id]);

  // Memoiza dados do gráfico de evolução
  const chartData = useMemo(() => {
    if (!history.length) return null;
    return {
      labels: history.map(h => new Date(h.created_at).toLocaleDateString('pt-BR')),
      datasets: [
        {
          label: 'Desvio Percentual (%)',
          data: history.map(h => h.desvio_percentual),
          borderColor: '#f39c12',
          backgroundColor: 'rgba(243, 156, 18, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 6,
          pointHoverRadius: 8,
          pointBackgroundColor: history.map(h => {
            const d = h.desvio_percentual;
            if (d === null) return '#94a3b8'; // cinza para valores nulos (não deve ocorrer)
            if (d >= -5 && d <= 10) return '#2ecc71';
            if (d < -5 || d > 15) return '#e74c3c';
            return '#f39c12';
          }),
        },
        {
          label: 'Limite Superior (+10%)',
          data: history.map(() => 10),
          borderColor: '#e74c3c',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'Limite Inferior (-5%)',
          data: history.map(() => -5),
          borderColor: '#e74c3c',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        },
      ],
    };
  }, [history]);

  // Memoiza previsão
  const previsao = useMemo(() => {
    if (!selectedCapacitor || history.length < 2) return null;
    return calcularPrevisao(history, selectedCapacitor);
  }, [history, selectedCapacitor]);

  // Memoiza dados do gráfico de previsão
  const chartDataPrevisao = useMemo(() => {
    if (!previsao || !history.length) return null;
    const labels = history.map(h => new Date(h.created_at).toLocaleDateString('pt-BR'));
    const labelsFuturos = ['+3 meses', '+6 meses', '+9 meses'];
    return {
      labels: [...labels, ...labelsFuturos],
      datasets: [
        {
          label: 'Histórico',
          data: history.map(h => h.desvio_percentual),
          borderColor: '#f39c12',
          backgroundColor: 'rgba(243, 156, 18, 0.1)',
          tension: 0.4,
          pointRadius: 5,
        },
        {
          label: 'Projeção',
          data: [...history.map(() => null), ...previsao.proximos],
          borderColor: '#3498db',
          borderDash: [5, 5],
          pointRadius: 4,
          pointBackgroundColor: '#3498db',
        },
        {
          label: 'Limite Crítico (15%)',
          data: [...history.map(() => null), 15, 15, 15],
          borderColor: '#e74c3c',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
        },
      ],
    };
  }, [previsao, history]);

  // Memoiza dados do gráfico de comparação
  const comparacaoChartData = useMemo(() => {
    if (!comparacaoCapacitores.length) return null;
    return {
      labels: comparacaoCapacitores.map(c => c.codigo_identificacao),
      datasets: [
        {
          label: 'Último Desvio (%)',
          data: comparacaoCapacitores.map(c => c.ultimoDesvio),
          backgroundColor: comparacaoCapacitores.map(c => {
            if (c.ultimoDesvio >= -5 && c.ultimoDesvio <= 10) return '#2ecc71';
            if (c.ultimoDesvio < -5 || c.ultimoDesvio > 15) return '#e74c3c';
            return '#f39c12';
          }),
          borderRadius: 8,
        },
      ],
    };
  }, [comparacaoCapacitores]);

  // Cálculos de degradação (garantindo que desvio_percentual não é null)
  const firstMed = history[0];
  const lastMed = history[history.length - 1];
  const degradation = lastMed && firstMed && lastMed.desvio_percentual !== null && firstMed.desvio_percentual !== null
    ? lastMed.desvio_percentual - firstMed.desvio_percentual
    : 0;
  const mesesEntre = lastMed && firstMed ? 
    (new Date(lastMed.created_at).getTime() - new Date(firstMed.created_at).getTime()) / (1000 * 3600 * 24 * 30) : 0;
  const degradacaoMensal = mesesEntre > 0 ? degradation / mesesEntre : 0;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
      tooltip: {
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`
        }
      }
    },
    scales: {
      y: {
        grid: { color: '#f1f5f9' },
        ticks: { callback: (value: any) => `${value}%` },
        title: { display: true, text: 'Desvio (%)' }
      },
      x: { grid: { display: false }, title: { display: true, text: 'Data' } }
    }
  };

  const comparacaoOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (context: any) => `Desvio: ${context.raw.toFixed(2)}%` } }
    },
    scales: { y: { ticks: { callback: (value: any) => `${value}%` }, title: { display: true, text: 'Desvio (%)' } } }
  };

  async function exportarGrafico() {
    if (!chartRef.current) return;
    try {
      Swal.fire({ title: 'Exportando...', text: 'Aguarde', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const canvas = chartRef.current.toBase64Image();
      const link = document.createElement('a');
      link.download = `grafico_${selectedCapacitor?.codigo_identificacao || 'capacitor'}.png`;
      link.href = canvas;
      link.click();
      Swal.close();
      Swal.fire('Sucesso!', 'Gráfico exportado como imagem', 'success');
    } catch (error) {
      Swal.close();
      Swal.fire('Erro', 'Falha ao exportar gráfico', 'error');
    }
  }

  async function downloadPDF() {
    if (!reportRef.current) return;
    try {
      Swal.fire({ title: 'Gerando PDF...', text: 'Por favor, aguarde.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      
      const header = reportRef.current.querySelector('.pdf-header') as HTMLElement;
      const footer = reportRef.current.querySelector('.pdf-footer') as HTMLElement;
      if (header) header.style.display = 'flex';
      if (footer) footer.style.display = 'block';
      
      const dataUrl = await toPng(reportRef.current, {
        quality: 1.0,
        backgroundColor: '#ffffff',
        pixelRatio: 3,
        style: { width: '794px', maxWidth: '794px', padding: '48px', margin: '0', boxShadow: 'none' }
      });
      
      if (header) header.style.display = 'none';
      if (footer) footer.style.display = 'none';
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(dataUrl);
      const contentHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = contentHeight;
      let position = 0;
      pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, contentHeight);
      heightLeft -= pdfHeight;
      while (heightLeft >= 0) {
        position = heightLeft - contentHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, contentHeight);
        heightLeft -= pdfHeight;
      }
      
      pdf.save(`Analise_Grafica_${selectedCapacitor?.codigo_identificacao || 'capacitor'}.pdf`);
      Swal.close();
      Swal.fire('Sucesso', 'Relatório exportado com sucesso!', 'success');
    } catch (error) {
      console.error('PDF Error:', error);
      Swal.close();
      Swal.fire('Erro', 'Falha ao gerar o PDF.', 'error');
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary">Análise Gráfica</h1>
          <p className="text-slate-500">Acompanhe a evolução, tendência e compare capacitores</p>
        </div>
        {selectedCapacitor && (
          <button 
            onClick={downloadPDF}
            className="flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-2 font-bold text-white hover:bg-slate-700 transition-colors"
          >
            <FileText size={20} />
            Exportar PDF
          </button>
        )}
      </header>

      {/* Filtros */}
      <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Cliente</label>
            <select 
              className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
              value={selection.cliente_id}
              onChange={(e) => setSelection({...selection, cliente_id: e.target.value, banco_id: ''})}
            >
              <option value="">Selecione um cliente...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Banco</label>
            <select 
              disabled={!selection.cliente_id}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary disabled:bg-slate-50"
              value={selection.banco_id}
              onChange={(e) => setSelection({...selection, banco_id: e.target.value})}
            >
              <option value="">Selecione um banco...</option>
              {bancos.map(b => <option key={b.id} value={b.id}>{b.nome_banco}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Capacitor</label>
            <select 
              disabled={!selection.banco_id}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary disabled:bg-slate-50"
              value={selectedCapacitorId}
              onChange={(e) => setSelectedCapacitorId(e.target.value)}
            >
              <option value="">Selecione um capacitor...</option>
              {capacitores.map(c => (
                <option key={c.id} value={c.id}>
                  {c.codigo_identificacao} ({c.tensao_nominal_v}V - {c.potencia_kvar}kVAr)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 p-6 text-red-600 border border-red-200">
          <AlertCircle className="inline mr-2" size={20} />
          {error}
        </div>
      )}

      {selectedCapacitor && !loading && !error ? (
        <div className="flex justify-center overflow-x-auto pb-8">
          <div 
            id="graphics-report-container" 
            ref={reportRef}
            className="bg-white p-8 shadow-2xl space-y-8"
            style={{ width: '794px', minHeight: '1122px' }}
          >
            {/* Header para PDF */}
            <div className="pdf-header hidden mb-8 flex flex-row items-center justify-between border-b-4 pb-8 gap-4" style={{ borderColor: '#EAB308', backgroundColor: '#0f172a', margin: '-24px -24px 24px -24px', padding: '24px' }}>
              <div className="flex items-center gap-4">
                <div className="rounded-2xl p-3" style={{ backgroundColor: '#EAB308' }}>
                  <Zap size={32} className="text-slate-900" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tighter uppercase" style={{ color: '#ffffff' }}>
                    CAPACITOR<span style={{ color: '#EAB308' }}>MANAGER</span>
                  </h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Análise Gráfica e Tendência Técnica</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-500">DATA DE EMISSÃO</p>
                <p className="text-sm font-bold text-white">{new Date().toLocaleDateString('pt-BR')}</p>
              </div>
            </div>

            {/* Informações do Capacitor */}
            <div className="rounded-xl bg-gradient-to-r from-primary to-primary-light p-6 text-white shadow-sm">
              <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold">{selectedCapacitor.codigo_identificacao}</h2>
                  <p className="text-white/70">{selectedCapacitor.bancos_capacitores?.nome_banco}</p>
                </div>
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="text-xs text-white/50">TENSÃO</p>
                    <p className="text-xl font-bold">{selectedCapacitor.tensao_nominal_v}V</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-white/50">POTÊNCIA</p>
                    <p className="text-xl font-bold">{selectedCapacitor.potencia_kvar} kVAr</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-white/50">CAPACITÂNCIA</p>
                    <p className="text-xl font-bold">{selectedCapacitor.capacitancia_nominal_uf} µF</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Gráfico principal */}
              <div className="lg:col-span-2 rounded-xl bg-white p-6 shadow-sm border border-slate-100">
                <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-primary">Evolução do Desvio</h2>
                    <p className="text-xs text-slate-400">Linhas vermelhas indicam os limites de tolerância (-5% e +10%)</p>
                  </div>
                  <button 
                    onClick={exportarGrafico}
                    className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200"
                  >
                    <Download size={16} />
                    Exportar
                  </button>
                </div>
                <div className="h-[400px]">
                  {chartData ? (
                    <Line ref={chartRef} data={chartData} options={chartOptions} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-400">
                      Nenhuma medição encontrada para este capacitor
                    </div>
                  )}
                </div>
              </div>

              {/* Painel lateral de análise */}
              <div className="space-y-6">
                <section className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-primary">
                    <TrendingUp size={20} className="text-secondary" />
                    Análise de Tendência
                  </h3>
                  
                  {history.length >= 2 ? (
                    <div className="space-y-6">
                      <div className="rounded-lg bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Degradação Total</p>
                        <p className={cn(
                          "text-2xl font-black",
                          degradation > 10 ? "text-red-600" : degradation > 5 ? "text-amber-600" : "text-green-600"
                        )}>
                          {degradation > 0 ? '+' : ''}{degradation?.toFixed(2)}%
                        </p>
                        <p className="mt-1 text-xs text-slate-500">Comparação entre 1ª e última medição</p>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Degradação Mensal</p>
                        <p className={cn(
                          "text-xl font-bold",
                          degradacaoMensal > 2 ? "text-red-600" : degradacaoMensal > 1 ? "text-amber-600" : "text-green-600"
                        )}>
                          {degradacaoMensal > 0 ? '+' : ''}{degradacaoMensal?.toFixed(2)}% / mês
                        </p>
                      </div>

                      {previsao && previsao.atingir15 && previsao.atingir15 > 0 && (
                        <div className="rounded-lg bg-amber-50 p-4 border border-amber-200">
                          <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Previsão de Substituição</p>
                          <p className="text-xl font-bold text-amber-700">~{previsao.atingir15} meses</p>
                          <p className="text-xs text-amber-600 mt-1">Baseado na tendência atual de degradação</p>
                        </div>
                      )}

                      {degradation > 10 && (
                        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-600">
                          <AlertCircle className="shrink-0" size={20} />
                          <div>
                            <p className="text-sm font-bold">Alerta de Degradação!</p>
                            <p className="text-xs">A degradação ultrapassou 10%. Recomenda-se substituição preventiva.</p>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3 border-t border-slate-100 pt-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Primeira Medição:</span>
                          <span className="font-medium">{new Date(firstMed.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Última Medição:</span>
                          <span className="font-medium">{new Date(lastMed.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Total de Testes:</span>
                          <span className="font-medium">{history.length}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-sm text-slate-400 py-8">
                      São necessárias pelo menos 2 medições para análise de tendência.
                    </p>
                  )}
                </section>

                <section className="rounded-xl bg-primary p-6 text-white shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Zap className="text-secondary" size={20} />
                    <h3 className="font-bold">Info do Capacitor</h3>
                  </div>
                  <div className="space-y-2 text-sm text-white/70">
                    <p>• Tensão: {selectedCapacitor.tensao_nominal_v}V</p>
                    <p>• Potência: {selectedCapacitor.potencia_kvar} kVAr</p>
                    <p>• Capacitância: {selectedCapacitor.capacitancia_nominal_uf} µF</p>
                    <p className="mt-3">Mantenha os testes em dia para garantir a eficiência energética do banco.</p>
                  </div>
                </section>
              </div>
            </div>

            {/* Gráfico de projeção futura */}
            {previsao && chartDataPrevisao && history.length >= 3 && (
              <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
                <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-primary">
                  <Calendar size={20} className="text-secondary" />
                  Projeção Futura
                </h3>
                <div className="h-[300px]">
                  <Line data={chartDataPrevisao} options={chartOptions} />
                </div>
                <p className="mt-4 text-center text-xs text-slate-400">
                  * Projeção baseada em regressão linear sobre o tempo real (dias). 
                  {previsao.tendencia === 'alta' ? ' Tendência de degradação acelerada detectada.' : previsao.tendencia === 'moderada' ? ' Tendência de degradação moderada.' : ' Tendência de degradação controlada.'}
                </p>
              </div>
            )}

            {/* Gráfico de comparação */}
            {comparacaoCapacitores.length > 1 && comparacaoChartData && (
              <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
                <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-primary">
                  <BarChart3 size={20} className="text-secondary" />
                  Comparação com outros capacitores do banco
                </h3>
                <div className="h-[300px]">
                  <Bar data={comparacaoChartData} options={comparacaoOptions} />
                </div>
                <p className="mt-4 text-center text-xs text-slate-400">
                  * Barras verdes: dentro da tolerância | Amarelas: atenção | Vermelhas: reprovado
                </p>
              </div>
            )}

            {/* Footer para PDF */}
            <div className="pdf-footer hidden mt-auto border-t-4 pt-8 text-center" style={{ borderColor: '#EAB308', backgroundColor: '#f8fafc', margin: '24px -24px -24px -24px', padding: '24px' }}>
              <p className="text-xs font-bold text-slate-700">Este documento é uma análise gráfica técnica oficial gerada pelo sistema CapacitorManager.</p>
              <p className="text-[10px] text-slate-600 mt-2 font-medium">CapacitorManager | Gestão Inteligente de Capacitores</p>
            </div>
          </div>
        </div>
      ) : (
        !loading && !error && (
          <div className="flex flex-col items-center justify-center rounded-xl bg-white py-24 shadow-sm border border-slate-100 text-slate-400">
            <BarChart3 size={64} className="mb-4 opacity-10" />
            <p className="text-lg">Selecione um capacitor para visualizar os gráficos</p>
          </div>
        )
      )}
    </div>
  );
}
