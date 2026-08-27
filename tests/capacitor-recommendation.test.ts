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

const representativeCampaign = () => Array.from({ length: 673 }, (_, index) => ({
  timestamp: new Date(Date.UTC(2026, 6, 1, 0, index * 15)).toISOString(),
  intervalMinutes: 15,
  activePowerKw: 100,
  reactivePowerKvar: 75,
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

test("campanha de 24 horas libera somente pré-dimensionamento", () => {
  const result = recommendCapacitorBank({ mode: "novo_banco", samples: campaign() });
  assert.equal(result.decision, "recomendar_banco");
  assert.equal(result.specificationAllowed, false);
  assert.equal(result.releaseLevel, "pre_dimensionamento");
  assert.equal(result.recommendedKvar, 32.5);
});

test("libera especificação condicionada somente com campanha e validações completas", () => {
  const result = recommendCapacitorBank({
    mode: "novo_banco",
    samples: representativeCampaign(),
    engineeringApproval: {
      representativeCampaignConfirmed: true,
      harmonicStudyValidated: true,
      protectionStudyValidated: true,
    },
  });
  assert.equal(result.confidence, "representativa");
  assert.equal(result.releaseLevel, "especificacao_condicionada");
  assert.equal(result.specificationAllowed, true);
  assert.equal(result.distinctDays, 8);
  assert.equal(result.sampleDensityPercent, 100);
});

test("campanha longa sem aprovação técnica continua preliminar", () => {
  const result = recommendCapacitorBank({ mode: "novo_banco", samples: representativeCampaign() });
  assert.equal(result.specificationAllowed, false);
  assert.match(result.releaseReasons.join(" "), /responsável técnico/);
});

test("teto preventivo do transformador não libera especificação insuficiente para a necessidade", () => {
  const result = recommendCapacitorBank({
    mode: "novo_banco",
    samples: representativeCampaign(),
    transformerKva: 20,
    engineeringApproval: {
      representativeCampaignConfirmed: true,
      harmonicStudyValidated: true,
      protectionStudyValidated: true,
    },
  });
  assert.equal(result.recommendedKvar, 7.5);
  assert.equal(result.recommendedRangeKvar?.reference, 32.5);
  assert.equal(result.specificationAllowed, false);
  assert.match(result.releaseReasons.join(" "), /transformador/);
});

test("mantém banco existente dentro da tolerância comercial", () => {
  const result = recommendCapacitorBank({
    mode: "otimizar_existente",
    samples: campaign(),
    existingBank: { totalKvar: 35, stagesKvar: [5, 5, 10, 15] },
  });
  assert.equal(result.decision, "manter_banco");
});

test("bloqueia novo banco diante de comportamento capacitivo material", () => {
  const samples = representativeCampaign().map((sample, index) => ({
    ...sample,
    reactivePowerKvar: index < 40 ? -10 : sample.reactivePowerKvar,
  }));
  const result = recommendCapacitorBank({ mode: "novo_banco", samples });
  assert.equal(result.decision, "corrigir_sobrecompensacao");
  assert.equal(result.releaseLevel, "bloqueado");
});

test("os estágios somam exatamente a potência recomendada", () => {
  const stages = buildProgressiveStages(75);
  assert.equal(stages.reduce((sum, stage) => sum + stage, 0), 75);
  assert.ok(stages.length <= 6);
});
