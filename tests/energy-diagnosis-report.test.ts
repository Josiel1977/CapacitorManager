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
