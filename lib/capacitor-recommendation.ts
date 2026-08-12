export const CAPACITOR_RECOMMENDATION_VERSION = "1.0.0";

export type RecommendationMode = "novo_banco" | "otimizar_existente";
export type RecommendationConfidence = "insuficiente" | "preliminar" | "representativa";
export type RecommendationDecision = "coletar_dados" | "corrigir_sobrecompensacao" | "recomendar_banco" | "manter_banco";

export interface ReactiveSample {
  timestamp?: string;
  activePowerKw: number;
  reactivePowerKvar: number;
  powerFactor?: number | null;
  thdvPercent?: number | null;
  thdiPercent?: number | null;
}

export interface ExistingBank {
  totalKvar: number;
  fixedKvar?: number;
  stagesKvar?: number[];
}

export interface RecommendationInput {
  mode: RecommendationMode;
  samples: ReactiveSample[];
  targetPowerFactor?: number;
  minimumSamples?: number;
  minimumCoverageHours?: number;
  transformerKva?: number;
  existingBank?: ExistingBank;
}

export interface CapacitorRecommendation {
  engineVersion: string;
  mode: RecommendationMode;
  decision: RecommendationDecision;
  confidence: RecommendationConfidence;
  specificationAllowed: boolean;
  recommendedKvar: number | null;
  suggestedStagesKvar: number[];
  validSamples: number;
  capacitiveSamples: number;
  inductiveSamples: number;
  capacitivePercent: number;
  p90RequiredKvar: number | null;
  coverageHours: number | null;
  actions: string[];
  warnings: string[];
  formula: string;
}

const round = (value: number, decimals = 3) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const percentile = (values: number[], p: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * Math.min(1, Math.max(0, p));
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
};

const coverageHours = (samples: ReactiveSample[]) => {
  const timestamps = samples
    .map((sample) => sample.timestamp ? Date.parse(sample.timestamp) : Number.NaN)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  return timestamps.length >= 2 ? (timestamps[timestamps.length - 1] - timestamps[0]) / 3_600_000 : null;
};

export const requiredCompensationKvar = (pKw: number, qKvar: number, targetFp: number) => {
  if (!Number.isFinite(pKw) || pKw <= 0 || !Number.isFinite(qKvar) || qKvar <= 0) return 0;
  const targetQ = pKw * Math.tan(Math.acos(targetFp));
  return Math.max(0, qKvar - targetQ);
};

export const buildProgressiveStages = (totalKvar: number, maximumStages = 6) => {
  const units = Math.round(totalKvar / 2.5);
  if (units <= 0) return [];
  const stages: number[] = [];
  let remaining = units;
  let step = 1;
  while (remaining > 0 && stages.length < maximumStages) {
    const stagesLeft = maximumStages - stages.length;
    const unitsNow = stagesLeft === 1 ? remaining : Math.min(step, remaining - Math.max(0, stagesLeft - 1));
    if (unitsNow <= 0) break;
    stages.push(unitsNow * 2.5);
    remaining -= unitsNow;
    step = Math.min(step * 2, remaining);
  }
  if (remaining > 0) stages[stages.length - 1] += remaining * 2.5;
  return stages;
};

