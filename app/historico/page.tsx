'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FilterX,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { buildCsv } from '@/lib/csv-export';
import {
  calculateCapacitorTrend,
  calculateDeltaCapacitance,
  calculateExpectedCapacitorCurrent,
  classifyDeviation,
} from '@/lib/domain/capacitorAnalysis';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { withTimeout } from '@/lib/with-timeout';

const PAGE_SIZE = 25;
const HISTORY_FETCH_LIMIT = 1_000;

type Filters = {
  cliente_id: string;
  tipo_teste: string;
  status: string;
  search: string;
  periodo: string;
};

const initialFilters: Filters = {
  cliente_id: '',
  tipo_teste: '',
  status: '',
  search: '',
  periodo: 'todos',
};

function processMeasurement(measurement: any) {
  let deviation = measurement.desvio_percentual;
  let status = measurement.status_validacao;
  let theoreticalLabel = '---';
  let displayVoltage = null;
  const capacitor = measurement.capacitores;

  if (capacitor) {
    const nominalVoltage = capacitor.tensao_nominal_v;
    const measuredVoltage = measurement.tensao_medida_v || nominalVoltage;
    displayVoltage = measuredVoltage;

    if (measurement.tipo_teste === 'corrente') {
      const theoretical = calculateExpectedCapacitorCurrent(
        capacitor.potencia_kvar,
        nominalVoltage,
        measuredVoltage,
        60,
        measurement.frequencia_medida_hz || 60,
      );
      theoreticalLabel = theoretical > 0 ? `${theoretical.toFixed(2)} A @ ${measuredVoltage}V` : '---';
      if (measurement.corrente_medida_a !== null && measurement.corrente_medida_a !== undefined && Number.isFinite(Number(measurement.corrente_medida_a)) && theoretical > 0) {
        deviation = ((measurement.corrente_medida_a - theoretical) / theoretical) * 100;
        status = classifyDeviation(deviation);
      }
    } else if (measurement.tipo_teste === 'capacitancia') {
      const theoretical = calculateDeltaCapacitance(capacitor.capacitancia_nominal_uf);
      theoreticalLabel = theoretical > 0 ? `${theoretical.toFixed(2)} µF (Δ) @ ${nominalVoltage}V` : '---';
      if (measurement.capacitancia_medida_uf !== null && measurement.capacitancia_medida_uf !== undefined && Number.isFinite(Number(measurement.capacitancia_medida_uf)) && theoretical > 0) {
        deviation = ((measurement.capacitancia_medida_uf - theoretical) / theoretical) * 100;
        status = classifyDeviation(deviation);
      }
    }
  }

  return {
    ...measurement,
    desvio_percentual: deviation,
    status_validacao: status,
    teoricoLabel: theoreticalLabel,
    tensaoNominal: displayVoltage,
  };
}

