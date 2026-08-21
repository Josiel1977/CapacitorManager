'use client';

import type { ReactNode, RefObject } from 'react';
import { AlertCircle, BarChart3, Calendar, Download, TrendingUp, Zap } from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';
import { cn } from '@/lib/utils';

const PAGE_WIDTH_PX = 794;
const PAGE_HEIGHT_PX = 1122;

function Page({ children, page, total, title, asset }: { children: ReactNode; page: number; total: number; title: string; asset: string }) {
  return (
    <section data-pdf-page className="relative flex flex-col overflow-hidden bg-white text-slate-800 shadow-xl" style={{ width: `${PAGE_WIDTH_PX}px`, height: `${PAGE_HEIGHT_PX}px` }}>
      <header className="flex shrink-0 items-center justify-between border-b-4 border-[#eab308] bg-slate-900 px-9 py-5 text-white">
        <div className="flex items-center gap-3"><div className="rounded-lg bg-[#eab308] p-2 text-slate-900"><Zap size={23} /></div><div><p className="text-xl font-black">CAPACITOR<span className="text-[#eab308]">MANAGER</span></p><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">{title}</p></div></div>
        <div className="max-w-[260px] text-right text-[10px]"><p className="truncate font-bold">{asset}</p><p className="text-slate-400">Emissão: {new Date().toLocaleDateString('pt-BR')}</p></div>
      </header>
      <main className="min-h-0 flex-1 px-9 py-6">{children}</main>
      <footer className="flex shrink-0 items-center justify-between border-t border-slate-200 px-9 py-4 text-[9px] text-slate-500"><span>JM Eletro Service · Análise gráfica gerada pelo CapacitorManager</span><strong className="text-slate-700">Página {page} de {total}</strong></footer>
    </section>
  );
}

