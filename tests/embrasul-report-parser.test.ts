import test from "node:test";
import assert from "node:assert/strict";
import { parseEmbrasulReport } from "../lib/embrasul-report-parser.ts";

const report = `EMBRASUL BPNHT N.S:70001762 V.S.2,00 ANL 6,04 (10 minutos)
ANÁLISE GERAL (Integração = 10 minutos)
Intervalo considerado: sexta-feira 10/07/2026 15:05:52,00 até sexta-feira 24/07/2026 07:20:19,00
Fase A: tensões [V] Correntes [A] Média 133,88 Média 12,959
Fase B: tensões [V] Correntes [A] Média 133,45 Média 15,595
Fase C: tensões [V] Correntes [A] Média 132,64 Média 14,525 Mínimo -14,021
Potências médias, por fase e trifásicas, no intervalo FASE kW kVAr kVA FP
A 0,838 -1,155 1,427 -0,587 B 0,887 -1,715 1,931 -0,459 C 0,505 -1,700 1,773 -0,285
Total 2,230 -4,570 5,086 -0,438
Potências aparentes por fase, segundo máximos e mínimos trifásicos
3f 11,904 14/07/2026 15:40:19,00 3,135 18/07/2026 08:20:19,00`;

test("extrai dados centrais do relatório Embrasul", () => {
  const result = parseEmbrasulReport(report, { fixedCapacitorConnected: true, fixedCapacitorKvar: 5 });
  assert.equal(result.serialNumber, "70001762");
  assert.equal(result.integrationMinutes, 10);
  assert.equal(result.averageActivePowerKw, 2.23);
  assert.equal(result.averageReactivePowerKvar, -4.57);
  assert.equal(result.averageApparentPowerKva, 5.086);
  assert.equal(result.averagePowerFactor, -0.438);
  assert.equal(result.maximumApparentPowerKva, 11.904);
  assert.equal(result.reactiveBehavior, "capacitivo");
});

test("contextualiza capacitor fixo sem ignorar seu efeito", () => {
  const result = parseEmbrasulReport(report, { fixedCapacitorConnected: true, fixedCapacitorKvar: 5 });
  assert.equal(result.fixedCapacitorConnected, true);
  assert.match(result.alerts.join(" "), /Sobrecompensação provável/);
  assert.match(result.alerts.join(" "), /validar diagrama fasorial/);
  assert.match(result.alerts.join(" "), /sem THDv\/THDi/);
});
