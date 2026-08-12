export const TRANSFORMER_ANALYSIS_VERSION = "1.0.0";

export interface TransformerMeasurementInput {
  apparentPowerKva?: number | null;
  activePowerKw?: number | null;
  reactivePowerKvar?: number | null;
  powerFactor?: number | null;
  thdvPercent?: number | null;
  thdiPercent?: number | null;
}

export interface TransformerAnalysisThresholds {
  minimumSamples: number;
  lowLoadPercent: number;
  highLoadPercent: number;
  overloadPercent: number;
  lowPowerFactor: number;
  thdvAttentionPercent: number;
  thdiAttentionPercent: number;
}

export const DEFAULT_TRANSFORMER_THRESHOLDS: TransformerAnalysisThresholds = {
  minimumSamples: 3,
  lowLoadPercent: 30,
  highLoadPercent: 80,
  overloadPercent: 100,
  lowPowerFactor: 0.92,
  thdvAttentionPercent: 5,
  thdiAttentionPercent: 20,
};

export type AnalysisConfidence = "insuficiente" | "preliminar" | "representativa";

export interface TransformerMeasurementAnalysis {
  version: string;
  confidence: AnalysisConfidence;
  samples: number;
  validLoadSamples: number;
  averageLoadPercent: number | null;
  minimumLoadPercent: number | null;
  maximumLoadPercent: number | null;
  minimumPowerFactor: number | null;
  averagePowerFactor: number | null;
  capacitiveSamples: number;
  lowPowerFactorSamples: number;
  harmonicAttentionSamples: number;
  status: "sem_dados" | "normal" | "atencao" | "critico";
  alerts: string[];
  limitations: string[];
}

const finitePositive = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

const apparentPower = (measurement: TransformerMeasurementInput) => {
  const informed = finitePositive(measurement.apparentPowerKva);
  if (informed !== null) return informed;
  const p = measurement.activePowerKw;
  const q = measurement.reactivePowerKvar;
  if (typeof p !== "number" || typeof q !== "number" || !Number.isFinite(p) || !Number.isFinite(q)) return null;
  return Math.sqrt(p ** 2 + q ** 2);
};

const resolvedPowerFactor = (measurement: TransformerMeasurementInput) => {
  const informed = measurement.powerFactor;
  if (typeof informed === "number" && Number.isFinite(informed) && Math.abs(informed) <= 1 && informed !== 0) {
    return Math.abs(informed);
  }
  const s = apparentPower(measurement);
  const p = measurement.activePowerKw;
  if (s === null || s === 0 || typeof p !== "number" || !Number.isFinite(p)) return null;
  return Math.min(1, Math.abs(p) / s);
};

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function analyzeTransformerMeasurements(
  transformerKva: number,
  measurements: TransformerMeasurementInput[],
  thresholds: TransformerAnalysisThresholds = DEFAULT_TRANSFORMER_THRESHOLDS,
): TransformerMeasurementAnalysis {
  const alerts: string[] = [];
  const limitations: string[] = [
    "Triagem operacional: não substitui estudo elétrico, campanha representativa ou análise de ressonância.",
  ];

  if (!Number.isFinite(transformerKva) || transformerKva <= 0 || measurements.length === 0) {
    return {
      version: TRANSFORMER_ANALYSIS_VERSION,
      confidence: "insuficiente",
      samples: measurements.length,
      validLoadSamples: 0,
      averageLoadPercent: null,
      minimumLoadPercent: null,
      maximumLoadPercent: null,
      minimumPowerFactor: null,
      averagePowerFactor: null,
      capacitiveSamples: 0,
      lowPowerFactorSamples: 0,
      harmonicAttentionSamples: 0,
      status: "sem_dados",
      alerts: ["Cadastre a potência do transformador e pelo menos uma medição válida."],
      limitations,
    };
  }

  const loads = measurements
    .map(apparentPower)
    .filter((value): value is number => value !== null)
    .map((value) => (value / transformerKva) * 100);
  const powerFactors = measurements
    .map(resolvedPowerFactor)
    .filter((value): value is number => value !== null);
  const capacitiveSamples = measurements.filter((item) =>
    (typeof item.reactivePowerKvar === "number" && item.reactivePowerKvar < 0) ||
    (typeof item.powerFactor === "number" && item.powerFactor < 0)
  ).length;
  const lowPowerFactorSamples = powerFactors.filter((value) => value < thresholds.lowPowerFactor).length;
  const harmonicAttentionSamples = measurements.filter((item) =>
    (typeof item.thdvPercent === "number" && item.thdvPercent > thresholds.thdvAttentionPercent) ||
    (typeof item.thdiPercent === "number" && item.thdiPercent > thresholds.thdiAttentionPercent)
  ).length;
  const maximumLoadPercent = loads.length ? Math.max(...loads) : null;
  const minimumLoadPercent = loads.length ? Math.min(...loads) : null;

  if (maximumLoadPercent !== null && maximumLoadPercent > thresholds.overloadPercent) {
    alerts.push("Há medição acima da potência nominal do transformador.");
  } else if (maximumLoadPercent !== null && maximumLoadPercent > thresholds.highLoadPercent) {
    alerts.push("Há operação em faixa de carga elevada; revisar simultaneidade e ventilação.");
  }
  if (minimumLoadPercent !== null && minimumLoadPercent < thresholds.lowLoadPercent) {
    alerts.push("Foram observados períodos de baixa carga; o controle por estágios deve evitar sobrecompensação.");
  }
  if (capacitiveSamples > 0) alerts.push("Foram identificadas amostras capacitivas (Q negativo ou FP sinalizado como capacitivo).");
  if (lowPowerFactorSamples > 0) alerts.push("Há amostras abaixo do fator de potência de triagem configurado.");
  if (harmonicAttentionSamples > 0) alerts.push("THD ultrapassou o limite interno de triagem; exigir análise harmônica antes de especificar capacitores.");

  const hasHarmonicData = measurements.some((item) => item.thdvPercent != null || item.thdiPercent != null);
  if (!hasHarmonicData) limitations.push("Sem THDv/THDi: não é possível concluir sobre dessintonia, ressonância ou suportabilidade harmônica.");
  if (measurements.length < thresholds.minimumSamples) limitations.push(`Amostragem insuficiente: mínimo interno de ${thresholds.minimumSamples} registros para análise preliminar.`);
  if (measurements.length < 24) limitations.push("Para representatividade, registre diferentes horários e condições de carga; 24 amostras é apenas uma meta operacional inicial.");

  const critical = (maximumLoadPercent ?? 0) > thresholds.overloadPercent || capacitiveSamples > 0;
  const attention = alerts.length > 0 || !hasHarmonicData;
  const confidence: AnalysisConfidence = measurements.length < thresholds.minimumSamples
    ? "insuficiente"
    : measurements.length < 24 || !hasHarmonicData
      ? "preliminar"
      : "representativa";

  return {
    version: TRANSFORMER_ANALYSIS_VERSION,
    confidence,
    samples: measurements.length,
    validLoadSamples: loads.length,
    averageLoadPercent: average(loads),
    minimumLoadPercent,
    maximumLoadPercent,
    minimumPowerFactor: powerFactors.length ? Math.min(...powerFactors) : null,
    averagePowerFactor: average(powerFactors),
    capacitiveSamples,
    lowPowerFactorSamples,
    harmonicAttentionSamples,
    status: critical ? "critico" : attention ? "atencao" : "normal",
    alerts,
    limitations,
  };
}
