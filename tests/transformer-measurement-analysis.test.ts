import test from "node:test";
import assert from "node:assert/strict";
import { analyzeTransformerMeasurements } from "../lib/transformer-measurement-analysis.ts";

test("calcula carregamento usando potência aparente informada", () => {
  const result = analyzeTransformerMeasurements(100, [
    { apparentPowerKva: 40, powerFactor: 0.95, thdvPercent: 2, thdiPercent: 8 },
    { apparentPowerKva: 80, powerFactor: 0.94, thdvPercent: 3, thdiPercent: 10 },
    { apparentPowerKva: 60, powerFactor: 0.96, thdvPercent: 2, thdiPercent: 9 },
  ]);
  assert.equal(result.minimumLoadPercent, 40);
  assert.equal(result.maximumLoadPercent, 80);
  assert.equal(result.averageLoadPercent, 60);
});

test("deriva potência aparente de P e Q", () => {
  const result = analyzeTransformerMeasurements(100, [
    { activePowerKw: 30, reactivePowerKvar: 40 },
  ]);
  assert.equal(result.maximumLoadPercent, 50);
  assert.equal(result.averagePowerFactor, 0.6);
});

test("detecta sobrecarga e classifica como crítico", () => {
  const result = analyzeTransformerMeasurements(100, [
    { apparentPowerKva: 105, powerFactor: 0.95 },
    { apparentPowerKva: 90, powerFactor: 0.95 },
    { apparentPowerKva: 85, powerFactor: 0.95 },
  ]);
  assert.equal(result.status, "critico");
  assert.match(result.alerts.join(" "), /acima da potência nominal/);
});

test("detecta indício de sobrecompensação por reativo negativo", () => {
  const result = analyzeTransformerMeasurements(100, [
    { activePowerKw: 20, reactivePowerKvar: -15 },
    { activePowerKw: 25, reactivePowerKvar: -10 },
    { activePowerKw: 30, reactivePowerKvar: 5 },
  ]);
  assert.equal(result.capacitiveSamples, 2);
  assert.equal(result.status, "critico");
});

test("THD é triagem configurável e não conclusão normativa", () => {
  const result = analyzeTransformerMeasurements(100, [
    { apparentPowerKva: 60, powerFactor: 0.95, thdvPercent: 6, thdiPercent: 10 },
    { apparentPowerKva: 65, powerFactor: 0.96, thdvPercent: 3, thdiPercent: 25 },
    { apparentPowerKva: 70, powerFactor: 0.97, thdvPercent: 2, thdiPercent: 8 },
  ]);
  assert.equal(result.harmonicAttentionSamples, 2);
  assert.match(result.limitations[0], /não substitui estudo elétrico/);
});

test("não declara confiança sem amostragem mínima", () => {
  const result = analyzeTransformerMeasurements(100, [
    { apparentPowerKva: 60, powerFactor: 0.95 },
    { apparentPowerKva: 70, powerFactor: 0.94 },
  ]);
  assert.equal(result.confidence, "insuficiente");
  assert.match(result.limitations.join(" "), /Amostragem insuficiente/);
});
