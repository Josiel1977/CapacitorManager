import test from 'node:test';
import assert from 'node:assert/strict';
import {parseEquatorialInvoiceText} from '../lib/equatorial-invoice-parser.ts';
import {buildInvoiceAuditResult} from '../lib/invoice-audit-result.ts';
import {newExpansionStudy} from '../lib/expansion-study.ts';
import {invoiceStudyFacts,tariffStudyFromInvoice,expansionStudyFromInvoice,energyStudyFromInvoice,consultancyInvoiceImportNotice} from '../lib/audit-study-import.ts';
import type {ConsultingStudy} from '../lib/tariff-consultancy.ts';
import type {EnergyStudy} from '../lib/energy-tariff-diagnosis.ts';
const base=():ConsultingStudy=>({version:1,client:'',uc:'',distributor:'',subgroup:'A4',current:'verde',months:[],tariffs:[],contractedPeak:null,contractedOffPeak:null,minimumPeak:30,minimumOffPeak:30,growthPercent:0,marginPercent:10,availabilityKwh:100,gd:false,gdVerified:false,alternativesApproved:false,reviewed:false,notes:''});
const energy=():EnergyStudy=>({currentKva:null,futureKva:null,sameUnit:null,solarLocal:null,remoteCredits:null,netPeakKwh:null,netOffPeakKwh:null,measuredPeakKw:null,measuredOffPeakKw:null,confirmed:false,tariffSource:'',scenarios:[]});
const solar=()=>buildInvoiceAuditResult(parseEquatorialInvoiceText(`Equatorial Pará Referência: 08/2026 Total a Pagar R$ 1.000,00
GRUPO DE TENSÃO: B SUBGRUPO: B3
CLASSIFICAÇÃO: COMERCIAL B-OPTANTE
CLIENTE SOLAR TESTE
CNPJ: **.***.000/000*-**
1.000.000.001-01
Consumo (kWh) 100 1,000000 0,800000 1,00 19,00 100,00
Consumo Compensado (kWh) 20 1,000000 0,800000 1,00 19,00 20,00
Energia Ativa Injetada (kWh) 30 1,000000 0,800000 -1,00 -19,00 -30,00`));
test('mesma auditoria abastece identificação, evidências solares e relatórios de consultoria/expansão',()=>{
 const invoice=solar(),facts=invoiceStudyFacts(invoice);
 const consulting=tariffStudyFromInvoice(base(),invoice),expansion=expansionStudyFromInvoice(newExpansionStudy(),invoice);
 assert.equal(consulting.client,'CLIENTE SOLAR TESTE');assert.equal(expansion.client,consulting.client);assert.equal(consulting.uc,'1.000.000.001-01');assert.equal(expansion.uc,consulting.uc);
 assert.equal(facts.injected,30);assert.equal(facts.compensated,20);assert.equal(consulting.months[0].injectedKwh,30);assert.equal(consulting.months[0].compensatedKwh,20);
 assert.equal(expansion.scee,true);assert.match(expansion.notes,/injetada na rede: 30 kWh/);assert.match(expansion.notes,/compensada: 20 kWh/);
 assert.equal(expansion.currentKva,null);assert.equal(expansion.measuredKw,null);assert.equal(expansion.baselinePf,null);assert.equal(expansion.localGeneration,null);
});
test('SCEE não fabrica perfil líquido por posto nem geração total com histórico incompleto',()=>{
 const invoice=solar();invoice.historico_mensal=[{mes_referencia:'07/2026',consumo_ponta_kwh:1,consumo_fora_ponta_kwh:99,reativo_excedente_kvarh:0}];
 const result=tariffStudyFromInvoice(base(),invoice);
 assert.ok(result.months.every(month=>month.peakKwh===null&&month.offPeakKwh===null&&month.intermediateKwh===null));
 assert.equal(result.months.find(month=>month.month==='2026-07')?.injectedKwh,null);
 assert.match(result.notes,/nenhuma representa a geração solar total/);
});
test('dado solar ausente permanece desconhecido; zero explícito na linha é preservado',()=>{
 const invoice=buildInvoiceAuditResult(parseEquatorialInvoiceText('Equatorial Pará Referência: 07/2026 Total a Pagar R$ 100,00'));
 const facts=invoiceStudyFacts(invoice);assert.equal(facts.injected,null);assert.equal(facts.compensated,null);assert.equal(facts.gd,false);
 const explicit=solar();explicit.consultoria!.energia_injetada_kwh=0;
 explicit.detalhes_fatura!.itens.find(item=>/^Consumo Compensado/.test(item.descricao))!.quantidade=0;
 assert.equal(invoiceStudyFacts(explicit).injected,0);assert.equal(invoiceStudyFacts(explicit).compensated,0);
 assert.equal(expansionStudyFromInvoice(newExpansionStudy(),invoice).scee,null);
});
test('grupo A preserva demanda medida/contratada e campos identificados, sem copiar kW para kVA',()=>{
 const invoice=buildInvoiceAuditResult(parseEquatorialInvoiceText(`Equatorial Pará Referência: 07/2026 Total a Pagar R$ 100,00
GRUPO DE TENSÃO: A SUBGRUPO: A4
Demanda Contratada Única (kW): 250,00
Dem. Máx. F. Ponta (kW): 194,80
Dem. Máx. Ponta (kW): 36,79
TUSD Energia Fora Ponta (kWh) 90 1,000000 0,800000 1,00 19,00 90,00
TUSD Energia Ponta (kWh) 10 1,000000 0,800000 1,00 19,00 10,00`));
 const consulting=tariffStudyFromInvoice(base(),invoice),diagnosis=energyStudyFromInvoice(energy(),invoice);
 assert.equal(consulting.contractedOffPeak,250);assert.equal(diagnosis.measuredOffPeakKw,194.8);assert.equal(diagnosis.measuredPeakKw,36.79);
 assert.equal(diagnosis.currentKva,null);assert.equal(diagnosis.netPeakKwh,10);assert.equal(diagnosis.netOffPeakKwh,90);
});
test('nova importação substitui a identidade anterior sem mudar o objeto-base nem transportar confirmações',()=>{
 const old=base();old.client='OUTRO CLIENTE';old.reviewed=true;const snapshot=JSON.stringify(old);
 const imported=tariffStudyFromInvoice(old,solar());assert.equal(imported.client,'CLIENTE SOLAR TESTE');assert.equal(imported.reviewed,false);assert.equal(JSON.stringify(old),snapshot);
});