function periodStart(period: string) {
  const days = period === '30dias' ? 30 : period === '60dias' ? 60 : period === '90dias' ? 90 : 0;
  if (!days) return null;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function measuredValue(measurement: any) {
  const value = measurement.tipo_teste === 'corrente'
    ? measurement.corrente_medida_a
    : measurement.capacitancia_medida_uf;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '---';
  return `${parsed.toFixed(2)} ${measurement.tipo_teste === 'corrente' ? 'A' : 'µF'}`;
}

function formattedDeviation(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '---';
  return `${parsed > 0 ? '+' : ''}${parsed.toFixed(2)}%`;
}

export default function HistoricoPage() {
  const [capacitorIdFilter, setCapacitorIdFilter] = useState('');
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setCapacitorIdFilter(new URLSearchParams(window.location.search).get('capacitor_id') || '');
    void fetchData();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [capacitorIdFilter, filters]);

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      const [measurementResult, clientResult] = await withTimeout(
        Promise.all([
          supabase
            .from('medicoes')
            .select(`
              *,
              clientes(id, nome),
              bancos_capacitores(id, nome_banco),
              capacitores(id, codigo_identificacao, potencia_kvar, capacitancia_nominal_uf, tensao_nominal_v)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .limit(HISTORY_FETCH_LIMIT),
          supabase
            .from('clientes')
            .select('id, nome')
            .eq('ativo', true)
            .order('nome'),
        ]),
        15_000,
        'Tempo limite ao carregar o histórico.',
      );

      if (measurementResult.error) throw measurementResult.error;
      if (clientResult.error) throw clientResult.error;

      setMeasurements((measurementResult.data || []).map(processMeasurement));
      setTotalAvailable(measurementResult.count ?? measurementResult.data?.length ?? 0);
      setClients(clientResult.data || []);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Não foi possível carregar o histórico.';
      console.warn(`[Histórico] ${message}`);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const filteredMeasurements = useMemo(() => {
    const minimumDate = periodStart(filters.periodo);
    const search = filters.search.trim().toLocaleLowerCase('pt-BR');

    return measurements.filter((measurement) => {
      const searchable = [
        measurement.capacitores?.codigo_identificacao,
        measurement.bancos_capacitores?.nome_banco,
        measurement.clientes?.nome,
      ].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');

      return (!capacitorIdFilter || measurement.capacitor_id === capacitorIdFilter)
        && (!filters.cliente_id || measurement.cliente_id === filters.cliente_id)
        && (!filters.tipo_teste || measurement.tipo_teste === filters.tipo_teste)
        && (!filters.status || measurement.status_validacao === filters.status)
        && (!search || searchable.includes(search))
        && (!minimumDate || new Date(measurement.created_at) >= minimumDate);
    });
  }, [capacitorIdFilter, filters, measurements]);

  const capacitorSummaries = useMemo(() => {
    const grouped = new Map<string, any[]>();
    filteredMeasurements.forEach((measurement) => {
      const id = measurement.capacitores?.id;
      if (!id) return;
      const current = grouped.get(id) || [];
      current.push(measurement);
      grouped.set(id, current);
    });

    return Array.from(grouped.entries()).map(([id, items]) => {
      const ordered = [...items].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      return {
        id,
        name: ordered[ordered.length - 1]?.capacitores?.codigo_identificacao || 'Não identificado',
        bank: ordered[ordered.length - 1]?.bancos_capacitores?.nome_banco || '-',
        measurements: ordered,
        trend: calculateCapacitorTrend(ordered),
      };
    }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [filteredMeasurements]);

  const totalPages = Math.max(1, Math.ceil(filteredMeasurements.length / PAGE_SIZE));
  const paginatedMeasurements = filteredMeasurements.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const statusCounts = useMemo(() => filteredMeasurements.reduce(
    (counts, measurement) => {
      const status = measurement.status_validacao;
      if (status === 'aprovado' || status === 'atencao' || status === 'reprovado') counts[status]++;
      return counts;
    },
    { aprovado: 0, atencao: 0, reprovado: 0 },
  ), [filteredMeasurements]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function analyzeCapacitor(summary: (typeof capacitorSummaries)[number]) {
    const trend = summary.trend;
    if (!trend) {
      void Swal.fire('Atenção', 'São necessárias pelo menos duas medições em datas diferentes.', 'info');
      return;
    }

    const variationColor = trend.tendencia === 'piorando' ? '#dc2626' : trend.tendencia === 'melhorando' ? '#059669' : '#64748b';
    const trendLabel = trend.tendencia === 'piorando'
      ? 'Degradação observada'
      : trend.tendencia === 'melhorando'
        ? 'Aproximação do nominal'
        : 'Estável — variação sem relevância técnica';
    const projectionText = trend.previsao
      ? `<hr style="margin:15px 0"><p><strong>Horizonte indicativo:</strong> aproximadamente ${trend.previsao.meses.toFixed(1)} meses (${trend.previsao.data}).</p><p style="font-size:12px;color:#64748b">${trend.mensagemProjecao}</p>`
      : `<hr style="margin:15px 0"><p><strong>Projeção técnica:</strong> ${trend.mensagemProjecao}</p>`;
    void Swal.fire({
      title: `Análise de tendência — ${summary.name}`,
      html: `
        <div style="text-align:left;line-height:1.7">
          <p><strong>Período:</strong> ${trend.primeiraData} a ${trend.ultimaData}</p>
          <p><strong>Desvio inicial:</strong> ${formattedDeviation(trend.primeiroDesvio)}</p>
          <p><strong>Desvio atual:</strong> ${formattedDeviation(trend.ultimoDesvio)}</p>
          <p><strong>Variação do afastamento:</strong> <span style="color:${variationColor};font-weight:700">${trend.variacao > 0 ? '+' : ''}${trend.variacao.toFixed(2)} p.p.</span></p>
          <p><strong>Tendência:</strong> ${trendLabel}</p>
          <p><strong>Inclinação mensal observada:</strong> ${trend.degradacaoPorMes > 0 ? '+' : ''}${trend.degradacaoPorMes.toFixed(2)} p.p./mês</p>
          <p style="font-size:12px;color:#64748b"><strong>Base estatística:</strong> ${trend.amostras} medições em ${Math.round(trend.periodoDias)} dias${trend.rQuadrado !== null ? ` · R² ${trend.rQuadrado.toFixed(2)}` : ''}.</p>
          ${projectionText}
        </div>
      `,
      icon: trend.tendencia === 'piorando' ? 'warning' : 'success',
      confirmButtonText: 'Fechar',
    });
  }

  async function deleteMeasurement(id: string) {
    const result = await Swal.fire({
      title: 'Excluir medição?',
      text: 'Esta ação remove o registro histórico e não pode ser desfeita.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#0a2b3c',
      confirmButtonText: 'Excluir medição',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    try {
      const { error: deleteError } = await withTimeout(
        supabase.from('medicoes').delete().eq('id', id),
        10_000,
        'Tempo limite ao excluir a medição.',
      );
      if (deleteError) throw deleteError;
      setMeasurements(current => current.filter(measurement => measurement.id !== id));
      setTotalAvailable(current => Math.max(0, current - 1));
      await Swal.fire('Excluído', 'Medição removida com sucesso.', 'success');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Não foi possível excluir a medição.';
      await Swal.fire('Erro', message, 'error');
    }
  }

  function exportCsv() {
    if (!filteredMeasurements.length) return;
    const csv = buildCsv(
      ['Data/Hora', 'Cliente', 'Banco', 'Capacitor', 'Tipo', 'Teórico', 'Medido', 'Desvio', 'Status'],
      filteredMeasurements.map(measurement => [
        new Date(measurement.created_at).toLocaleString('pt-BR'),
        measurement.clientes?.nome || '',
        measurement.bancos_capacitores?.nome_banco || '',
        measurement.capacitores?.codigo_identificacao || '',
        measurement.tipo_teste === 'corrente' ? 'Corrente' : 'Capacitância',
        measurement.teoricoLabel,
        measuredValue(measurement),
        formattedDeviation(measurement.desvio_percentual),
        measurement.status_validacao || '',
      ]),
    );
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `historico_capacitormanager_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  function clearFilters() {
    setFilters(initialFilters);
    setCapacitorIdFilter('');
    window.history.replaceState({}, '', window.location.pathname);
  }

  if (error && !measurements.length) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <XCircle className="mx-auto text-red-600" size={40} />
        <h1 className="mt-4 text-xl font-bold text-red-800">Não foi possível carregar o histórico</h1>
        <p className="mt-2 text-sm text-red-700">{error}</p>
        <button type="button" onClick={fetchData} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-white">
          <RefreshCw size={16} /> Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <h1 className="text-3xl font-bold text-primary">Histórico de Medições</h1>
          <p className="text-slate-500">Consulte, compare e analise a evolução dos capacitores</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={clearFilters} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            <FilterX size={16} /> Limpar filtros
          </button>
          <button type="button" onClick={exportCsv} disabled={!filteredMeasurements.length} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </header>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Esta tela apresenta registros históricos. O estado atual consolidado de cada ativo permanece no Dashboard e em Manutenção Preditiva.
      </div>

      {totalAvailable > HISTORY_FETCH_LIMIT && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Existem {totalAvailable.toLocaleString('pt-BR')} registros. Esta visão operacional utiliza os {HISTORY_FETCH_LIMIT.toLocaleString('pt-BR')} mais recentes; filtros de arquivo completo serão disponibilizados pela consulta histórica avançada.
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Registros filtrados', filteredMeasurements.length, 'text-slate-800', Activity],
          ['Aprovados', statusCounts.aprovado, 'text-emerald-700', CheckCircle2],
          ['Atenção', statusCounts.atencao, 'text-amber-700', AlertTriangle],
          ['Reprovados', statusCounts.reprovado, 'text-red-700', XCircle],
        ].map(([label, value, color, Icon]: any[]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><Icon size={18} className={color} /></div>
            <p className={cn('mt-2 text-2xl font-black', color)}>{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <FilterSelect label="Cliente" value={filters.cliente_id} onChange={value => setFilters(current => ({ ...current, cliente_id: value }))}>
            <option value="">Todos os clientes</option>
            {clients.map(client => <option key={client.id} value={client.id}>{client.nome}</option>)}
          </FilterSelect>
          <FilterSelect label="Tipo" value={filters.tipo_teste} onChange={value => setFilters(current => ({ ...current, tipo_teste: value }))}>
            <option value="">Todos</option><option value="corrente">Corrente</option><option value="capacitancia">Capacitância</option>
          </FilterSelect>
          <FilterSelect label="Status" value={filters.status} onChange={value => setFilters(current => ({ ...current, status: value }))}>
            <option value="">Todos</option><option value="aprovado">Aprovado</option><option value="atencao">Atenção</option><option value="reprovado">Reprovado</option>
          </FilterSelect>
          <FilterSelect label="Período" value={filters.periodo} onChange={value => setFilters(current => ({ ...current, periodo: value }))}>
            <option value="todos">Todo o período</option><option value="30dias">Últimos 30 dias</option><option value="60dias">Últimos 60 dias</option><option value="90dias">Últimos 90 dias</option>
          </FilterSelect>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">Buscar</label>
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} placeholder="Cliente, banco ou capacitor" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary" /></div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-2"><BarChart3 size={20} className="text-secondary" /><h2 className="text-lg font-bold text-primary">Análise por capacitor</h2><span className="text-xs text-slate-400">A tendência usa a ordem cronológica e o afastamento do valor nominal.</span></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Capacitor</th><th className="px-4 py-3">Banco</th><th className="px-4 py-3">Medições</th><th className="px-4 py-3">Primeira</th><th className="px-4 py-3">Última</th><th className="px-4 py-3">Tendência</th><th className="px-4 py-3 text-center">Ação</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {capacitorSummaries.map(summary => {
                const first = summary.measurements[0];
                const latest = summary.measurements[summary.measurements.length - 1];
                const variation = summary.trend?.variacao ?? 0;
                return <tr key={summary.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-bold text-primary">{summary.name}</td><td className="px-4 py-3 text-slate-600">{summary.bank}</td><td className="px-4 py-3"><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">{summary.measurements.length}</span></td><td className="px-4 py-3 text-xs text-slate-500">{new Date(first.created_at).toLocaleDateString('pt-BR')}<br/><strong>{formattedDeviation(first.desvio_percentual)}</strong></td><td className="px-4 py-3 text-xs text-slate-500">{new Date(latest.created_at).toLocaleDateString('pt-BR')}<br/><strong>{formattedDeviation(latest.desvio_percentual)}</strong></td><td className="px-4 py-3"><TrendValue variation={variation} /></td><td className="px-4 py-3 text-center"><button type="button" onClick={() => analyzeCapacitor(summary)} className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary hover:bg-secondary/20">Analisar</button></td></tr>;
              })}
              {!capacitorSummaries.length && !loading && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Nenhum capacitor encontrado para os filtros selecionados.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="px-5 py-4">Data/Hora</th><th className="px-5 py-4">Cliente / Banco</th><th className="px-5 py-4">Capacitor</th><th className="px-5 py-4">Tipo</th><th className="px-5 py-4">Teórico</th><th className="px-5 py-4">Medido</th><th className="px-5 py-4">Desvio</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Ação</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedMeasurements.map(measurement => <tr key={measurement.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-5 py-4 text-slate-600">{new Date(measurement.created_at).toLocaleString('pt-BR')}</td><td className="px-5 py-4"><p className="font-medium text-primary">{measurement.clientes?.nome || '-'}</p><p className="text-xs text-slate-500">{measurement.bancos_capacitores?.nome_banco || '-'}</p></td><td className="px-5 py-4"><p className="font-bold text-primary">{measurement.capacitores?.codigo_identificacao || '-'}</p>{measurement.tensaoNominal && <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{measurement.tensaoNominal} V</span>}</td><td className="px-5 py-4 text-slate-600">{measurement.tipo_teste === 'corrente' ? 'Corrente' : 'Capacitância'}</td><td className="px-5 py-4 text-xs text-slate-500">{measurement.teoricoLabel}</td><td className="px-5 py-4 font-medium text-slate-700">{measuredValue(measurement)}</td><td className="px-5 py-4 font-bold text-slate-700">{formattedDeviation(measurement.desvio_percentual)}</td><td className="px-5 py-4"><StatusBadge status={measurement.status_validacao} /></td><td className="px-5 py-4 text-right"><button type="button" aria-label="Excluir medição" onClick={() => deleteMeasurement(measurement.id)} className="rounded p-2 text-red-500 hover:bg-red-50"><Trash2 size={17} /></button></td></tr>)}
              {!paginatedMeasurements.length && !loading && <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">Nenhuma medição encontrada.</td></tr>}
              {loading && <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">Carregando medições...</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row"><p className="text-sm text-slate-500">Página {page} de {totalPages} · {filteredMeasurements.length.toLocaleString('pt-BR')} registros filtrados</p><div className="flex gap-2"><button type="button" aria-label="Página anterior" disabled={page === 1} onClick={() => setPage(current => Math.max(1, current - 1))} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronLeft size={18} /></button><button type="button" aria-label="Próxima página" disabled={page === totalPages} onClick={() => setPage(current => Math.min(totalPages, current + 1))} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronRight size={18} /></button></div></div>
      </section>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <div><label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">{label}</label><select value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary">{children}</select></div>;
}

function TrendValue({ variation }: { variation: number }) {
  const Icon = variation > 0 ? TrendingUp : variation < 0 ? TrendingDown : Activity;
  return <span className={cn('inline-flex items-center gap-1 font-semibold', variation > 0 ? 'text-red-600' : variation < 0 ? 'text-emerald-600' : 'text-slate-500')}><Icon size={14} />{variation > 0 ? '+' : ''}{variation.toFixed(2)}%</span>;
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
    aprovado: { icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700', label: 'Aprovado' },
    atencao: { icon: AlertTriangle, color: 'bg-amber-50 text-amber-700', label: 'Atenção' },
    reprovado: { icon: XCircle, color: 'bg-red-50 text-red-700', label: 'Reprovado' },
  };
  const config = configs[status?.toLowerCase()] || configs.atencao;
  const Icon = config.icon;
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium', config.color)}><Icon size={13} />{config.label}</span>;
}
