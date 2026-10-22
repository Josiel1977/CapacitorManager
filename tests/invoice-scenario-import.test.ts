import test from 'node:test';
import assert from 'node:assert/strict';
import {parseEquatorialInvoiceText} from '../lib/equatorial-invoice-parser.ts';
import {buildInvoiceAuditResult} from '../lib/invoice-audit-result.ts';
import {extractInvoiceDetails,type InvoiceDetails} from '../lib/invoice-details.ts';
import {fillInvoiceScenario,invoiceCurrentMode,invoiceScenarioValues} from '../lib/invoice-scenario-import.ts';
import {energyStudyFromInvoice} from '../lib/audit-study-import.ts';
import type {Mode,TariffScenario,EnergyStudy} from '../lib/energy-tariff-diagnosis.ts';
type Item=InvoiceDetails['itens'][number];
const item=(descricao:string,valor:number,rate:number|null=null,quantity:number|null=null):Item=>({descricao,valor,tarifa_com_tributos:rate,tarifa_sem_tributos:rate===null?null:rate/2,quantidade:quantity,pis_cofins:123,icms:456});
const scenario=(mode:Mode):TariffScenario=>({mode,energyPeak:null,energyOffPeak:null,demandPeak:null,demandOffPeak:null,contractedPeak:null,contractedOffPeak:null,gdCharge:null,otherCharges:null});
function invoice(items:Item[],group='B',code='B3_OUTROS'){
 const result=buildInvoiceAuditResult(parseEquatorialInvoiceText('Equatorial Pará Referência: 08/2026 Total a Pagar R$ 1,00'));
 const details=extractInvoiceDetails('');details.grupo=group;details.modalidade=code;details.itens=items;details.soma_itens=items.reduce((sum,row)=>sum+row.valor,0);
 result.detalhes_fatura=details;result.valorTotalFatura=details.soma_itens;
 result.contexto_energetico={...result.contexto_energetico!,b_optante:group==='B'};return result;
}
test('importa custos identificados sem dívida, juros, multa, benefícios ou tributos demonstrativos em duplicidade',()=>{
 const bill=invoice([item('Consumo (kWh)',13738.9,1.275664,10770),item('Cip-Ilum Pub Pref Munic',898.53),item('Adicional Bandeira',264.72),item('Consumo Reativo Excedente (kVAr)',504.96),item('Parc. Inj. s/ Desc. - GD2 (kWh)',1119.42),item('Parcela (7/10)',5757.03),item('Multa',469.48),item('Juros',281.69),item('Correção Monetária',82.46),item('Benefício Tarifário Bruto SCEE',2403.53),item('Benefício Tarifário Líquido SCEE',-1860.95)]);
 const filled=fillInvoiceScenario(scenario('B-optante'),bill);
 assert.equal(filled.energyOffPeak,1.275664);assert.equal(filled.otherCharges,1668.21);assert.equal(filled.gdCharge,1119.42);
 assert.equal(bill.detalhes_fatura!.itens[0].tarifa_sem_tributos,1.275664/2);
});
test('energia Grupo A só é preenchida com TE e TUSD do mesmo posto e quantidades compatíveis',()=>{
 const bill=invoice([item('TUSD Energia Fora Ponta (kWh)',20,0.2,100),item('TE Energia Fora Ponta (kWh)',30,0.3,100),item('TUSD Energia Ponta (kWh)',3,0.3,10),item('TE Energia Ponta (kWh)',5,0.5,10),item('Demanda (kW)',1000,10,100),item('Ultrapassagem Demanda (kW)',400,20,20)],'A','VERDE');
 const filled=fillInvoiceScenario(scenario('A-verde'),bill);
 assert.equal(filled.energyOffPeak,0.5);assert.equal(filled.energyPeak,0.8);assert.equal(filled.demandOffPeak,10);
 bill.detalhes_fatura!.itens.find(row=>row.descricao.startsWith('TE Energia Fora'))!.quantidade=90;
 assert.equal(fillInvoiceScenario(scenario('A-verde'),bill).energyOffPeak,null);
});
test('TUSD isolada, GD ausente e modalidade codificada não geram tarifa completa nem zero presumido',()=>{
 const bill=invoice([item('TUSD Energia Fora Ponta (kWh)',20,0.2,100)],'A','A4_LVVD');
 assert.equal(invoiceCurrentMode(bill),null);
 const filled=fillInvoiceScenario(scenario('A-verde'),bill);
 assert.equal(filled.energyOffPeak,null);assert.equal(filled.gdCharge,null);assert.equal(filled.otherCharges,null);
 assert.match(invoiceScenarioValues(bill,null).pending.join(' '),/Confirme a modalidade/);
});
test('fatura com modalidade identificada não é copiada para uma alternativa e edição manual é preservada',()=>{
 const bill=invoice([item('Consumo (kWh)',100,1,100),item('Adicional Bandeira',5)]);
 const other=scenario('A-verde');assert.deepEqual(fillInvoiceScenario(other,bill),other);
 const current={...scenario('B-optante'),energyOffPeak:9,otherCharges:0};const result=fillInvoiceScenario(current,bill);
 assert.equal(result.energyOffPeak,9);assert.equal(result.otherCharges,0);assert.equal(current.gdCharge,null);
});
test('soma divergente bloqueia importação e crédito em custo recorrente exige conferência',()=>{
 const bill=invoice([item('Consumo (kWh)',100,1,100),item('Adicional Bandeira',5)]);bill.valorTotalFatura=999;
 assert.deepEqual(fillInvoiceScenario(scenario('B-optante'),bill),scenario('B-optante'));
 assert.equal(invoiceScenarioValues(bill,'B-optante').reconciled,false);
 const credit=invoice([item('Adicional Bandeira',-5)]);assert.equal(fillInvoiceScenario(scenario('B-optante'),credit).otherCharges,null);
});
test('auditoria preenche somente cenário atual e mantém comparação sem confirmação',()=>{
 const bill=invoice([item('Consumo (kWh)',100,1,100),item('Adicional Bandeira',5)]);
 const base:EnergyStudy={currentKva:null,futureKva:null,sameUnit:null,solarLocal:null,remoteCredits:null,netPeakKwh:null,netOffPeakKwh:null,measuredPeakKw:null,measuredOffPeakKw:null,confirmed:true,tariffSource:'',scenarios:[scenario('B-optante'),scenario('A-verde'),scenario('A-azul')]};
 const result=energyStudyFromInvoice(base,bill);
 assert.equal(result.scenarios[0].energyOffPeak,1);assert.equal(result.scenarios[0].otherCharges,5);assert.equal(result.scenarios[1].otherCharges,null);assert.equal(result.confirmed,false);assert.match(result.tariffSource,/08\/2026/);assert.equal(base.scenarios[0].energyOffPeak,null);
});
test('extrator reconhece TE e demanda regular como linhas diferentes de ultrapassagem',()=>{
 const details=extractInvoiceDetails('TE Energia Fora Ponta (kWh) 100 0,300000 0,200000 1,00 2,00 30,00\nDemanda Única (kW) 50 10,000000 8,000000 1,00 2,00 500,00\nUltrapassagem Demanda (kW) 10 20,000000 16,000000 1,00 2,00 200,00');
 assert.equal(details.itens.length,3);assert.equal(details.itens[0].tarifa_com_tributos,0.3);assert.equal(details.itens[1].tarifa_com_tributos,10);assert.equal(details.soma_itens,730);
});
