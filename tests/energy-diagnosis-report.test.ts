import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEnergyDiagnosisReport } from '../lib/energy-diagnosis-report.ts';
import { diagnoseEnergyTariffs, type EnergyStudy } from '../lib/energy-tariff-diagnosis.ts';
import { parseEquatorialInvoiceText } from '../lib/equatorial-invoice-parser.ts';
import { buildInvoiceAuditResult } from '../lib/invoice-audit-result.ts';
const study:EnergyStudy={currentKva:112.5,futureKva:225,sameUnit:true,solarLocal:true,remoteCredits:false,netPeakKwh:null,netOffPeakKwh:null,measuredPeakKw:null,measuredOffPeakKw:null,confirmed:false,tariffSource:'',scenarios:[]};
test('relatório preliminar inclui fatos e recomendações sem tabela vazia nem modalidade inventada',()=>{
 const parsed=parseEquatorialInvoiceText(`Equatorial Pará 08/2026 13/08/2026 R$ 23.842,83
 Consumo (kWh) 10.770 1,275664 0,978300 592,23 2.610,39 13.738,90
 Consumo Compensado (kWh) 3.744 0,949997 0,728550 153,32 675,79 3.556,79
 Consumo Reativo Excedente (kVAr) 1.353 0,373215 0,286220 21,77 95,94 504,96
 Parcela (7/10) 5.757,03`);
 const lines=buildEnergyDiagnosisReport({client:'Teste',notes:'',date:'09/10/2026',study,invoice:buildInvoiceAuditResult(parsed),diagnosis:diagnoseEnergyTariffs(study)});
 const text=lines.join('\n');assert.match(text,/23\.842,83/);assert.match(text,/504,96/);assert.match(text,/225 kVA/);assert.match(text,/não representa toda/);assert.match(text,/não é possível escolher/);assert.ok(!lines.includes('COMPARAÇÃO MENSAL SIMULADA'));
});
test('relatório A4 inclui contrato, histórico e ajustes sem presumir solar ou transformar ausência em zero comprovado',()=>{
 const parsed=parseEquatorialInvoiceText(`Equatorial Pará Referência: 07/2026 Total a Pagar R$ 6.984,32
GRUPO DE TENSÃO: A SUBGRUPO: A4
MODALIDADE TARIFÁRIA: A4_LVVD
Demanda Contratada Única (kW): 250,00
Dem. Máx. F. Ponta (kW): 194,80
Dem. Máx. Ponta (kW): 36,79
TUSD Energia Fora Ponta (kWh) 24.608,05 0,203246 0,151860 314,23 950,28 5.001,48
Benefício Tarifário Bruto 1.287,19 3.263,64 19.858,57
Benefício Tarifário Líquido -15.307,74
Devolução de ajuste -7.465,68`);
 parsed.historico_mensal=[{mes_referencia:'06/2026',demanda_ponta_kw:33.01,demanda_fora_ponta_kw:228.82,consumo_ponta_kwh:0,consumo_fora_ponta_kwh:0,reativo_excedente_kvarh:0}];
 const text=buildEnergyDiagnosisReport({client:'Teste',notes:'',date:'20/10/2026',study:{...study,currentKva:null,futureKva:null,sameUnit:null,solarLocal:null},invoice:buildInvoiceAuditResult(parsed),diagnosis:diagnoseEnergyTariffs(study)}).join('\n');
 assert.match(text,/contratada única: 250 kW/);
 assert.match(text,/228,82 kW/);
 assert.match(text,/21,18 kW/);
 assert.match(text,/-R\$\s*7\.465,68/);
 assert.match(text,/CONCILIAÇÃO PENDENTE/);
 assert.match(text,/não comprova ausência/);
 assert.match(text,/solicitar o projeto homologado somente se aplicável/);
 assert.ok(!text.includes('Total sem esses itens financeiros'));
 assert.ok(!text.includes('Parcelamento e encargos de atraso identificados:'));
});
