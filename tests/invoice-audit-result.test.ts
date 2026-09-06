import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEquatorialInvoiceText } from '../lib/equatorial-invoice-parser.ts';
import { buildInvoiceAuditResult } from '../lib/invoice-audit-result.ts';

test('monta o resultado comercial da auditoria sem alterar os dados extraídos', () => {
  const parsed = parseEquatorialInvoiceText(`
    Equatorial Pará Distribuidora de Energia S.A.
    Conta Mês 07/2026 Total a Pagar R$ 6.984,32
    TUSD Energia Fora Ponta (kWh) 24.608,05 0,203246 0,151860 314,23 950,28 5.001,48
    TUSD Energia Ponta (kWh) 1.688,90 0,203239 0,151860 21,56 65,22 343,25
    Consumo Reativo Excedente NP (kVAr) 365,08 0,383067 0,286220 8,79 26,57 139,85
    Consumo Reativo Excedente FP (kVAr) 4.925,27 0,383071 0,286220 118,54 358,48 1.886,73
    JUL 36,79 194,80 0,00 1.688,90 24.608,05 5.290,35 0,00 0,00 0,00 0,00
    JUN 33,01 228,82 0,00 1.573,99 21.207,19 4.361,23 0,00 0,00 0,00 0,00
    MAI 29,48 201,35 0,00 1.534,24 24.572,46 5.623,68 0,00 0,00 0,00 0,00
  `);
  const result = buildInvoiceAuditResult(parsed);
  assert.equal(result.valorTotalFatura, 6984.32);
  assert.equal(result.totalMultas, 2026.58);
  assert.equal(result.consumoKwh, 26296.95);
  assert.equal(result.historico12Meses[0].reativoFp, 5290.35);
  assert.equal(result.mesesHistorico, 3);
  assert.equal(result.projecaoBase, 'historico_fatura');
  assert.ok(result.economiaAnualProjetada > 18000 && result.economiaAnualProjetada < 22000);
  assert.notEqual(result.economiaAnualProjetada, 21887.06);
});
