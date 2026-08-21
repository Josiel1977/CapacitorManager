'use client';

import { FormEvent, useState } from 'react';
import { readJsonResponse } from '@/lib/http-json-response';

interface AuditResult {
  concessionaria: string;
  mesReferencia: string;
  valorTotalFatura: number;
  consumoKwh: number;
  reativo_ponta_kvarh: number;
  reativo_fora_ponta_kvarh: number;
  totalMultas: number;
  percentualMulta: number;
  economiaAnualProjetada: number;
}

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export default function AuditoriaPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function audit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    const formData = new FormData();
    formData.append('fatura', file);
    try {
      const response = await fetch('/api/capacitormanager/auditar-fatura', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(35_000),
      });
      const body = await readJsonResponse<{ data: AuditResult }>(response, 'Falha ao analisar a fatura.');
      setResult(body.data);
    } catch (auditError) {
      setError(auditError instanceof Error ? auditError.message : 'Falha ao analisar a fatura.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <section className="rounded-2xl bg-primary p-7 text-white">
        <h1 className="text-3xl font-bold">Auditoria de fatura</h1>
        <p className="mt-2 text-white/80">Extração real de faturas em PDF da Equatorial Pará. O arquivo é processado em memória e não é armazenado por este recurso.</p>
      </section>
      <form onSubmit={audit} className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <label className="block font-medium">Fatura em PDF (até 8 MB)</label>
        <input type="file" required accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="block w-full rounded-lg border p-3" />
        <button disabled={!file || loading} className="rounded-lg bg-primary px-6 py-3 font-semibold text-white disabled:opacity-50">{loading ? 'Analisando…' : 'Analisar fatura'}</button>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </form>
      {result && (
        <section className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
          <div><h2 className="text-xl font-bold text-primary">Resultado da fatura enviada</h2><p className="text-sm text-slate-500">Referência: {result.mesReferencia} · {result.concessionaria}</p></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Valor total" value={money(result.valorTotalFatura)} />
            <Metric label="Consumo ativo" value={`${number(result.consumoKwh)} kWh`} />
            <Metric label="Cobrança reativa identificada" value={money(result.totalMultas)} warning />
            <Metric label="Participação na fatura" value={`${number(result.percentualMulta)}%`} warning />
          </div>
          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            <p>Excedente reativo: {number(result.reativo_ponta_kvarh + result.reativo_fora_ponta_kvarh)} kVArh.</p>
            <p>Projeção anual prudente: {money(result.economiaAnualProjetada)}, calculada como 12 vezes a cobrança desta fatura com realização de 90%. Não é histórico nem garantia de economia.</p>
          </div>
          <p className="text-xs text-slate-500">A extração automática deve ser conferida com a fatura original. Dimensionamento e intervenção elétrica exigem medição em campo e responsável técnico habilitado.</p>
        </section>
      )}
    </main>
  );
}

function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className={`rounded-xl border p-4 ${warning ? 'border-amber-200 bg-amber-50' : 'bg-slate-50'}`}><p className="text-xs text-slate-500">{label}</p><strong className="mt-1 block text-lg">{value}</strong></div>;
}
