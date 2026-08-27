'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, BarChart3, FileText, RefreshCw } from 'lucide-react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import Swal from 'sweetalert2';
import GraphicAnalysisDocument from '@/components/GraphicAnalysisDocument';
import {
  calculateDeviationProjection,
  calculateDeltaCapacitance,
  calculateExpectedCapacitorCurrent,
  classifyDeviation,
} from '@/lib/domain/capacitorAnalysis';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/with-timeout';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const PDF_PAGE_WIDTH_PX = 794;
const PDF_PAGE_HEIGHT_PX = 1122;

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
  bancos_capacitores?: { nome_banco: string; cliente_id: string };
}

interface Medicao {
  id: string;
  capacitor_id: string;
  created_at: string;
  tipo_teste: 'corrente' | 'capacitancia';
  corrente_medida_a?: number | null;
  capacitancia_medida_uf?: number | null;
  tensao_medida_v?: number | null;
  frequencia_medida_hz?: number | null;
  desvio_percentual: number | null;
}

interface CapacitorComparacao extends Capacitor {
  ultimoDesvio: number | null;
  ultimaData: string | null;
}

function recalculateDeviation(measurement: Medicao, capacitor: Capacitor): number {
  if (measurement.tipo_teste === 'corrente' && measurement.corrente_medida_a !== null && measurement.corrente_medida_a !== undefined && Number.isFinite(Number(measurement.corrente_medida_a))) {
    const theoretical = calculateExpectedCapacitorCurrent(
      capacitor.potencia_kvar,
      capacitor.tensao_nominal_v,
      measurement.tensao_medida_v || capacitor.tensao_nominal_v,
      60,
      measurement.frequencia_medida_hz || 60,
    );
    return theoretical > 0 ? ((Number(measurement.corrente_medida_a) - theoretical) / theoretical) * 100 : 0;
  }
  if (measurement.tipo_teste === 'capacitancia' && measurement.capacitancia_medida_uf !== null && measurement.capacitancia_medida_uf !== undefined && Number.isFinite(Number(measurement.capacitancia_medida_uf))) {
    const theoretical = calculateDeltaCapacitance(capacitor.capacitancia_nominal_uf);
    return theoretical > 0 ? ((Number(measurement.capacitancia_medida_uf) - theoretical) / theoretical) * 100 : 0;
  }
  return Number(measurement.desvio_percentual) || 0;
}

