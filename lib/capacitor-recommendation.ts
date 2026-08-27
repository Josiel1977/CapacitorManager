export const CAPACITOR_RECOMMENDATION_VERSION = "2.0.0-rc23";

export type RecommendationMode = "novo_banco" | "otimizar_existente";
export type RecommendationConfidence = "insuficiente" | "preliminar" | "representativa";
export type RecommendationDecision = "coletar_dados" | "corrigir_sobrecompensacao" | "recomendar_banco" | "manter_banco";
export type RecommendationReleaseLevel = "bloqueado" | "pre_dimensionamento" | "especificacao_condicionada";

export interface ReactiveSample {
  timestamp?: string;
  activePowerKw: number;
  reactivePowerKvar: number;
  powerFactor?: number | null;
  thdvPercent?: number | null;
  thdiPercent?: number | null;
  intervalMinutes?: number | null;
}

export interface ExistingBank {
  totalKvar: number;
  fixedKvar?: number;
  stagesKvar?: number[];
}

export interface EngineeringApproval {
  representativeCampaignConfirmed?: boolean;
  harmonicStudyValidated?: boolean;
  protectionStudyValidated?: boolean;
}

export interface RecommendationInput {
  mode: RecommendationMode;
  samples: ReactiveSample[];
  targetPowerFactor?: number;
  minimumSamples?: number;
  minimumCoverageHours?: number;
  representativeCoverageHours?: number;
  minimumDistinctDays?: number;
  minimumDensityPercent?: number;
  maximumMedianIntervalMinutes?: number;
  minimumHarmonicCoveragePercent?: number;
  transformerKva?: number;
  existingBank?: ExistingBank;
  engineeringApproval?: EngineeringApproval;
}

export interface CapacitorRecommendation {
  engineVersion: string;
  mode: RecommendationMode;
  decision: RecommendationDecision;
  confidence: RecommendationConfidence;
  releaseLevel: RecommendationReleaseLevel;
  specificationAllowed: boolean;
  recommendedKvar: number | null;
  recommendedRangeKvar: { minimum: number; reference: number; maximum: number } | null;
  suggestedStagesKvar: number[];
  validSamples: number;
  capacitiveSamples: number;
  inductiveSamples: number;
  capacitivePercent: number;
  p50RequiredKvar: number | null;
  p90RequiredKvar: number | null;
  p95RequiredKvar: number | null;
  coverageHours: number | null;
  distinctDays: number;
  medianIntervalMinutes: number | null;
  sampleDensityPercent: number | null;
  harmonicCoveragePercent: number;
  releaseReasons: string[];
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

const weightedPercentile = (entries: Array<{ value: number; weight: number }>, p: number) => {
  if (!entries.length) return 0;
  const sorted = [...entries].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) return percentile(sorted.map((entry) => entry.value), p);
  const target = total * Math.min(1, Math.max(0, p));
  let cumulative = 0;
  for (const entry of sorted) {
    cumulative += Math.max(0, entry.weight);
    if (cumulative >= target) return entry.value;
  }
  return sorted[sorted.length - 1].value;
};