export function recommendCapacitorBank(input: RecommendationInput): CapacitorRecommendation {
  const targetFp = input.targetPowerFactor ?? 0.92;
  const minimumSamples = input.minimumSamples ?? 24;
  const minimumCoverageHours = input.minimumCoverageHours ?? 24;
  if (!(targetFp >= 0.92 && targetFp < 1)) throw new Error("O FP alvo deve estar entre 0,92 e 0,99.");

  const valid = input.samples.filter((sample) =>
    Number.isFinite(sample.activePowerKw) && sample.activePowerKw >= 0 && Number.isFinite(sample.reactivePowerKvar)
  );
  const capacitive = valid.filter((sample) => sample.reactivePowerKvar < 0);
  const inductive = valid.filter((sample) => sample.reactivePowerKvar > 0);
  const coverage = coverageHours(valid);
  const enoughSamples = valid.length >= minimumSamples;
  const enoughCoverage = coverage !== null && coverage >= minimumCoverageHours;
  const hasHarmonics = valid.some((sample) => sample.thdvPercent != null || sample.thdiPercent != null);
  const required = inductive.map((sample) => requiredCompensationKvar(sample.activePowerKw, sample.reactivePowerKvar, targetFp));
  const p90 = required.length ? percentile(required, 0.9) : 0;
  const capacitivePercent = valid.length ? (capacitive.length / valid.length) * 100 : 0;
  const warnings: string[] = [];
  const actions: string[] = [];

  if (!enoughSamples) warnings.push(`A campanha tem ${valid.length} amostra(s); são exigidas pelo menos ${minimumSamples}.`);
  if (!enoughCoverage) warnings.push(`A campanha deve cobrir pelo menos ${minimumCoverageHours} horas e diferentes condições de carga.`);
  if (!hasHarmonics) warnings.push("Sem THDv/THDi: a potência pode ser estimada, mas dessintonia e ressonância permanecem não avaliadas.");
  if (capacitive.length) warnings.push(`${capacitive.length} amostra(s) capacitivas indicam risco de sobrecompensação.`);

  const fixedKvar = Math.max(0, input.existingBank?.fixedKvar ?? 0);
  const overcompensated = capacitive.length > 0 && (fixedKvar > 0 || input.mode === "otimizar_existente");
  if (overcompensated) {
    actions.push(fixedKvar > 0
      ? `Retirar o jumper ou comandar automaticamente o capacitor fixo de ${round(fixedKvar)} kVAr.`
      : "Revisar estágios conectados durante baixa carga e impedir operação capacitiva.");
    actions.push("Realizar campanha comparativa com o capacitor fixo desligado antes de acrescentar kVAr.");
    return {
      engineVersion: CAPACITOR_RECOMMENDATION_VERSION,
      mode: input.mode,
      decision: "corrigir_sobrecompensacao",
      confidence: enoughSamples && enoughCoverage ? "preliminar" : "insuficiente",
      specificationAllowed: false,
      recommendedKvar: null,
      suggestedStagesKvar: [],
      validSamples: valid.length,
      capacitiveSamples: capacitive.length,
      inductiveSamples: inductive.length,
      capacitivePercent: round(capacitivePercent, 1),
      p90RequiredKvar: required.length ? round(p90) : null,
      coverageHours: coverage === null ? null : round(coverage, 1),
      actions,
      warnings,
      formula: "Qc(t) = max(0, Q(t) - P(t) × tan(arccos(FP alvo))); referência = P90 de Qc(t)",
    };
  }

  if (!enoughSamples || !enoughCoverage || required.length === 0) {
    actions.push("Importar a série temporal completa do analisador, incluindo horários de baixa e alta carga.");
    return {
      engineVersion: CAPACITOR_RECOMMENDATION_VERSION,
      mode: input.mode,
      decision: "coletar_dados",
      confidence: "insuficiente",
      specificationAllowed: false,
      recommendedKvar: null,
      suggestedStagesKvar: [],
      validSamples: valid.length,
      capacitiveSamples: capacitive.length,
      inductiveSamples: inductive.length,
      capacitivePercent: round(capacitivePercent, 1),
      p90RequiredKvar: required.length ? round(p90) : null,
      coverageHours: coverage === null ? null : round(coverage, 1),
      actions,
      warnings,
      formula: "Qc(t) = max(0, Q(t) - P(t) × tan(arccos(FP alvo))); referência = P90 de Qc(t)",
    };
  }

  let commercial = Math.ceil(p90 / 2.5) * 2.5;
  if (input.transformerKva && commercial > input.transformerKva * 0.4) {
    commercial = Math.floor((input.transformerKva * 0.4) / 2.5) * 2.5;
    warnings.push("Aplicado limite preventivo de 40% da potência do transformador; exigir validação de engenharia.");
  }
  const installed = Math.max(0, input.existingBank?.totalKvar ?? 0);
  const tolerance = 2.5;
  const maintain = input.mode === "otimizar_existente" && Math.abs(installed - commercial) <= tolerance;
  actions.push(maintain
    ? "Manter a potência instalada e revisar controlador, contatores, fusíveis e capacitores por estágio."
    : input.mode === "otimizar_existente"
      ? `Comparar ${round(installed)} kVAr instalados com ${round(commercial)} kVAr indicados e reconfigurar os estágios.`
      : `Projetar banco automático de ${round(commercial)} kVAr e validar proteção, ventilação e harmônicos.`);

  return {
    engineVersion: CAPACITOR_RECOMMENDATION_VERSION,
    mode: input.mode,
    decision: maintain ? "manter_banco" : "recomendar_banco",
    confidence: hasHarmonics ? "representativa" : "preliminar",
    specificationAllowed: true,
    recommendedKvar: round(commercial),
    suggestedStagesKvar: buildProgressiveStages(commercial),
    validSamples: valid.length,
    capacitiveSamples: capacitive.length,
    inductiveSamples: inductive.length,
    capacitivePercent: round(capacitivePercent, 1),
    p90RequiredKvar: round(p90),
    coverageHours: coverage === null ? null : round(coverage, 1),
    actions,
    warnings,
    formula: "Qc(t) = max(0, Q(t) - P(t) × tan(arccos(FP alvo))); referência = P90 de Qc(t)",
  };
}
