import test from "node:test";
import assert from "node:assert/strict";
import { parseEquatorialInvoiceText, reconstructPdfText } from "../lib/equatorial-invoice-parser.ts";

const invoiceText = `
Equatorial Pará Distribuidora de Energia S.A.
Conta Mês 07/2026 Total a Pagar R$ 6.984,32
Leitura Anterior 30/06/2026 Leitura Atual 31/07/2026 Nº de Dias 31
TUSD Energia Fora Ponta (kWh) 24.608,05 0,203246 0,151860 314,23 950,28 5.001,48
TUSD Energia Ponta (kWh) 1.688,90 0,203239 0,151860 21,56 65,22 343,25
Consumo Reativo Excedente NP (kVAr) 365,08 0,383067 0,286220 8,79 26,57 139,85
Consumo Reativo Excedente FP (kVAr) 4.925,27 0,383071 0,286220 118,54 358,48 1.886,73
Dem. Máx. F. Ponta (kW): 194,80 Dem. Máx. Ponta (kW): 36,79
MÊS PONTA FORA PONTA REATIVO EXCEDENTE PONTA/TOT FORA PONTA REATIVO EXCEDENTE CONSUMO REATIVO EXCEDENTE PONTA FORA PONTA
JUL 36,79 194,80 0,00 1.688,90 24.608,05 5.290,35 0,00 0,00 0,00 0,00
JUN 33,01 228,82 0,00 1.573,99 21.207,19 4.361,23 0,00 0,00 0,00 0,00
MAI 29,48 201,35 0,00 1.534,24 24.572,46 5.623,68 0,00 0,00 0,00 0,00
DEZ 70,31 183,20 0,00 1.655,77 21.272,14 3.615,58 0,00 0,00 0,00 0,00
NOV 43,09 202,36 0,00 1.541,86 22.063,23 4.291,82 0,00 0,00 0,00 0,00
`;

test("extrai o novo layout Equatorial de julho de 2026", () => {
  const result = parseEquatorialInvoiceText(invoiceText);
  assert.equal(result.concessionaria, "EQUATORIAL_PARA");
  assert.equal(result.mes_referencia, "07/2026");
  assert.equal(result.consumo_ponta_kwh, 1688.9);
  assert.equal(result.consumo_fora_ponta_kwh, 24608.05);
  assert.equal(result.demanda_ponta_kw, 36.79);
  assert.equal(result.demanda_fora_ponta_kw, 194.8);
  assert.equal(result.reativo_ponta_kvarh, 365.08);
  assert.equal(result.reativo_fora_ponta_kvarh, 4925.27);
  assert.equal(result.total_pagar, 6984.32);
  assert.equal(result.dias_ciclo, 31);
  assert.equal(result.historico_mensal.length, 5);
  assert.deepEqual(result.historico_mensal[0], {
    mes_referencia: "07/2026",
    consumo_ponta_kwh: 1688.9,
    consumo_fora_ponta_kwh: 24608.05,
    reativo_excedente_kvarh: 5290.35,
  });
  assert.equal(result.historico_mensal[3].mes_referencia, "12/2025");
});

test("classifica reativo excedente sem inventar fator de potência", () => {
  const result = parseEquatorialInvoiceText(invoiceText);
  assert.equal(result.reativo_origem, "excedente_faturado");
  assert.equal(result.fp_calculado, undefined);
  assert.equal(result.penalidade_reativa_informada, 2026.58);
  assert.ok(Math.abs((result.tarifa_reativa_aplicada ?? 0) - 0.3830707) < 0.000001);
  assert.equal(result.fonte_dados, "pdf");
});

test("reconstrói linhas por coordenadas antes de interpretar o PDF", () => {
  const text = reconstructPdfText([
    { str: "24.608,05", transform: [1, 0, 0, 1, 300, 500] },
    { str: "TUSD Energia Fora Ponta (kWh)", transform: [1, 0, 0, 1, 30, 500] },
    { str: "07/2026", transform: [1, 0, 0, 1, 250, 700] },
    { str: "Conta Mês", transform: [1, 0, 0, 1, 30, 700] },
  ]);
  assert.equal(text, "Conta Mês 07/2026\nTUSD Energia Fora Ponta (kWh) 24.608,05");
});

test("recupera cabeçalho fragmentado do novo formulário gráfico", () => {
  const fragmented = `${invoiceText.replace("Conta Mês 07/2026 Total a Pagar R$ 6.984,32", "Conta Mês Total a Pagar")}
    30/06/2026 31/07/2026 31/08/2026 07/2026 07/2026
    Equatorial Energia Pará Distribuidora
    R$ 6.984,32`;
  const result = parseEquatorialInvoiceText(fragmented);
  assert.equal(result.mes_referencia, "07/2026");
  assert.equal(result.concessionaria, "EQUATORIAL_PARA");
  assert.equal(result.total_pagar, 6984.32);
});

test("não confunde competência com emissão ou próxima leitura", () => {
  const graphicHeader = `${invoiceText.replace("Conta Mês 07/2026 Total a Pagar R$ 6.984,32", "")}
    Leitura Anterior Leitura Atual Nº de Dias Próxima Leitura
    30/06/2026 31/07/2026 31 31/08/2026
    07/2026 21/10/2026 R$ 6.984,32 07/08/2026 às 09:52:28`;
  assert.equal(parseEquatorialInvoiceText(graphicHeader).mes_referencia, "07/2026");
});

test("prioriza competência auditável presente no nome do PDF", () => {
  const ambiguous = `${invoiceText.replace(/Conta Mês 07\/2026/, "")}
    30/06/2026 31/07/2026 31/08/2026 07/08/2026 07/08/2026`;
  assert.equal(parseEquatorialInvoiceText(ambiguous, "EQTL - 07.2026.pdf").mes_referencia, "07/2026");
});