export default function GraphicAnalysisDocument({
  capacitor,
  history,
  chartData,
  chartOptions,
  projectionChartData,
  comparisonChartData,
  comparisonOptions,
  comparisonCount,
  projection,
  degradation,
  monthlyDegradation,
  chartRef,
  onExportChart,
}: {
  capacitor: any;
  history: any[];
  chartData: any;
  chartOptions: any;
  projectionChartData: any;
  comparisonChartData: any;
  comparisonOptions: any;
  comparisonCount: number;
  projection: any;
  degradation: number;
  monthlyDegradation: number;
  chartRef: RefObject<any>;
  onExportChart: () => void;
}) {
  const hasSecondPage = Boolean((projection && projectionChartData && history.length >= 3) || (comparisonCount > 1 && comparisonChartData));
  const totalPages = hasSecondPage ? 2 : 1;
  const first = history[0];
  const latest = history[history.length - 1];
  const projectionAvailable = projection?.status === 'disponivel' && projection?.monthsToCritical;
  const projectionTone = projection?.status === 'limite_atual'
    ? 'border-red-200 bg-red-50'
    : projectionAvailable
      ? 'border-amber-200 bg-amber-50'
      : 'border-slate-200 bg-slate-50';

  return (
    <div data-pdf-document className="space-y-8 bg-slate-200 p-5">
      <Page page={1} total={totalPages} title="Análise gráfica e tendência técnica" asset={capacitor.codigo_identificacao}>
        <div className="rounded-xl bg-slate-900 p-5 text-white">
          <div className="flex items-center justify-between gap-5"><div><h1 className="text-2xl font-black">{capacitor.codigo_identificacao}</h1><p className="text-sm text-slate-400">{capacitor.bancos_capacitores?.nome_banco || 'Banco não informado'}</p></div><div className="grid grid-cols-3 gap-7 text-center"><Metric label="Tensão" value={`${capacitor.tensao_nominal_v} V`} /><Metric label="Potência" value={`${capacitor.potencia_kvar} kVAr`} /><Metric label="Capacitância" value={`${capacitor.capacitancia_nominal_uf} µF`} /></div></div>
        </div>

        <section className="mt-5 rounded-xl border border-slate-200 p-5">
          <div className="mb-3 flex items-center justify-between"><div><h2 className="text-base font-black text-slate-800">Evolução do desvio</h2><p className="text-[9px] text-slate-400">As linhas tracejadas indicam os limites configurados de -5% e +10%.</p></div><button type="button" data-pdf-exclude onClick={onExportChart} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-[10px] font-semibold text-slate-600"><Download size={13} /> PNG</button></div>
          <div className="h-[350px]">{chartData ? <Line ref={chartRef} data={chartData} options={chartOptions} /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Nenhuma medição encontrada.</div>}</div>
        </section>

        <section className="mt-5 grid grid-cols-3 gap-4">
          <AnalysisMetric label="Variação do afastamento" value={`${degradation > 0 ? '+' : ''}${degradation.toFixed(2)} p.p.`} tone={Math.abs(degradation) < 0.5 ? 'neutral' : degradation > 5 ? 'danger' : degradation > 0 ? 'warning' : 'success'} />
          <AnalysisMetric label="Inclinação mensal" value={`${monthlyDegradation > 0 ? '+' : ''}${monthlyDegradation.toFixed(2)} p.p.`} tone={projection?.status === 'disponivel' ? 'warning' : projection?.status === 'limite_atual' ? 'danger' : 'neutral'} />
          <AnalysisMetric label="Total de testes" value={String(history.length)} tone="neutral" />
        </section>

        <section className="mt-5 grid grid-cols-2 gap-4 text-[10px]">
          <div className="rounded-xl bg-slate-50 p-4"><p className="font-bold uppercase tracking-wide text-slate-400">Período analisado</p><p className="mt-2 text-slate-700">{first ? new Date(first.created_at).toLocaleDateString('pt-BR') : '---'} até {latest ? new Date(latest.created_at).toLocaleDateString('pt-BR') : '---'}</p></div>
          <div className={cn('rounded-xl border p-4', projectionTone)}><p className="font-bold uppercase tracking-wide text-slate-500">Projeção técnica</p><p className="mt-2 font-semibold text-slate-700">{projectionAvailable ? `Limite crítico estimado em aproximadamente ${projection.monthsToCritical} meses. ${projection.message}` : projection?.message || 'São necessárias medições em datas diferentes para analisar a tendência.'}</p></div>
        </section>

        {degradation > 5 && <div className="mt-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"><AlertCircle className="shrink-0" size={18} /><p className="text-[10px] leading-5"><strong>Degradação relevante detectada.</strong> Confirme o resultado por reteste e inspeção antes de decidir pela substituição.</p></div>}
      </Page>

      {hasSecondPage && (
        <Page page={2} total={totalPages} title="Projeção e comparação do banco" asset={capacitor.codigo_identificacao}>
          {projection && projectionChartData && history.length >= 3 && <section className="rounded-xl border border-slate-200 p-5"><h2 className="mb-2 flex items-center gap-2 text-base font-black text-slate-800"><Calendar size={18} className="text-[#b45309]" /> Projeção do afastamento absoluto</h2><p className="mb-3 text-[9px] text-slate-400">Regressão linear baseada nas datas reais. Projeções não substituem inspeção nem reteste.</p><div className="h-[330px]"><Line data={projectionChartData} options={chartOptions} /></div></section>}
          {comparisonCount > 1 && comparisonChartData && <section className="mt-5 rounded-xl border border-slate-200 p-5"><h2 className="mb-2 flex items-center gap-2 text-base font-black text-slate-800"><BarChart3 size={18} className="text-[#b45309]" /> Comparação do banco</h2><p className="mb-3 text-[9px] text-slate-400">Última medição recalculada de cada capacitor ativo do mesmo banco.</p><div className="h-[330px]"><Bar data={comparisonChartData} options={comparisonOptions} /></div></section>}
          <div className="mt-5 rounded-xl bg-slate-900 p-5 text-white"><div className="flex items-center gap-2"><TrendingUp size={18} className="text-[#eab308]" /><p className="text-sm font-bold">Interpretação responsável</p></div><p className="mt-2 text-[10px] leading-5 text-slate-300">Uma data só é exibida com ao menos 3 medições em 90 dias, crescimento relevante, correlação estatística R² ≥ 0,60 e horizonte de até 36 meses. A projeção é indicativa e deve ser confirmada por reteste, instrumentos calibrados e profissional habilitado.</p></div>
        </Page>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[8px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>;
}

function AnalysisMetric({ label, value, tone }: { label: string; value: string; tone: 'danger' | 'warning' | 'success' | 'neutral' }) {
  const colors = { danger: 'text-red-700 bg-red-50', warning: 'text-amber-700 bg-amber-50', success: 'text-emerald-700 bg-emerald-50', neutral: 'text-slate-700 bg-slate-50' };
  return <div className={cn('rounded-xl p-4', colors[tone])}><p className="text-[8px] font-black uppercase tracking-wide opacity-70">{label}</p><p className="mt-2 text-xl font-black">{value}</p></div>;
}
