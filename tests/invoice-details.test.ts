import test from 'node:test';
import assert from 'node:assert/strict';
import {extractInvoiceDetails} from '../lib/invoice-details.ts';
test('extrai identificação, tributos, parcelas e créditos negativos sem somar imposto novamente',()=>{
 const d=extractInvoiceDetails(`GRUPO DE TENSÃO: B SUBGRUPO: B3
CLASSIFICAÇÃO: COMERCIAL B-OPTANTE
TIPO DE FORNECIMENTO: TRIFÁSICO
MODALIDADE TARIFÁRIA: B3_OUTROS
EMPRESA TESTE LTDA
CNPJ: **.***.000/000*-**
RUA TESTE, 1
CEP: 00000-000 - CIDADE - PA
Leitura Anterior Leitura Atual Nº de Dias Próxima Leitura
03/07/2026 03/08/2026 31 02/09/2026
1.000.000.001-01
ICMS 100,00 19,0000 19,00
Consumo (kWh) 100 1,000000 0,800000 1,00 19,00 100,00
Energia Ativa Injetada (kWh) 20 1,000000 0,800000 -1,00 -3,00 -20,00
Correção Monetária Parcela (1/10) 2,00
Parcela (1/10) 10,00`);
 assert.equal(d.cliente,'EMPRESA TESTE LTDA');assert.equal(d.unidade_consumidora,'1.000.000.001-01');assert.equal(d.leitura_atual,'03/08/2026');assert.equal(d.itens.length,4);assert.equal(d.itens[1].valor,-20);assert.equal(d.itens[1].icms,-3);assert.equal(d.soma_itens,92);assert.equal(d.tributos.length,1);
});
test('histórico ativo/injetado é separado e não inventado se quantidade de números divergir',()=>{
 const d=extractInvoiceDetails('JUL/26 AGO/26 Ativo Injetado 100 20 200 30 ');assert.equal(d.historico_ativo_injetado.length,2);assert.equal(d.historico_ativo_injetado[1].injetado_kwh,30);
 assert.equal(extractInvoiceDetails('JUL/26 AGO/26 Ativo Injetado 100 20 200 ').historico_ativo_injetado.length,0);
});