const validTimestamp = (sample: ReactiveSample) => {
  const parsed = sample.timestamp ? Date.parse(sample.timestamp) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const temporalQuality = (samples: ReactiveSample[]) => {
  const timed = samples
    .map((sample) => ({ sample, time: validTimestamp(sample) }))
    .filter((item): item is { sample: ReactiveSample; time: number } => item.time !== null)
    .sort((a, b) => a.time - b.time);
  const uniqueTimes = timed.filter((item, index) => index === 0 || item.time !== timed[index - 1].time);
  const deltas = uniqueTimes.slice(1).map((item, index) => (item.time - uniqueTimes[index].time) / 60_000).filter((value) => value > 0);
  const medianInterval = deltas.length ? percentile(deltas, 0.5) : null;
  const coverage = uniqueTimes.length >= 2 ? (uniqueTimes[uniqueTimes.length - 1].time - uniqueTimes[0].time) / 3_600_000 : null;
  const distinctDays = new Set(uniqueTimes.map((item) => new Date(item.time).toISOString().slice(0, 10))).size;
  const expected = coverage !== null && medianInterval !== null && medianInterval > 0
    ? Math.floor((coverage * 60) / medianInterval) + 1
    : null;
  const density = expected && expected > 0 ? Math.min(100, (uniqueTimes.length / expected) * 100) : null;
  return { coverage, distinctDays, medianInterval, density };
};

const requiredDistribution = (
  samples: ReactiveSample[],
  targetFp: number,
  medianIntervalMinutes: number | null,
) => {
  const timed = samples
    .map((sample) => ({ sample, time: validTimestamp(sample) }))
    .filter((item): item is { sample: ReactiveSample; time: number } => item.time !== null)
    .sort((a, b) => a.time - b.time);
  const fallback = Math.max(1, medianIntervalMinutes ?? 1);
  if (timed.length < 2) {
    return samples.map((sample) => ({
      value: requiredCompensationKvar(sample.activePowerKw, sample.reactivePowerKvar, targetFp),
      weight: Math.max(1, sample.intervalMinutes ?? fallback),
    }));
  }
  return timed.map((item, index) => {
    const next = timed[index + 1];
    const rawDuration = next ? (next.time - item.time) / 60_000 : item.sample.intervalMinutes ?? fallback;
    return {
      value: requiredCompensationKvar(item.sample.activePowerKw, item.sample.reactivePowerKvar, targetFp),
      weight: Math.max(1, Math.min(rawDuration, fallback * 3)),
    };
  });
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
  const representativeCoverageHours = input.representativeCoverageHours ?? 168;
  const minimumDistinctDays = input.minimumDistinctDays ?? 7;
  const minimumDensityPercent = input.minimumDensityPercent ?? 75;
  const maximumMedianIntervalMinutes = input.maximumMedianIntervalMinutes ?? 15;
  const minimumHarmonicCoveragePercent = input.minimumHarmonicCoveragePercent ?? 80;
  if (!(targetFp >= 0.92 && targetFp < 1)) throw new Error("O FP alvo deve estar entre 0,92 e 0,99.");

  const valid = input.samples.filter((sample) =>
    Number.isFinite(sample.activePowerKw) && sample.activePowerKw > 0 && Number.isFinite(sample.reactivePowerKvar)
  );
  const capacitive = valid.filter((sample) => sample.reactivePowerKvar < 0);
  const inductive = valid.filter((sample) => sample.reactivePowerKvar > 0);
  const quality = temporalQuality(valid);
  const enoughSamples = valid.length >= minimumSamples;
  const enoughCoverage = quality.coverage !== null && quality.coverage >= minimumCoverageHours;
  const harmonicSamples = valid.filter((sample) =>
    Number.isFinite(sample.thdvPercent) && Number.isFinite(sample.thdiPercent)
  ).length;
  const harmonicCoveragePercent = valid.length ? (harmonicSamples / valid.length) * 100 : 0;
  const distribution = requiredDistribution(valid, targetFp, quality.medianInterval);
  const p50 = distribution.length ? weightedPercentile(distribution, 0.5) : 0;
  const p90 = distribution.length ? weightedPercentile(distribution, 0.9) : 0;
  const p95 = distribution.length ? weightedPercentile(distribution, 0.95) : 0;
  const capacitivePercent = valid.length ? (capacitive.length / valid.length) * 100 : 0;
  const materialCapacitiveBehavior = capacitive.length >= 3 && capacitivePercent >= 5;
  const representativeData = enoughSamples
    && (quality.coverage ?? 0) >= representativeCoverageHours
    && quality.distinctDays >= minimumDistinctDays
    && (quality.medianInterval ?? Number.POSITIVE_INFINITY) <= maximumMedianIntervalMinutes
    && (quality.density ?? 0) >= minimumDensityPercent;
  const warnings: string[] = [];
  const actions: string[] = [];
  const releaseReasons: string[] = [];
  const approvals = input.engineeringApproval ?? {};

  if (!enoughSamples) warnings.push(`A campanha tem ${valid.length} amostra(s); são exigidas pelo menos ${minimumSamples}.`);
  if (!enoughCoverage) warnings.push(`A campanha preliminar deve cobrir pelo menos ${minimumCoverageHours} horas e diferentes condições de carga.`);
  if (harmonicCoveragePercent < minimumHarmonicCoveragePercent) {
    warnings.push(`Cobertura simultânea de THDv/THDi: ${round(harmonicCoveragePercent, 1)}%. Potência reativa não substitui estudo de harmônicos e ressonância.`);
  }
  if (capacitive.length) warnings.push(`${capacitive.length} amostra(s) capacitivas (${round(capacitivePercent, 1)}%) indicam possível sobrecompensação em parte do ciclo.`);

  const base = {
    engineVersion: CAPACITOR_RECOMMENDATION_VERSION,
    mode: input.mode,
    validSamples: valid.length,
    capacitiveSamples: capacitive.length,
    inductiveSamples: inductive.length,
    capacitivePercent: round(capacitivePercent, 1),
    p50RequiredKvar: distribution.length ? round(p50) : null,
    p90RequiredKvar: distribution.length ? round(p90) : null,
    p95RequiredKvar: distribution.length ? round(p95) : null,
    coverageHours: quality.coverage === null ? null : round(quality.coverage, 1),
    distinctDays: quality.distinctDays,
    medianIntervalMinutes: quality.medianInterval === null ? null : round(quality.medianInterval, 1),
    sampleDensityPercent: quality.density === null ? null : round(quality.density, 1),
    harmonicCoveragePercent: round(harmonicCoveragePercent, 1),
    warnings,
    formula: "Qc(t) = max(0, Q(t) − P(t) × tan(arccos(FP alvo))); faixa = P50/P90/P95 ponderados pelo intervalo",
  };

  const fixedKvar = Math.max(0, input.existingBank?.fixedKvar ?? 0);
  const overcompensated = capacitive.length > 0 && (fixedKvar > 0 || input.mode === "otimizar_existente");
  if (overcompensated || (materialCapacitiveBehavior && input.mode === "novo_banco")) {
    actions.push(fixedKvar > 0
      ? `Retirar o jumper ou comandar automaticamente o capacitor fixo de ${round(fixedKvar)} kVAr.`
      : "Revisar estágios conectados durante baixa carga e impedir operação capacitiva.");
    actions.push("Realizar campanha comparativa em baixa e alta carga antes de acrescentar kVAr.");
    releaseReasons.push("Comportamento capacitivo material detectado; acréscimo de potência bloqueado.");
    return {
      ...base,
      decision: "corrigir_sobrecompensacao",
      confidence: enoughSamples && enoughCoverage ? "preliminar" : "insuficiente",
      releaseLevel: "bloqueado",
      specificationAllowed: false,
      recommendedKvar: null,
      recommendedRangeKvar: null,
      suggestedStagesKvar: [],
      actions,
      releaseReasons,
    };
  }

  if (!enoughSamples || !enoughCoverage || distribution.length === 0 || inductive.length === 0) {
    actions.push("Importar a série temporal completa do analisador, incluindo baixa carga, pico, partidas e paradas.");
    releaseReasons.push("Amostragem mínima ou cobertura temporal ainda não atendida.");
    return {
      ...base,
      decision: "coletar_dados",
      confidence: "insuficiente",
      releaseLevel: "bloqueado",
      specificationAllowed: false,
      recommendedKvar: null,
      recommendedRangeKvar: null,
      suggestedStagesKvar: [],
      actions,
      releaseReasons,
    };
  }

  const statisticalCommercial = Math.ceil(p90 / 2.5) * 2.5;
  let commercial = statisticalCommercial;
  let transformerLimitApplied = false;
  if (input.transformerKva && commercial > input.transformerKva * 0.4) {
    commercial = Math.floor((input.transformerKva * 0.4) / 2.5) * 2.5;
    transformerLimitApplied = true;
    warnings.push("Aplicado teto preventivo de 40% da potência do transformador. Esse teto não substitui estudo de curto-circuito, harmônicos ou fabricante.");
  }
  const installed = Math.max(0, input.existingBank?.totalKvar ?? 0);
  const tolerance = 2.5;
  const maintain = input.mode === "otimizar_existente" && Math.abs(installed - commercial) <= tolerance;
  actions.push(maintain
    ? "Manter preliminarmente a potência instalada e revisar controlador, contatores, fusíveis e capacitores por estágio."
    : input.mode === "otimizar_existente"
      ? `Comparar ${round(installed)} kVAr instalados com a referência preliminar de ${round(commercial)} kVAr e validar a reconfiguração dos estágios.`
      : `Usar ${round(commercial)} kVAr como referência de pré-dimensionamento; definir o banco somente após as validações de engenharia.`);

  if (!representativeData) {
    releaseReasons.push(`Campanha representativa requer ao menos ${representativeCoverageHours} h, ${minimumDistinctDays} dias, intervalo mediano de até ${maximumMedianIntervalMinutes} min e densidade de ${minimumDensityPercent}%.`);
  }
  if (!approvals.representativeCampaignConfirmed) releaseReasons.push("Ciclo operacional representativo ainda não confirmado pelo responsável técnico.");
  if (!approvals.harmonicStudyValidated) releaseReasons.push("Estudo de harmônicos/ressonância e dessintonia ainda não validado.");
  if (!approvals.protectionStudyValidated) releaseReasons.push("Proteção, curto-circuito, cabos, ventilação e manobra ainda não validados.");
  if (harmonicCoveragePercent < minimumHarmonicCoveragePercent) releaseReasons.push("Cobertura de THDv/THDi insuficiente para caracterizar a campanha.");
  if (transformerLimitApplied) releaseReasons.push("A necessidade estatística excede o teto preventivo do transformador; a especificação permanece bloqueada para estudo específico.");

  const specificationAllowed = representativeData
    && harmonicCoveragePercent >= minimumHarmonicCoveragePercent
    && approvals.representativeCampaignConfirmed === true
    && approvals.harmonicStudyValidated === true
    && approvals.protectionStudyValidated === true
    && !transformerLimitApplied;

  return {
    ...base,
    decision: maintain ? "manter_banco" : "recomendar_banco",
    confidence: specificationAllowed ? "representativa" : "preliminar",
    releaseLevel: specificationAllowed ? "especificacao_condicionada" : "pre_dimensionamento",
    specificationAllowed,
    recommendedKvar: round(commercial),
    recommendedRangeKvar: {
      minimum: round(Math.ceil(p50 / 2.5) * 2.5),
      reference: round(statisticalCommercial),
      maximum: round(Math.ceil(p95 / 2.5) * 2.5),
    },
    suggestedStagesKvar: buildProgressiveStages(commercial),
    actions,
    releaseReasons,
  };
}
