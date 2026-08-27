import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateExpectedCapacitorCurrent, calculateTheoreticalCurrent } from '../lib/domain/capacitorAnalysis.ts';

test('corrente esperada nominal coincide com a fórmula trifásica', () => {
  assert.ok(Math.abs(calculateExpectedCapacitorCurrent(30, 480, 480) - calculateTheoreticalCurrent(30, 480)) < 1e-9);
});

test('corrente cai proporcionalmente à tensão para capacitância constante', () => {
  const result = calculateExpectedCapacitorCurrent(30, 480, 440, 60, 60);
  assert.ok(Math.abs(result - 33.08) < 0.02);
});

test('corrente esperada acompanha a frequência', () => {
  const at50Hz = calculateExpectedCapacitorCurrent(30, 480, 480, 60, 50);
  const at60Hz = calculateExpectedCapacitorCurrent(30, 480, 480, 60, 60);
  assert.ok(Math.abs(at50Hz / at60Hz - 5 / 6) < 1e-9);
});
