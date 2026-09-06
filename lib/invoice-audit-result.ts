import type { ParsedEquatorialInvoice } from '@/lib/equatorial-invoice-parser';

export interface InvoiceAuditResult extends ParsedEquatorialInvoice {
  valorTotalFatura: number;
  multaReativoFp: number;
  multaReativoPta: number;
  totalMultas: number;
  percentualMulta: number;
  economiaAnualProjetada: number;
  mediaMensalCobrancaReativa: number;
  mesesHistorico: number;
  projecaoBase: 'historico_fatura' | 'mes_atual';
  consumoKwh: number;
  empresa: string;
  mesReferencia: string;
  historico12Meses: Array<{
    mes: string;
    consumoFp: number;
    reativoFp: number;
    multaEstimada: number;
  }>;
}

export function buildInvoiceAuditResult(parsed: ParsedEquatorialInvoice): InvoiceAuditResult {
  const totalPenalty = parsed.penalidade_reativa_informada ?? 0;
  const currentReactive = parsed.reativo_ponta_kvarh + parsed.reativo_fora_ponta_kvarh;
  const reactiveTariff = parsed.tarifa_reativa_aplicada
    ?? (currentReactive > 0 ? totalPenalty / currentReactive : 0);
  const currentHistory = {
    mes: parsed.mes_referencia || 'Fatura enviada',
    consumoFp: parsed.consumo_ponta_kwh + parsed.consumo_fora_ponta_kwh,
    reativoFp: currentReactive,
    multaEstimada: totalPenalty,
  };
  const history = parsed.historico_mensal.length
    ? parsed.historico_mensal.map((item) => ({
        mes: item.mes_referencia,
        consumoFp: item.consumo_ponta_kwh + item.consumo_fora_ponta_kwh,
        reativoFp: item.reativo_excedente_kvarh,
        multaEstimada: item.mes_referencia === parsed.mes_referencia
          ? totalPenalty
          : Number((item.reativo_excedente_kvarh * reactiveTariff).toFixed(2)),
      }))
    : [currentHistory];
  const usesHistory = history.length >= 2;
  const monthlyAverage = history.reduce((sum, item) => sum + item.multaEstimada, 0) / history.length;
  return {
    ...parsed,
    valorTotalFatura: parsed.total_pagar,
    multaReativoFp: parsed.penalidade_reativa_fora_ponta ?? 0,
    multaReativoPta: parsed.penalidade_reativa_ponta ?? 0,
    totalMultas: totalPenalty,
    percentualMulta: parsed.total_pagar > 0 ? Number(((totalPenalty / parsed.total_pagar) * 100).toFixed(2)) : 0,
    economiaAnualProjetada: Number(((usesHistory ? monthlyAverage : totalPenalty) * 12 * 0.9).toFixed(2)),
    mediaMensalCobrancaReativa: Number(monthlyAverage.toFixed(2)),
    mesesHistorico: history.length,
    projecaoBase: usesHistory ? 'historico_fatura' : 'mes_atual',
    consumoKwh: parsed.consumo_ponta_kwh + parsed.consumo_fora_ponta_kwh,
    empresa: parsed.concessionaria === 'EQUATORIAL_PARA' ? 'Unidade consumidora — Equatorial Pará' : 'Unidade consumidora',
    mesReferencia: parsed.mes_referencia || 'Não identificado',
    historico12Meses: history,
  };
}
