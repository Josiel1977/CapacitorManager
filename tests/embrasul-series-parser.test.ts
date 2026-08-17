import assert from "node:assert/strict";
import test from "node:test";
import { parseEmbrasulSeries, parseEmbrasulSeriesText } from "../lib/embrasul-series-parser.ts";

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

test("interpreta o TXT real da Embrasul, ignora o preâmbulo e converte W para kW", () => {
  const text = `EMBRASUL BPNHT N.S:70001762  V.S.2,00 ANL 6,04 (10 minutos)\nPARA A CORRETA VISUALIZAÇÃO, ABRIR O ARQUIVO COMO ARQUIVO TEXTO CSV/CVS\nDATA\tHORA\tP3f\tQ3f\tS3f\tFP3f\tkVAr(0,980)\n10/07/2026\t15:15:52,00\t8719,519\t874,913\t8763,303\t0,995\tRetir 0,001\n10/07/2026\t15:25:52,00\t8332,499\t-617,687\t8355,363\t-0,997\tRetir 0,001`;
  const result = parseEmbrasulSeriesText(text);
  assert.equal(result.analyzer, "EMBRASUL BPNHT");
  assert.equal(result.serialNumber, "70001762");
  assert.equal(result.measurements.length, 2);
  assert.equal(result.measurements[0].activePowerKw, 8.719519);
  assert.equal(result.measurements[1].reactivePowerKvar, -0.617687);
  assert.equal(result.measurements[1].powerFactor, -0.997);
  assert.equal(result.measurements[1].analyzerAction, "Retir 0,001");
  assert.equal(result.intervalMinutes, 10);
});
