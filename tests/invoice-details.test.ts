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
test('concilia modelo A4 com benefícios sem SCEE, devolução negativa, encargo e vencimento pontuado',()=>{
 const details=extractInvoiceDetails(`TUSD Energia Fora Ponta (kWh) 24.608,05 0,203246 0,151860 314,23 950,28 5.001,48
TUSD Energia Ponta (kWh) 1.688,90 0,203239 0,151860 21,56 65,22 343,25
Consumo Reativo Excedente NP (kVAr) 365,08 0,383067 0,286220 8,79 26,57 139,85
Consumo Reativo Excedente FP (kVAr) 4.925,27 0,383071 0,286220 118,54 358,48 1.886,73
Encargo Escassez Hídrica 26.296,95 0,004604 0,003440 7,61 23,00 121,07
Benefício Tarifário Bruto 1.287,19 3.263,64 19.858,57 Demanda Contratada Única (kW): 250,00
Devolução de ajuste -7.465,68
Benefício Tarifário Líquido -15.307,74
Cip-Ilum Pub Pref Munic 2.406,79
PAGÁVEL PREFERENCIALMENTE NO BANCO DO BRASIL 21.10.2026`);
 assert.equal(details.itens.length,9);
 assert.equal(details.soma_itens,6984.32);
 assert.equal(details.vencimento,'21/10/2026');
 assert.equal(details.itens[5].icms,3263.64);
 assert.equal(details.itens[6].valor,-7465.68);
});
