import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMassMemoryDateTime, parseSignedBrazilianNumber } from "../lib/mass-memory-utils.ts";

test("preserva o sinal do reativo em formato brasileiro", () => {
  assert.equal(parseSignedBrazilianNumber("-1.234,56 kVAr"), -1234.56);
  assert.equal(parseSignedBrazilianNumber("1.234,56"), 1234.56);
});

test("normaliza data brasileira sem perder o ano", () => {
  const result = normalizeMassMemoryDateTime("09/06/2026", "7:15:30");
  assert.equal(result.displayDate, "09/06/2026");
  assert.equal(result.timestamp, "2026-06-09T07:15:30");
  assert.ok(Number.isFinite(Date.parse(result.timestamp)));
});

test("aceita data ISO na memória de massa", () => {
  const result = normalizeMassMemoryDateTime("2026-08-11", "18:00");
  assert.equal(result.displayDate, "11/08/2026");
  assert.equal(result.timestamp, "2026-08-11T18:00:00");
});

test("não inventa ano quando a origem não o informa", () => {
  const result = normalizeMassMemoryDateTime("11/08", "18:00");
  assert.equal(result.timestamp, "");
  assert.equal(result.displayDate, "11/08");
});
