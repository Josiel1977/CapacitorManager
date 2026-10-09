import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnergyDiagnosisPdf } from '../lib/energy-diagnosis-pdf.ts';
test('gera PDF direto com paginação e texto sem depender da impressão ou de simulação preenchida',async()=>{
 const pdf=await createEnergyDiagnosisPdf(['RELATÓRIO DE DIAGNÓSTICO ENERGÉTICO',...Array.from({length:120},()=> 'Fatura: R$ 23.842,83. Compensação solar e recomendações preliminares; comparação ainda pendente.')]);
 assert.ok(pdf.getNumberOfPages()>1);const output=pdf.output();assert.ok(output.startsWith('%PDF-'));assert.match(output,/23\.842,83/);assert.match(output,/Capacitor Manager/);
});
