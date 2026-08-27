import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gauge,
  ShieldCheck,
  Wrench,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Relatório técnico de exemplo',
  description: 'Veja como o CapacitorManager transforma faturas e medições em diagnóstico, rastreabilidade e plano de ação.',
};

const actions = [
  'Confirmar demanda e fator de potência no mesmo intervalo de medição.',
  'Inspecionar contatores, fusíveis e resposta de cada estágio do banco.',
  'Substituir o capacitor reprovado somente após confirmação em campo.',
  'Repetir a campanha de medição após a intervenção para comprovar o resultado.',
];

export default function ExampleReportPage() {
  return (
    <div className="bg-slate-100 py-10 sm:py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-secondary">Visualização pública</p>
            <h1 className="mt-2 text-3xl font-black text-primary sm:text-4xl">Relatório técnico de exemplo</h1>
            <p className="mt-3 max-w-2xl text-slate-600">Cenário demonstrativo com dados fictícios. A estrutura abaixo representa o tipo de evidência entregue pela plataforma.</p>
          </div>
          <Link href="/contato" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-white hover:bg-primary/90">
            Aplicar aos meus dados <ArrowRight size={17} />
          </Link>
        </div>

        <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <header className="bg-primary px-6 py-8 text-white sm:px-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-secondary">CapacitorManager · Diagnóstico auditável</p>
                <h2 className="mt-2 text-2xl font-black sm:text-3xl">Unidade Industrial — Exemplo</h2>
                <p className="mt-2 text-sm text-white/65">Período ilustrativo: três competências e uma campanha de inspeção</p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                <ShieldCheck className="text-secondary" size={28} />
                <div><p className="text-xs text-white/60">Integridade</p><p className="font-bold">Entradas preservadas</p></div>
              </div>
            </div>
          </header>

          <div className="space-y-10 p-6 sm:p-10">
            <section>
              <div className="flex items-center gap-3">
                <FileText className="text-secondary" size={24} />
                <h3 className="text-xl font-black text-primary">1. Resumo executivo</h3>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-xs font-bold uppercase text-red-600">Reativo faturado</p>
                  <p className="mt-2 text-2xl font-black text-red-700">R$ 1.248,70</p>
                  <p className="mt-1 text-xs text-red-600/80">Valor mensal ilustrativo</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-bold uppercase text-amber-700">Confiança</p>
                  <p className="mt-2 text-2xl font-black text-amber-700">Preliminar</p>
                  <p className="mt-1 text-xs text-amber-700/80">Requer confirmação de campo</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">Capacitores</p>
                  <p className="mt-2 text-2xl font-black text-primary">6 avaliados</p>
                  <p className="mt-1 text-xs text-slate-500">Exemplo de um banco</p>
                </div>
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                  <p className="text-xs font-bold uppercase text-green-700">Rastreabilidade</p>
                  <p className="mt-2 text-2xl font-black text-green-700">Completa</p>
                  <p className="mt-1 text-xs text-green-700/80">Fatura, medição e motor</p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl border-l-4 border-amber-500 bg-amber-50 p-5 text-sm leading-7 text-amber-950">
                <strong>Conclusão demonstrativa:</strong> há cobrança por energia reativa e indício de perda de desempenho em um estágio. A fatura sustenta a exposição financeira; a especificação definitiva depende de medição coincidente e inspeção do banco.
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 p-6">
                <div className="flex items-center gap-3"><BarChart3 className="text-secondary" /><h3 className="text-lg font-black text-primary">2. Evidência documental</h3></div>
                <dl className="mt-5 space-y-4 text-sm">
                  <div className="flex justify-between gap-4 border-b border-slate-100 pb-3"><dt className="text-slate-500">Competências válidas</dt><dd className="font-bold">3</dd></div>
                  <div className="flex justify-between gap-4 border-b border-slate-100 pb-3"><dt className="text-slate-500">Origem do reativo</dt><dd className="font-bold">Excedente faturado</dd></div>
                  <div className="flex justify-between gap-4 border-b border-slate-100 pb-3"><dt className="text-slate-500">Projeção</dt><dd className="font-bold">Separada do valor informado</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-500">Conferência técnica</dt><dd className="font-bold text-amber-700">Pendente</dd></div>
                </dl>
              </div>
              <div className="rounded-3xl border border-slate-200 p-6">
                <div className="flex items-center gap-3"><Gauge className="text-secondary" /><h3 className="text-lg font-black text-primary">3. Condição do banco</h3></div>
                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between rounded-xl bg-green-50 px-4 py-3"><span className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-600" /> Aprovados</span><strong className="text-green-700">4</strong></div>
                  <div className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3"><span className="flex items-center gap-2"><AlertTriangle size={18} className="text-amber-600" /> Atenção</span><strong className="text-amber-700">1</strong></div>
                  <div className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3"><span className="flex items-center gap-2"><AlertTriangle size={18} className="text-red-600" /> Reprovado</span><strong className="text-red-700">1</strong></div>
                </div>
                <p className="mt-4 text-xs leading-5 text-slate-500">Classificação ilustrativa baseada na medição mais recente de cada ativo e nos limites configurados para a empresa.</p>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3"><Wrench className="text-secondary" /><h3 className="text-xl font-black text-primary">4. Plano de ação</h3></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {actions.map((action, index) => (
                  <div key={action} className="flex gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-black text-white">{index + 1}</span>
                    <p>{action}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-primary p-6 text-white sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-secondary"><ClipboardCheck size={20} /><span className="text-sm font-black uppercase tracking-wider">Próximo passo</span></div>
                  <h3 className="mt-2 text-2xl font-black">Gere o mesmo diagnóstico com seus dados.</h3>
                  <p className="mt-2 max-w-xl text-white/70">Teste uma fatura sem cadastro ou solicite ajuda para configurar seu primeiro banco.</p>
                </div>
                <div className="flex flex-col gap-2 sm:min-w-56">
                  <Link href="/demo" className="rounded-xl bg-secondary px-5 py-3 text-center font-black text-primary">Analisar fatura grátis</Link>
                  <Link href="/contato" className="rounded-xl border border-white/20 px-5 py-3 text-center font-bold text-white">Solicitar piloto</Link>
                </div>
              </div>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
}
