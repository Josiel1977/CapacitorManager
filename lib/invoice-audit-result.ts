import type { ParsedEquatorialInvoice } from '@/lib/equatorial-invoice-parser';

export interface InvoiceAuditResult extends ParsedEquatorialInvoice {
  valorTotalFatura: number;
  multaReativoFp: number;
  multaReativoPta: number;
  totalMultas: number;
  percentualMulta: number;
  economiaAnualProjetada: number;
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
  return {
    ...parsed,
    valorTotalFatura: parsed.total_pagar,
    multaReativoFp: parsed.penalidade_reativa_fora_ponta ?? 0,
    multaReativoPta: parsed.penalidade_reativa_ponta ?? 0,
    totalMultas: totalPenalty,
    percentualMulta: parsed.total_pagar > 0 ? Number(((totalPenalty / parsed.total_pagar) * 100).toFixed(2)) : 0,
    economiaAnualProjetada: Number((totalPenalty * 12 * 0.9).toFixed(2)),
    consumoKwh: parsed.consumo_ponta_kwh + parsed.consumo_fora_ponta_kwh,
    empresa: parsed.concessionaria === 'EQUATORIAL_PARA' ? 'Unidade consumidora — Equatorial Pará' : 'Unidade consumidora',
    mesReferencia: parsed.mes_referencia || 'Não identificado',
    historico12Meses: [{
      mes: parsed.mes_referencia || 'Fatura enviada',
      consumoFp: parsed.consumo_ponta_kwh + parsed.consumo_fora_ponta_kwh,
      reativoFp: parsed.reativo_ponta_kvarh + parsed.reativo_fora_ponta_kvarh,
      multaEstimada: totalPenalty,
    }],
  };
}
