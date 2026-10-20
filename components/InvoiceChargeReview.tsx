'use client';
import type { InvoiceDetails } from '@/lib/invoice-details';
import { reviewInvoiceCharges } from '@/lib/invoice-charge-review';
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function InvoiceChargeReview({ details, total }: { details: InvoiceDetails; total: number }) {
  const review = reviewInvoiceCharges(details, total);
  const flagged = review.items.filter(item => item.kind !== 'outro');
  return <section className="space-y-4 rounded-2xl border bg-white p-6">
    <h2 className="text-xl font-bold">Cobranças e plano de conferência — grupos A e B</h2>
    <p className="text-sm">Classificação dos itens extraídos da fatura. Os valores precisam ser conferidos no PDF; identificar uma cobrança não comprova que ela seja indevida ou recuperável.</p>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
      ['Multas, juros e correções', review.financialCharges], ['Excedente reativo', review.reactiveCharges],
      ['Ultrapassagem de demanda', review.demandExcessCharges], ['Parcelas de dívida ou acordo', review.debtInstallments],
    ].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-slate-50 p-3"><p className="text-sm">{label}</p><strong>{money(Number(value))}</strong></div>)}</div>
    <p className="rounded-lg bg-amber-50 p-3 text-sm">{review.reconciled ? 'A soma dos itens extraídos confere com o total; isso não valida a origem ou o cálculo de cada cobrança.' : `Extração incompleta ou divergente. ${review.difference === null ? 'Nenhum item estruturado.' : `Diferença para o total: ${money(review.difference)}.`} Confira os itens no original antes de concluir a auditoria.`} Zero significa ausência de valor positivo identificado, não garantia de ausência da cobrança.</p>
    {flagged.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Item e valor', 'Documentos para validar', 'Como corrigir ou prevenir'].map(title => <th key={title} className="border-b p-2">{title}</th>)}</tr></thead><tbody>{flagged.map((item, index) => <tr key={index}><td className="border-b p-2"><strong>{item.description}: {money(item.amount)}</strong><p>{item.credit ? 'Crédito — conferir estorno e referência original.' : item.title}</p></td><td className="border-b p-2">{item.evidence}</td><td className="border-b p-2">{item.action}</td></tr>)}</tbody></table></div> : <p className="text-sm">Nenhum encargo destas categorias foi identificado nos itens estruturados. Confira o texto completo e a fatura original.</p>}
    <p className="text-sm">Bandeiras, tributos, iluminação pública, perdas e créditos de geração têm naturezas próprias. Não são classificados automaticamente como multas. Esta etapa não recalcula juros, índices ou tributos nem substitui a análise do contrato e dos comprovantes.</p>
  </section>;
}
