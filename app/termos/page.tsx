import Link from 'next/link';
import { PLAN_LIST, formatPlanLimits } from '@/lib/plans';

export default function TermosPage() {
  return <main className="mx-auto max-w-4xl px-4 py-12"><h1 className="text-3xl font-bold text-primary">Termos e condições comerciais</h1><p className="mt-3 text-slate-600">Selecione o plano para consultar preço, limites e condições aplicáveis.</p><div className="mt-6 grid gap-4 sm:grid-cols-2">{PLAN_LIST.map((plan) => <Link key={plan.id} href={`/termos/${plan.id}`} className="rounded-xl border bg-white p-5 shadow-sm hover:border-primary"><strong className="text-primary">{plan.name} — R$ {plan.priceMonthly}/mês</strong><span className="mt-1 block text-sm text-slate-500">{formatPlanLimits(plan)}</span></Link>)}</div><p className="mt-8 text-xs text-slate-500">O software é ferramenta de apoio e não substitui responsável técnico, medições, projeto, laudo ou ART/TRT. Recomenda-se revisão jurídica destes termos antes da abertura definitiva das vendas.</p></main>;
}
