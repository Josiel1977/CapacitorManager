import test from "node:test";
import assert from "node:assert/strict";
import { countCurrentCapacitorStatuses, deriveCurrentCapacitorStatuses } from "../lib/current-capacitor-status.ts";

test("duas reprovações do mesmo capacitor contam um único ativo", () => {
  const counts = countCurrentCapacitorStatuses([
    { capacitor_id: "cap-1", tipo_teste: "corrente", created_at: "2026-08-01", status_validacao: "reprovado" },
    { capacitor_id: "cap-1", tipo_teste: "corrente", created_at: "2026-08-02", status_validacao: "reprovado" },
  ]);
  assert.equal(counts.reprovado, 1);
});

test("medição recente substitui estado antigo do mesmo tipo de teste", () => {
  const statuses = deriveCurrentCapacitorStatuses([
    { capacitor_id: "cap-1", tipo_teste: "corrente", created_at: "2026-08-01", status_validacao: "reprovado" },
    { capacitor_id: "cap-1", tipo_teste: "corrente", created_at: "2026-08-03", status_validacao: "aprovado" },
  ]);
  assert.equal(statuses[0].status, "aprovado");
});

test("mantém o pior estado entre os testes atuais do capacitor", () => {
  const statuses = deriveCurrentCapacitorStatuses([
    { capacitor_id: "cap-1", tipo_teste: "corrente", created_at: "2026-08-03", status_validacao: "aprovado" },
    { capacitor_id: "cap-1", tipo_teste: "capacitancia", created_at: "2026-08-03", status_validacao: "atencao" },
  ]);
  assert.equal(statuses[0].status, "atencao");
});

test("ignora registros sem ativo, tipo ou status reconhecido", () => {
  const counts = countCurrentCapacitorStatuses([
    { capacitor_id: null, tipo_teste: "corrente", created_at: "2026-08-01", status_validacao: "reprovado" },
    { capacitor_id: "cap-1", tipo_teste: null, created_at: "2026-08-01", status_validacao: "reprovado" },
    { capacitor_id: "cap-2", tipo_teste: "corrente", created_at: "2026-08-01", status_validacao: "pendente" },
  ]);
  assert.deepEqual(counts, { aprovado: 0, atencao: 0, reprovado: 0 });
});
