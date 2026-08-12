import assert from "node:assert/strict";
import test from "node:test";
import { parseEmbrasulSeries } from "../lib/embrasul-series-parser.ts";

test("reconhece cabeçalhos Embrasul e preserva o sinal capacitivo", () => {
  const result = parseEmbrasulSeries([
    { "Data": "12/08/2026", "Hora": "08:00:00", "P [kW]": "2,23", "Q [kVAr]": "-4,57", "S [kVA]": "5,086", "FP": "0,438" },
    { "Data": "12/08/2026", "Hora": "08:10:00", "P [kW]": "10,0", "Q [kVAr]": "5,0", "S [kVA]": "11,18", "FP": "0,894" },
  ]);
  assert.equal(result.measurements.length, 2);
  assert.equal(result.measurements[0].reactivePowerKvar, -4.57);
  assert.equal(result.measurements[0].powerFactor, -0.438);
  assert.equal(result.intervalMinutes, 10);
  assert.equal(result.capacitiveSamples, 1);
});

test("calcula S e FP quando não vierem no arquivo", () => {
  const result = parseEmbrasulSeries([{ "Data Hora": "12/08/2026 08:00:00", "Potência Ativa (kW)": "50", "Potência Reativa (kVAr)": "30" }]);
  assert.equal(Math.round(result.measurements[0].apparentPowerKva! * 10) / 10, 58.3);
  assert.equal(Math.round(result.measurements[0].powerFactor! * 1000) / 1000, 0.857);
});

test("rejeita formato sem data, P e Q em vez de adivinhar", () => {
  const result = parseEmbrasulSeries([{ valor1: "10", valor2: "20" }]);
  assert.equal(result.measurements.length, 0);
  assert.match(result.warnings[0], /Formato não reconhecido/);
});

test("rejeita linhas inválidas sem contaminar a série", () => {
  const result = parseEmbrasulSeries([
    { timestamp: "2026-08-12T08:00:00-03:00", "P kW": "50", "Q kVAr": "30" },
    { timestamp: "inválido", "P kW": "0", "Q kVAr": "30" },
  ]);
  assert.equal(result.measurements.length, 1);
  assert.equal(result.rejectedRows.length, 1);
});