const tariffBase=():ConsultingStudy=>({...base(),tariffs:(['verde','azul','convencional','branca'] as const).map(mode=>({mode,peak:null,offPeak:null,intermediate:null,demandPeak:null,demandOffPeak:null,residualGd:null,source:'',date:'',verified:false}))});
test('consultoria importa a tarifa explícita sem tributos do B-optante sem copiar custos brutos nem inventar vigência',()=>{
 const bill=solar();bill.valorTotalFatura=bill.detalhes_fatura!.soma_itens!;
 const result=tariffStudyFromInvoice(tariffBase(),bill),current=result.tariffs.find(t=>t.mode==='convencional')!;
 assert.equal(current.offPeak,0.8);assert.equal(current.residualGd,null);assert.equal(current.date,'');assert.equal(current.verified,false);
 assert.match(current.source,/sem tributos/);assert.match(current.source,/08\/2026/);
 assert.equal(result.tariffs.find(t=>t.mode==='verde')!.offPeak,null);assert.equal(result.reviewed,false);
 assert.match(consultancyInvoiceImportNotice(bill),/1 valor/);
});
test('consultoria soma TE e TUSD sem tributos somente na modalidade identificada',()=>{
 const bill=buildInvoiceAuditResult(parseEquatorialInvoiceText(`Equatorial Pará Referência: 07/2026 Total a Pagar R$ 558,00
GRUPO DE TENSÃO: A SUBGRUPO: A4
MODALIDADE TARIFÁRIA: VERDE
TE Energia Fora Ponta (kWh) 100 0,300000 0,200000 1,00 2,00 30,00
TUSD Energia Fora Ponta (kWh) 100 0,200000 0,100000 1,00 2,00 20,00
TE Energia Ponta (kWh) 10 0,500000 0,400000 1,00 2,00 5,00
TUSD Energia Ponta (kWh) 10 0,300000 0,200000 1,00 2,00 3,00
Demanda Única (kW) 50 10,000000 8,000000 1,00 2,00 500,00`));
 const result=tariffStudyFromInvoice(tariffBase(),bill),current=result.tariffs.find(t=>t.mode==='verde')!;
 assert.equal(current.offPeak,0.3);assert.equal(current.peak,0.6);assert.equal(current.demandOffPeak,8);
 assert.equal(result.tariffs.find(t=>t.mode==='azul')!.demandOffPeak,null);assert.match(consultancyInvoiceImportNotice(bill),/3 valor/);
});
test('aviso da consultoria distingue ausência de tarifa, modalidade ambígua e conciliação pendente',()=>{
 const bill=solar();bill.valorTotalFatura=bill.detalhes_fatura!.soma_itens!;
 bill.detalhes_fatura!.itens[0].tarifa_sem_tributos=null;
 assert.match(consultancyInvoiceImportNotice(bill),/Nenhuma tarifa completa/);
 assert.equal(tariffStudyFromInvoice(tariffBase(),bill).tariffs.find(t=>t.mode==='convencional')!.offPeak,null);
 bill.contexto_energetico!.b_optante=false;bill.detalhes_fatura!.grupo='A';bill.detalhes_fatura!.modalidade='A4_LVVD';
 assert.match(consultancyInvoiceImportNotice(bill),/modalidade não foi identificada/);
 bill.valorTotalFatura=999;assert.match(consultancyInvoiceImportNotice(bill),/soma dos itens diverge/);
});
