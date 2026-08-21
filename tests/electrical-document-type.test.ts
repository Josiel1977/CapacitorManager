import test from 'node:test';
import assert from 'node:assert/strict';
import { detectElectricalDocumentType } from '../lib/electrical-document-type.ts';

test('reconhece uma fatura Equatorial', () => {
  assert.equal(detectElectricalDocumentType(`
    Equatorial Pará Distribuidora de Energia S.A.
    TUSD Energia Fora Ponta (kWh)
    Consumo Reativo Excedente FP (kVAr)
    Demanda Contratada Única (kW)
  `, 'EQTL - 07.2026.pdf'), 'equatorial_invoice');
});

test('reconhece um relatório de analisador Embrasul', () => {
  assert.equal(detectElectricalDocumentType(`
    EMBRASUL BPNHT N.S:70001762 V.S.2,0
    Intervalo considerado: 10/07/2026 15:00:00 até 10/07/2026 20:00:00
    Potências médias Total 100,0 40,0 107,7 0,928
  `), 'embrasul_report');
});

test('não adivinha o tipo de um documento sem evidências', () => {
  assert.equal(detectElectricalDocumentType('Relatório elétrico sem grandezas identificáveis'), 'unknown');
});