export default function GraficosPage() {
  const [clients, setClients] = useState<Cliente[]>([]);
  const [banks, setBanks] = useState<Banco[]>([]);
  const [capacitors, setCapacitors] = useState<Capacitor[]>([]);
  const [selectedCapacitorId, setSelectedCapacitorId] = useState('');
  const [selectedCapacitor, setSelectedCapacitor] = useState<Capacitor | null>(null);
  const [history, setHistory] = useState<Medicao[]>([]);
  const [comparison, setComparison] = useState<CapacitorComparacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState({ cliente_id: '', banco_id: '' });
  const chartRef = useRef<any>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function loadClients() {
      try {
        const result = await withTimeout(
          supabase.from('clientes').select('id, nome').eq('ativo', true).order('nome'),
          10_000,
          'Tempo limite ao carregar os clientes.',
        );
        if (result.error) throw result.error;
        if (active) setClients(result.data || []);
      } catch (cause) {
        if (!active) return;
        const message = cause instanceof Error ? cause.message : 'Não foi possível carregar os clientes.';
        console.warn(`[Gráficos] ${message}`);
        setError(message);
      }
    }
    void loadClients();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setBanks([]);
    setCapacitors([]);
    setSelectedCapacitorId('');
    setSelectedCapacitor(null);
    setHistory([]);
    setComparison([]);
    if (!selection.cliente_id) return () => { active = false; };

    async function loadBanks() {
      try {
        const result = await withTimeout(
          supabase.from('bancos_capacitores').select('id, nome_banco').eq('cliente_id', selection.cliente_id).eq('ativo', true).order('nome_banco'),
          10_000,
          'Tempo limite ao carregar os bancos.',
        );
        if (result.error) throw result.error;
        if (active) setBanks(result.data || []);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os bancos.');
      }
    }
    void loadBanks();
    return () => { active = false; };
  }, [selection.cliente_id]);

  useEffect(() => {
    let active = true;
    setCapacitors([]);
    setSelectedCapacitorId('');
    setSelectedCapacitor(null);
    setHistory([]);
    setComparison([]);
    if (!selection.banco_id) return () => { active = false; };

    async function loadCapacitors() {
      try {
        const result = await withTimeout(
          supabase.from('capacitores').select('*, bancos_capacitores(nome_banco, cliente_id)').eq('banco_id', selection.banco_id).eq('ativo', true).order('codigo_identificacao'),
          10_000,
          'Tempo limite ao carregar os capacitores.',
        );
        if (result.error) throw result.error;
        if (active) setCapacitors(result.data || []);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os capacitores.');
      }
    }
    void loadCapacitors();
    return () => { active = false; };
  }, [selection.banco_id]);

  useEffect(() => {
    let active = true;
    if (!selectedCapacitorId) {
      setSelectedCapacitor(null);
      setHistory([]);
      setComparison([]);
      return () => { active = false; };
    }

    async function loadAnalysis() {
      setLoading(true);
      setError(null);
      try {
        const [capacitorResult, historyResult, bankCapacitorsResult] = await withTimeout(
          Promise.all([
            supabase.from('capacitores').select('*, bancos_capacitores(nome_banco, cliente_id)').eq('id', selectedCapacitorId).single(),
            supabase.from('medicoes').select('*').eq('capacitor_id', selectedCapacitorId).order('created_at', { ascending: true }),
            supabase.from('capacitores').select('id, codigo_identificacao, potencia_kvar, capacitancia_nominal_uf, tensao_nominal_v, banco_id').eq('banco_id', selection.banco_id).eq('ativo', true),
          ]),
          15_000,
          'Tempo limite ao carregar a análise gráfica.',
        );
        if (capacitorResult.error) throw capacitorResult.error;
        if (historyResult.error) throw historyResult.error;
        if (bankCapacitorsResult.error) throw bankCapacitorsResult.error;
        if (!active) return;

        const capacitor = capacitorResult.data as Capacitor;
        const processedHistory = (historyResult.data || []).map(measurement => ({
          ...measurement,
          desvio_percentual: recalculateDeviation(measurement as Medicao, capacitor),
        })) as Medicao[];
        setSelectedCapacitor(capacitor);
        setHistory(processedHistory);

        const bankCapacitors = (bankCapacitorsResult.data || []) as Capacitor[];
        if (!bankCapacitors.length) {
          setComparison([]);
          return;
        }

        const measurementResult = await withTimeout(
          supabase
            .from('medicoes')
            // A frequência foi adicionada por migração. O curinga preserva a
            // análise em instalações antigas e mantém o valor quando existir.
            .select('*')
            .in('capacitor_id', bankCapacitors.map(item => item.id))
            .order('created_at', { ascending: false })
            .limit(1_000),
          12_000,
          'Tempo limite ao comparar os capacitores.',
        );
        if (measurementResult.error) throw measurementResult.error;
        if (!active) return;

        const capacitorById = new Map(bankCapacitors.map(item => [item.id, item]));
        const latestByCapacitor = new Map<string, { deviation: number; date: string }>();
        (measurementResult.data || []).forEach(raw => {
          if (latestByCapacitor.has(raw.capacitor_id)) return;
          const reference = capacitorById.get(raw.capacitor_id);
          if (!reference) return;
          latestByCapacitor.set(raw.capacitor_id, {
            deviation: recalculateDeviation(raw as Medicao, reference),
            date: raw.created_at,
          });
        });

        setComparison(bankCapacitors.map(item => {
          const latest = latestByCapacitor.get(item.id);
          return { ...item, ultimoDesvio: latest?.deviation ?? null, ultimaData: latest?.date ?? null };
        }));
      } catch (cause) {
        if (!active) return;
        const message = cause && typeof cause === 'object' && 'message' in cause
          ? String(cause.message)
          : 'Não foi possível carregar a análise.';
        console.warn('[Gráficos] Não foi possível carregar a análise.', cause);
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadAnalysis();
    return () => { active = false; };
  }, [selectedCapacitorId, selection.banco_id]);

  const chartData = useMemo(() => {
    if (!history.length) return null;
    return {
      labels: history.map(item => new Date(item.created_at).toLocaleDateString('pt-BR')),
      datasets: [
        {
          label: 'Desvio medido (%)',
          data: history.map(item => item.desvio_percentual),
          borderColor: '#d97706',
          backgroundColor: 'rgba(217, 119, 6, 0.10)',
          fill: true,
          tension: 0.25,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: history.map(item => {
            const status = classifyDeviation(Number(item.desvio_percentual) || 0);
            return status === 'aprovado' ? '#059669' : status === 'reprovado' ? '#dc2626' : '#d97706';
          }),
        },
        { label: 'Limite superior (+10%)', data: history.map(() => 10), borderColor: '#dc2626', borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0, fill: false },
        { label: 'Limite inferior (-5%)', data: history.map(() => -5), borderColor: '#dc2626', borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0, fill: false },
      ],
    };
  }, [history]);

  const projection = useMemo(() => calculateDeviationProjection(history), [history]);

  const projectionChartData = useMemo(() => {
    if (!projection?.reliable || !history.length) return null;
    return {
      labels: [...history.map(item => new Date(item.created_at).toLocaleDateString('pt-BR')), '+3 meses', '+6 meses', '+9 meses'],
      datasets: [
        {
          label: 'Afastamento histórico (%)',
          data: [...history.map(item => Math.abs(Number(item.desvio_percentual) || 0)), null, null, null],
          borderColor: '#d97706',
          backgroundColor: 'rgba(217, 119, 6, 0.10)',
          tension: 0.25,
          pointRadius: 4,
        },
        {
          label: 'Projeção do afastamento (%)',
          data: [...history.map(() => null), ...projection.futureDeviations],
          borderColor: '#2563eb',
          borderDash: [5, 5],
          pointBackgroundColor: '#2563eb',
          pointRadius: 4,
        },
        {
          label: `Limite crítico (${projection.criticalLimit}%)`,
          data: [...history.map(() => null), projection.criticalLimit, projection.criticalLimit, projection.criticalLimit],
          borderColor: '#dc2626',
          borderDash: [5, 5],
          pointRadius: 0,
        },
      ],
    };
  }, [history, projection]);

  const comparisonChartData = useMemo(() => {
    if (!comparison.length) return null;
    return {
      labels: comparison.map(item => item.codigo_identificacao),
      datasets: [{
        label: 'Último desvio (%)',
        data: comparison.map(item => item.ultimoDesvio),
        backgroundColor: comparison.map(item => {
          if (item.ultimoDesvio === null) return '#cbd5e1';
          const status = classifyDeviation(item.ultimoDesvio);
          return status === 'aprovado' ? '#059669' : status === 'reprovado' ? '#dc2626' : '#d97706';
        }),
        borderRadius: 7,
      }],
    };
  }, [comparison]);

  const firstMeasurement = history[0];
  const latestMeasurement = history[history.length - 1];
  const degradation = firstMeasurement && latestMeasurement
    ? Math.abs(Number(latestMeasurement.desvio_percentual) || 0) - Math.abs(Number(firstMeasurement.desvio_percentual) || 0)
    : 0;
  const elapsedMonths = firstMeasurement && latestMeasurement
    ? (new Date(latestMeasurement.created_at).getTime() - new Date(firstMeasurement.created_at).getTime()) / (30 * 86_400_000)
    : 0;
  const monthlyDegradation = projection
    ? projection.slopePerDay * 30
    : elapsedMonths > 0 ? degradation / elapsedMonths : 0;

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    plugins: {
      legend: { position: 'top' as const, labels: { boxWidth: 12, font: { size: 10 } } },
      tooltip: { callbacks: { label: (context: any) => `${context.dataset.label}: ${Number(context.parsed.y).toFixed(2)}%` } },
    },
    scales: {
      y: { grid: { color: '#f1f5f9' }, ticks: { callback: (value: any) => `${value}%` }, title: { display: true, text: 'Desvio (%)' } },
      x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 0 } },
    },
  }), []);

  const comparisonOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (context: any) => context.raw === null ? 'Sem medição' : `Desvio: ${Number(context.raw).toFixed(2)}%` } },
    },
    scales: { y: { ticks: { callback: (value: any) => `${value}%` }, title: { display: true, text: 'Desvio (%)' } } },
  }), []);

  function exportChart() {
    if (!chartRef.current) return;
    try {
      const image = chartRef.current.toBase64Image();
      const link = document.createElement('a');
      link.download = `grafico_${selectedCapacitor?.codigo_identificacao || 'capacitor'}.png`;
      link.href = image;
      link.click();
    } catch {
      void Swal.fire('Erro', 'Falha ao exportar o gráfico.', 'error');
    }
  }

  async function downloadPDF() {
    if (!reportRef.current || !selectedCapacitor) return;
    const [{ default: jsPDF }, { toPng }] = await Promise.all([
      import('jspdf'),
      import('html-to-image'),
    ]);
    try {
      Swal.fire({ title: 'Gerando PDF...', text: 'Preparando as páginas.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      if (document.fonts?.ready) await document.fonts.ready;
      const pages = Array.from(reportRef.current.querySelectorAll<HTMLElement>('[data-pdf-page]'));
      if (!pages.length) throw new Error('Nenhuma página encontrada.');
      const pdf = new jsPDF('p', 'mm', 'a4');
      for (let index = 0; index < pages.length; index++) {
        Swal.update({ text: `Processando página ${index + 1} de ${pages.length}.` });
        const image = await toPng(pages[index], {
          backgroundColor: '#ffffff',
          cacheBust: true,
          pixelRatio: 2,
          width: PDF_PAGE_WIDTH_PX,
          height: PDF_PAGE_HEIGHT_PX,
          filter: node => !(node instanceof HTMLElement && node.hasAttribute('data-pdf-exclude')),
        });
        if (index > 0) pdf.addPage('a4', 'p');
        pdf.addImage(image, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      }
      pdf.save(`Analise_Grafica_${selectedCapacitor.codigo_identificacao.replace(/\s+/g, '_')}.pdf`);
      Swal.close();
      await Swal.fire('Sucesso', 'Análise exportada em páginas A4 completas.', 'success');
    } catch (cause) {
      console.warn('[Gráficos] Falha ao gerar o PDF.', cause);
      Swal.close();
      await Swal.fire('Erro', 'Falha ao gerar o PDF.', 'error');
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><h1 className="text-3xl font-bold text-primary">Análise Gráfica</h1><p className="text-slate-500">Evolução, tendência responsável e comparação entre capacitores</p></div>
        {selectedCapacitor && <button type="button" onClick={downloadPDF} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-5 py-2 font-bold text-white hover:bg-slate-700"><FileText size={18} /> Exportar PDF</button>}
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Selection label="Cliente" value={selection.cliente_id} onChange={value => setSelection({ cliente_id: value, banco_id: '' })}><option value="">Selecione um cliente...</option>{clients.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</Selection>
          <Selection label="Banco" value={selection.banco_id} disabled={!selection.cliente_id} onChange={value => setSelection(current => ({ ...current, banco_id: value }))}><option value="">Selecione um banco...</option>{banks.map(item => <option key={item.id} value={item.id}>{item.nome_banco}</option>)}</Selection>
          <Selection label="Capacitor" value={selectedCapacitorId} disabled={!selection.banco_id} onChange={setSelectedCapacitorId}><option value="">Selecione um capacitor...</option>{capacitors.map(item => <option key={item.id} value={item.id}>{item.codigo_identificacao} ({item.tensao_nominal_v} V · {item.potencia_kvar} kVAr)</option>)}</Selection>
        </div>
      </section>

      {loading && <div className="flex justify-center py-14"><div className="h-11 w-11 animate-spin rounded-full border-4 border-slate-200 border-b-primary" /></div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700"><AlertCircle className="mr-2 inline" size={19} />{error}<button type="button" onClick={() => window.location.reload()} className="ml-4 inline-flex items-center gap-1 rounded-lg bg-red-700 px-3 py-1.5 text-sm text-white"><RefreshCw size={14} /> Repetir</button></div>}

      {selectedCapacitor && !loading && !error ? (
        <div className="overflow-x-auto pb-8"><div ref={reportRef} className="mx-auto w-max"><GraphicAnalysisDocument capacitor={selectedCapacitor} history={history} chartData={chartData} chartOptions={chartOptions} projectionChartData={projectionChartData} comparisonChartData={comparisonChartData} comparisonOptions={comparisonOptions} comparisonCount={comparison.length} projection={projection} degradation={degradation} monthlyDegradation={monthlyDegradation} chartRef={chartRef} onExportChart={exportChart} /></div></div>
      ) : !loading && !error ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-24 text-slate-400 shadow-sm"><BarChart3 size={64} className="mb-4 opacity-10" /><p className="text-lg">Selecione um capacitor para visualizar a análise</p></div>
      ) : null}
    </div>
  );
}

function Selection({ label, value, disabled, onChange, children }: { label: string; value: string; disabled?: boolean; onChange: (value: string) => void; children: ReactNode }) {
  return <div><label className="mb-1 block text-sm font-medium text-slate-700">{label}</label><select value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary disabled:bg-slate-50">{children}</select></div>;
}
