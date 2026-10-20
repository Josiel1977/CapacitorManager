import test from 'node:test';
import assert from 'node:assert/strict';
import { extractInvoiceDetails } from '../lib/invoice-details.ts';
import { reviewInvoiceCharges } from '../lib/invoice-charge-review.ts';

test('separa encargos financeiros, reativo, principal e créditos sem prometer recuperação', () => {
  const details = extractInvoiceDetails(`Multa 469,48
Juros 281,69
Correção Monetária 82,46
Correção Monetária Parcela (7/10) 183,06
Parcela (7/10) 5.757,03
Consumo Reativo Excedente (kVARh) 1.353 0,373215 0,300000 0,00 0,00 504,96
Multa -10,00`);
  const review = reviewInvoiceCharges(details, 7268.68);
  assert.equal(review.financialCharges, 1016.69);
  assert.equal(review.reactiveCharges, 504.96);
  assert.equal(review.debtInstallments, 5757.03);
  assert.equal(review.items.at(-1)?.credit, true);
  assert.equal(review.reconciled, true);
});
test('não declara ausência de cobranças ou conciliação quando a extração está vazia', () => {
  const review = reviewInvoiceCharges(extractInvoiceDetails('PDF sem itens reconhecidos'), 100);
  assert.equal(review.extractedTotal, null);
  assert.equal(review.reconciled, false);
});
test('classifica ultrapassagem antes de multa, mantém bandeira e tributos separados', () => {
  const details = extractInvoiceDetails('');
  const item = (descricao: string, valor: number) => ({ descricao, valor, quantidade: null, tarifa_com_tributos: null, tarifa_sem_tributos: null, pis_cofins: null, icms: null });
  details.itens = [item('Multa por ultrapassagem de demanda', 100), item('Adicional Bandeira', 20), item('ICMS', 19)];
  const review = reviewInvoiceCharges(details, 150);
  assert.equal(review.demandExcessCharges, 100);
  assert.equal(review.financialCharges, 0);
  assert.equal(review.difference, 11);
  assert.equal(review.reconciled, false);
});
test('extrai cobranças de ultrapassagem sem confundir leitura de demanda com item faturado', () => {
  const details = extractInvoiceDetails(`Ultrapassagem de Demanda FP (kW) 10 10,000000 8,000000 0,00 0,00 100,00
Multa por Ultrapassagem Demanda Ponta 50,00
Demanda Ultrapassagem (kW) 20,00
Demanda medida 250,00`);
  assert.equal(details.itens.length, 3);
  assert.equal(reviewInvoiceCharges(details, 170).demandExcessCharges, 170);
});
