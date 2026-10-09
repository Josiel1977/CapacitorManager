import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseEnergyTariffs, type EnergyStudy, type Mode } from '../lib/energy-tariff-diagnosis.ts';
import { parseEquatorialInvoiceText } from '../lib/equatorial-invoice-parser.ts';
const study = (): EnergyStudy => ({currentKva:112.5,futureKva:225,sameUnit:true,solarLocal:true,remoteCredits:false,netPeakKwh:100,netOffPeakKwh:1000,measuredPeakKw:40,measuredOffPeakKw:60,confirmed:true,tariffSource:'Tabela conferida de teste',scenarios:(['B-optante','A-verde','A-azul'] as Mode[]).map(mode=>({mode,energyPeak:2,energyOffPeak:0.5,demandPeak:20,demandOffPeak:10,contractedPeak:40,contractedOffPeak:60,gdCharge:100,otherCharges:50}))});
test('225 kVA na mesma UC exclui B-optante da recomendação apesar do custo inferior',()=>{
 const r=diagnoseEnergyTariffs(study());assert.equal(r.bEligibility,'incompativel');assert.equal(r.best,'A-verde');assert.equal(r.results[0].total,700);assert.equal(r.results[1].total,1450);assert.equal(r.results[2].total,2250);
});
test('limite 112,5 kVA, créditos remotos e UCs separadas não são confundidos',()=>{
 const s=study();s.futureKva=112.5;assert.equal(diagnoseEnergyTariffs(s).bEligibility,'compativel');
 s.remoteCredits=true;assert.equal(diagnoseEnergyTariffs(s).bEligibility,'incompativel');
 s.sameUnit=false;assert.equal(diagnoseEnergyTariffs(s).best,null);
});
test('demanda verde usa máximo dos dois postos e cobra ultrapassagem somente acima de 5%',()=>{
 const s=study();s.measuredPeakKw=63;const r=diagnoseEnergyTariffs(s);assert.equal(r.results[1].demand,630);assert.equal(r.results[1].excess,0);
 s.measuredPeakKw=66;const next=diagnoseEnergyTariffs(s);assert.equal(next.results[1].demand,660);assert.equal(next.results[1].excess,120);
});
test('dados ausentes, tributos não conferidos e tarifa sem fonte bloqueiam recomendação',()=>{
 const s=study();s.netPeakKwh=null;assert.equal(diagnoseEnergyTariffs(s).best,null);
 s.netPeakKwh=0;s.confirmed=false;assert.equal(diagnoseEnergyTariffs(s).best,null);
 s.confirmed=true;s.tariffSource='';assert.equal(diagnoseEnergyTariffs(s).best,null);
 s.tariffSource='Tabela';s.scenarios[1].gdCharge=null;assert.equal(diagnoseEnergyTariffs(s).best,null);
});
test('não recomenda modalidade arbitrária quando custos empatam',()=>{
 const s=study();s.scenarios[2].demandPeak=0.0001;s.scenarios[1].otherCharges=50.004;
 assert.equal(diagnoseEnergyTariffs(s).best,null);
});
test('fatura B-optante com quantidades inteiras separa compensação e dívida sem pegar débito antigo como total',()=>{
 const p=parseEquatorialInvoiceText(`Equatorial Pará B-OPTANTE 08/2026 13/08/2026 R$ 23.842,83 DEBITOS 07/2026 R$27.735,10
 Consumo (kWh) 10.770 1,275664 0,978300 592,23 2.610,39 13.738,90
 Consumo Compensado (kWh) 3.744 0,949997 0,728550 153,32 675,79 3.556,79
 Parc. Inj. s/ Desc. - GD2 (kWh) 3.744 0,298990 0,231501 48,71 203,98 1.119,42
 Consumo Reativo Excedente (kVAr) 1.353 0,373215 0,286220 21,77 95,94 504,96
 Parcela (7/10) 5.757,03 Multa 469,48 Correção Monetária 82,46 Juros 281,69 Correção Monetária Parcela (7/10) 183,06`);
 assert.equal(p.total_pagar,23842.83);assert.equal(p.penalidade_reativa_informada,504.96);assert.equal(p.consumo_fora_ponta_kwh,10770);
 assert.deepEqual(p.contexto_energetico,{b_optante:true,gd2:true,energia_compensada_kwh:3744,consumo_rede_kwh:14514,divida_e_atrasos:6773.72});
 assert.equal(p.fp_calculado,undefined);
});

test('total do boleto prevalece sobre débitos antigos quando resumo gráfico não é extraído',()=>{
 const p=parseEquatorialInvoiceText('Equatorial Pará Referência 08/2026 DEBITOS 07/2026 R$ 27.735,10 VALOR (=) VALOR DOCUMENTO 17 R$ 23.842,83');
 assert.equal(p.total_pagar,23842.83);
});
