import type { InvoiceDetails } from './invoice-details.ts';

export type ChargeKind = 'multa' | 'juros' | 'correcao' | 'reativo' | 'ultrapassagem' | 'parcela' | 'outro';
const rules: Array<{ kind: ChargeKind; match: RegExp; title: string; evidence: string; action: string }> = [
  { kind: 'correcao', match: /correcao monetaria/, title: 'Correção monetária', evidence: 'Memória de cálculo, índice utilizado, período e obrigação original; se houver parcela, conferir o acordo.', action: 'Solicitar o demonstrativo e comparar com o débito de origem e os pagamentos. Contestar diferenças documentadas.' },
  { kind: 'juros', match: /\bjuros\b/, title: 'Juros', evidence: 'Valor de origem, vencimento, data de pagamento, taxa e número de dias considerados.', action: 'Conferir recibos e cálculo da distribuidora. Corrigir eventual baixa de pagamento e prevenir atrasos.' },
  { kind: 'ultrapassagem', match: /ultrapassagem/, title: 'Ultrapassagem de demanda', evidence: 'Contrato vigente no mês, demanda medida por posto e memória de faturamento.', action: 'Comparar o histórico e a expansão prevista; simular contratação e gestão de picos antes de alterar o contrato.' },
  { kind: 'reativo', match: /reativ/, title: 'Excedente reativo', evidence: 'Medições por intervalo, fator de potência, postos horários e tarifa utilizada.', action: 'Medir o perfil da instalação e avaliar compensação com responsável técnico, incluindo harmônicos e geração solar.' },
  { kind: 'multa', match: /\bmulta\b/, title: 'Multa — origem a confirmar', evidence: 'Motivo da cobrança, débito de origem, base de cálculo e comprovantes. A descrição isolada não prova atraso.', action: 'Pedir a memória de cálculo; conferir a origem e solicitar revisão se houver divergência comprovada.' },
  { kind: 'parcela', match: /^parcela\b/, title: 'Parcela de dívida ou acordo', evidence: 'Acordo, saldo original, parcelas pagas e encargos discriminados.', action: 'Conciliar com o acordo. O principal da dívida não deve ser tratado integralmente como multa ou economia possível.' },
];
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const cents = (value: number) => Math.round(value * 100) / 100;

/** Classificação documental, sem declarar legalidade ou projetar recuperação. */
export function reviewInvoiceCharges(details: InvoiceDetails, total: number) {
  const items = details.itens.map((item) => {
    const rule = rules.find((candidate) => candidate.match.test(normalize(item.descricao)));
    return {
      description: item.descricao, amount: item.valor, kind: rule?.kind ?? 'outro',
      title: rule?.title ?? 'Outro item ou crédito',
      evidence: rule?.evidence ?? 'Conferir descrição, quantidade, tarifa e valor no documento original.',
      action: rule?.action ?? 'Analisar separadamente conforme a natureza do item; não classificar automaticamente como multa.',
      credit: item.valor < 0,
    };
  });
  const sum = (kinds: ChargeKind[]) => cents(items.reduce((value, item) => value + (item.amount > 0 && kinds.includes(item.kind) ? item.amount : 0), 0));
  const extractedTotal = items.length ? cents(items.reduce((value, item) => value + item.amount, 0)) : null;
  const difference = extractedTotal === null ? null : cents(total - extractedTotal);
  return { items, financialCharges: sum(['multa', 'juros', 'correcao']), reactiveCharges: sum(['reativo']),
    demandExcessCharges: sum(['ultrapassagem']), debtInstallments: sum(['parcela']), extractedTotal, difference,
    reconciled: difference !== null && Math.abs(difference) <= 0.01 };
}
