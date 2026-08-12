import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCommercialStages,
  calculateAuditableSizing,
  compensationKvar,
  percentileValue,
} from "../lib/capacitor-sizing.ts";

test("aplica a fórmula clássica de compensação", () => {
  const result = compensationKvar(100, 0.8, 0.92);
  assert.ok(Math.abs(result - 32.402) < 0.01);
});

test("usa o FP alvo selecionado", () => {
  assert.ok(compensationKvar(100, 0.8, 0.95) > compensationKvar(100, 0.8, 0.92));
});

test("percentil não equivale automaticamente ao pior caso", () => {
  assert.equal(percentileValue([10, 20, 30, 100], 0.5), 25);
  assert.equal(percentileValue([10, 20, 30, 100], 0.9), 79);
});

test("não força banco mínimo de 20 kVAr", () => {
  const invoices = ["01", "02", "03"].map((month) => ({
    id: month,
    month,
    demandKw: 10,
    measuredPowerFactor: 0.9,
  }));
  const result = calculateAuditableSizing(invoices, { targetPowerFactor: 0.92 });
  assert.equal(result.commercialKvar, 2.5);
});

test("bloqueia recomendação com menos de três faturas válidas", () => {
  const result = calculateAuditableSizing([
    { id: "1", month: "01", demandKw: 100, measuredPowerFactor: 0.8 },
    { id: "2", month: "02", demandKw: 100 },
  ], { targetPowerFactor: 0.92 });
  assert.equal(result.confidence, "insufficient");
  assert.equal(result.commercialKvar, 0);
  assert.equal(result.excludedInvoices.length, 1);
});

test("limita o banco pela capacidade preventiva dos transformadores", () => {
  const invoices = ["01", "02", "03", "04", "05", "06"].map((month) => ({
    id: month,
    month,
    demandKw: 500,
    measuredPowerFactor: 0.5,
  }));
  const result = calculateAuditableSizing(invoices, {
    targetPowerFactor: 0.92,
    installedTransformerKva: 100,
    transformerSafetyLimit: 0.4,
  });
  assert.equal(result.commercialKvar, 40);
  assert.equal(result.limitApplied, true);
  assert.equal(result.confidence, "preliminary");
});

test("estágios sempre somam a potência comercial", () => {
  const stages = buildCommercialStages(32.5, 6);
  assert.equal(stages.reduce((sum, stage) => sum + stage, 0), 32.5);
  assert.ok(stages.length <= 6);
});

test("prioriza a penalidade informada sobre a estimativa tarifária", () => {
  const invoices = ["01", "02", "03"].map((month) => ({
    id: month,
    month,
    demandKw: 100,
    measuredPowerFactor: 0.8,
    excessReactiveKvarh: 1000,
    reactiveTariff: 0.5,
    informedReactiveCharge: 289.45,
  }));
  const result = calculateAuditableSizing(invoices, { targetPowerFactor: 0.92 });
  assert.equal(result.estimatedMonthlyReactiveCharge, 289.45);
});
