import assert from "node:assert/strict";
import test from "node:test";
import { buildProgressiveStages, recommendCapacitorBank, requiredCompensationKvar } from "../lib/capacitor-recommendation.ts";

const campaign = (count = 25, p = 100, q = 75) => Array.from({ length: count }, (_, index) => ({
  timestamp: new Date(Date.UTC(2026, 6, 1, index)).toISOString(),
  activePowerKw: p,
  reactivePowerKvar: q,
  thdvPercent: 2,
  thdiPercent: 8,
}));

test("calcula a compensação instantânea até o FP alvo", () => {
  assert.equal(Math.round(requiredCompensationKvar(100, 75, 0.92)), 32);
});

test("não recomenda banco definitivo com apenas uma média", () => {
  const result = recommendCapacitorBank({ mode: "novo_banco", samples: campaign(1) });
  assert.equal(result.decision, "coletar_dados");
  assert.equal(result.specificationAllowed, false);
  assert.equal(result.recommendedKvar, null);
});

test("bloqueia acréscimo quando há sobrecompensação por capacitor fixo", () => {
  const result = recommendCapacitorBank({
    mode: "otimizar_existente",
    samples: [{ activePowerKw: 2.23, reactivePowerKvar: -4.57, powerFactor: -0.438 }],
    existingBank: { totalKvar: 5, fixedKvar: 5 },
  });
  assert.equal(result.decision, "corrigir_sobrecompensacao");
  assert.equal(result.recommendedKvar, null);
  assert.match(result.actions.join(" "), /5 kVAr/);
});

test("dimensiona pelo P90 somente com campanha suficiente", () => {
  const result = recommendCapacitorBank({ mode: "novo_banco", samples: campaign() });
  assert.equal(result.decision, "recomendar_banco");
  assert.equal(result.specificationAllowed, true);
  assert.equal(result.recommendedKvar, 32.5);
});

test("mantém banco existente dentro da tolerância comercial", () => {
  const result = recommendCapacitorBank({
    mode: "otimizar_existente",
    samples: campaign(),
    existingBank: { totalKvar: 35, stagesKvar: [5, 5, 10, 15] },
  });
  assert.equal(result.decision, "manter_banco");
});

test("os estágios somam exatamente a potência recomendada", () => {
  const stages = buildProgressiveStages(75);
  assert.equal(stages.reduce((sum, stage) => sum + stage, 0), 75);
  assert.ok(stages.length <= 6);
});
