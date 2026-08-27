import assert from "node:assert/strict";
import test from "node:test";
import { estimateReactiveExposure, estimateReactiveIntervalExposure } from "../lib/reactive-exposure.ts";

test("estima exposição a partir da energia ativa do intervalo", () => {
  const value = estimateReactiveIntervalExposure(
    { activePowerKw: 100, powerFactor: 0.8, direction: "indutivo" },
    0.5,
    0.92,
    15,
  );
  assert.ok(Math.abs(value - 1.875) < 0.0001);
});

test("não cria exposição quando o FP atende o critério", () => {
  assert.equal(estimateReactiveIntervalExposure(
    { activePowerKw: 100, powerFactor: 0.95, direction: "indutivo" }, 0.5, 0.92, 15,
  ), 0);
});

test("mantém a separação entre exposição indutiva e capacitiva", () => {
  const result = estimateReactiveExposure([
    { activePowerKw: 100, powerFactor: 0.8, direction: "indutivo" },
    { activePowerKw: 50, powerFactor: 0.8, direction: "capacitivo" },
  ], 0.5, 0.92, 60);
  assert.ok(result.inductive > result.capacitive);
  assert.equal(result.total, result.inductive + result.capacitive);
});
