export type ValidationStatus = 'aprovado' | 'atencao' | 'reprovado';

export interface TrendMeasurement {
  created_at: string;
  desvio_percentual: number | null;
  capacitores?: { id?: string | null; codigo_identificacao?: string | null } | null;
  bancos_capacitores?: { id?: string | null; nome_banco?: string | null } | null;
}

export interface CapacitorTrend {
  capacitorId: string | null;
  bancoId: string | null;
  nome: string;
  banco: string;
  variacao: number;
  degradacaoPorMes: number;
  tendencia: 'piorando' | 'melhorando' | 'estavel';
  primeiraData: string;
  ultimaData: string;
  primeiroDesvio: number;
  ultimoDesvio: number;
  previsao: { meses: number; data: string } | null;
  statusProjecao: ProjectionStatus;
  mensagemProjecao: string;
  confianca: ProjectionConfidence;
  rQuadrado: number | null;
  amostras: number;
  periodoDias: number;
}

export type ProjectionStatus =
  | 'disponivel'
  | 'historico_insuficiente'
  | 'estavel'
  | 'correlacao_fraca'
  | 'horizonte_excedido'
  | 'limite_atual';

export type ProjectionConfidence = 'insuficiente' | 'baixa' | 'moderada' | 'alta';

export interface DeviationProjection {
  slopePerDay: number;
  futureDeviations: number[];
  monthsToCritical: number | null;
  trend: 'alta' | 'moderada' | 'estavel';
  criticalLimit: number;
  reliable: boolean;
  status: ProjectionStatus;
  message: string;
  confidence: ProjectionConfidence;
  rSquared: number;
  sampleCount: number;
  periodDays: number;
}

export const TREND_POLICY = Object.freeze({
  minimumSamples: 3,
  minimumPeriodDays: 90,
  stabilityDeadbandPercentagePoints: 0.5,
  minimumGrowthPerMonth: 0.1,
  minimumRSquared: 0.6,
  maximumForecastMonths: 36,
});

interface RegressionResult {
  slopePerDay: number;
  intercept: number;
  rSquared: number;
}

interface ProjectionAssessment {
  status: ProjectionStatus;
  message: string;
  confidence: ProjectionConfidence;
  monthsToCritical: number | null;
  reliable: boolean;
}

function calculateLinearRegression(days: number[], deviations: number[]): RegressionResult | null {
  const count = days.length;
  const sumX = days.reduce((total, value) => total + value, 0);
  const sumY = deviations.reduce((total, value) => total + value, 0);
  const sumXY = days.reduce((total, value, index) => total + value * deviations[index], 0);
  const sumX2 = days.reduce((total, value) => total + value * value, 0);
  const denominator = count * sumX2 - sumX * sumX;

  if (!Number.isFinite(denominator) || Math.abs(denominator) < Number.EPSILON) return null;

  const slopePerDay = (count * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slopePerDay * sumX) / count;
  const meanY = sumY / count;
  const totalVariation = deviations.reduce((total, value) => total + (value - meanY) ** 2, 0);
  const residualVariation = deviations.reduce(
    (total, value, index) => total + (value - (intercept + slopePerDay * days[index])) ** 2,
    0,
  );
  const rSquared = totalVariation < Number.EPSILON
    ? 1
    : Math.max(0, Math.min(1, 1 - residualVariation / totalVariation));

  return { slopePerDay, intercept, rSquared };
}

function assessProjection({
  sampleCount,
  periodDays,
  variation,
  slopePerDay,
  rSquared,
  currentDeviation,
  criticalLimit,
}: {
  sampleCount: number;
  periodDays: number;
  variation: number;
  slopePerDay: number;
  rSquared: number;
  currentDeviation: number;
  criticalLimit: number;
}): ProjectionAssessment {
  const currentAbsoluteDeviation = Math.abs(currentDeviation);
  const slopePerMonth = slopePerDay * 30;

  if (currentAbsoluteDeviation >= criticalLimit) {
    return {
      status: 'limite_atual',
      message: 'O desvio atual já atingiu o limite crítico. A conduta deve se basear na medição atual, com reteste e avaliação técnica.',
      confidence: 'alta',
      monthsToCritical: null,
      reliable: false,
    };
  }

  if (sampleCount < TREND_POLICY.minimumSamples || periodDays < TREND_POLICY.minimumPeriodDays) {
    return {
      status: 'historico_insuficiente',
      message: `Tendência ainda não consolidada: são necessárias pelo menos ${TREND_POLICY.minimumSamples} medições distribuídas por ${TREND_POLICY.minimumPeriodDays} dias.`,
      confidence: 'insuficiente',
      monthsToCritical: null,
      reliable: false,
    };
  }

  if (Math.abs(variation) < TREND_POLICY.stabilityDeadbandPercentagePoints) {
    return {
      status: 'estavel',
      message: `Variação dentro da faixa de estabilidade técnica (±${TREND_POLICY.stabilityDeadbandPercentagePoints.toFixed(2).replace('.', ',')} p.p.); mantenha o monitoramento periódico.`,
      confidence: 'moderada',
      monthsToCritical: null,
      reliable: false,
    };
  }

  if (slopePerMonth <= 0) {
    return {
      status: 'estavel',
      message: 'A série indica aproximação do valor nominal; não há crescimento do afastamento que sustente uma data de substituição.',
      confidence: 'moderada',
      monthsToCritical: null,
      reliable: false,
    };
  }

  if (slopePerMonth < TREND_POLICY.minimumGrowthPerMonth) {
    return {
      status: 'estavel',
      message: `O crescimento observado é inferior a ${TREND_POLICY.minimumGrowthPerMonth.toFixed(2).replace('.', ',')} p.p. por mês e não sustenta uma data de substituição.`,
      confidence: 'moderada',
      monthsToCritical: null,
      reliable: false,
    };
  }

  if (rSquared < TREND_POLICY.minimumRSquared) {
    return {
      status: 'correlacao_fraca',
      message: 'As medições oscilam sem correlação suficiente para estimar uma data de limite crítico. Programe novas medições em condições equivalentes.',
      confidence: 'baixa',
      monthsToCritical: null,
      reliable: false,
    };
  }

  const monthsToCritical = (criticalLimit - currentAbsoluteDeviation) / slopePerMonth;
  if (!Number.isFinite(monthsToCritical) || monthsToCritical <= 0) {
    return {
      status: 'correlacao_fraca',
      message: 'A série não permite estimar de forma consistente quando o limite crítico será atingido.',
      confidence: 'baixa',
      monthsToCritical: null,
      reliable: false,
    };
  }

  const confidence: ProjectionConfidence = sampleCount >= 5 && periodDays >= 180 && rSquared >= 0.8
    ? 'alta'
    : 'moderada';

  if (monthsToCritical > TREND_POLICY.maximumForecastMonths) {
    return {
      status: 'horizonte_excedido',
      message: `A tendência ultrapassa o horizonte confiável de ${TREND_POLICY.maximumForecastMonths} meses; não é apresentada uma data de substituição.`,
      confidence,
      monthsToCritical: null,
      reliable: true,
    };
  }

  return {
    status: 'disponivel',
    message: 'Estimativa indicativa dentro do horizonte confiável. Confirme a tendência por reteste antes de decidir pela substituição.',
    confidence,
    monthsToCritical,
    reliable: true,
  };
}

export function calculateTheoreticalCurrent(powerKvar: number, voltage: number): number {
  if (!Number.isFinite(powerKvar) || !Number.isFinite(voltage) || voltage <= 0) return 0;
  return (powerKvar * 1000) / (Math.sqrt(3) * voltage);
}

/**
 * Corrente esperada de um capacitor trifásico na tensão/frequência medidas.
 * Para capacitância constante, Q varia com V² e com a frequência.
 */
export function calculateExpectedCapacitorCurrent(
  nominalPowerKvar: number,
  nominalVoltage: number,
  measuredVoltage: number,
  nominalFrequency = 60,
  measuredFrequency = nominalFrequency,
): number {
  const values = [nominalPowerKvar, nominalVoltage, measuredVoltage, nominalFrequency, measuredFrequency];
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) return 0;
  const actualPowerKvar = nominalPowerKvar
    * (measuredVoltage / nominalVoltage) ** 2
    * (measuredFrequency / nominalFrequency);
  return calculateTheoreticalCurrent(actualPowerKvar, measuredVoltage);
}

export function calculateDeltaCapacitance(nominalPhaseCapacitance: number): number {
  if (!Number.isFinite(nominalPhaseCapacitance) || nominalPhaseCapacitance < 0) return 0;
  return nominalPhaseCapacitance * 1.5;
}

export function classifyDeviation(deviation: number): ValidationStatus {
  if (deviation >= -5 && deviation <= 10) return 'aprovado';
  if ((deviation >= -10 && deviation < -5) || (deviation > 10 && deviation <= 15)) return 'atencao';
  return 'reprovado';
}

export function calculateCapacitorTrend(measurements: TrendMeasurement[]): CapacitorTrend | null {
  const valid = measurements
    .filter(item => Number.isFinite(item.desvio_percentual) && !Number.isNaN(new Date(item.created_at).getTime()))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (valid.length < 2) return null;

  const first = valid[0];
  const last = valid[valid.length - 1];
  const firstDeviation = Number(first.desvio_percentual);
  const lastDeviation = Number(last.desvio_percentual);
  // A condição piora quando o desvio se afasta de zero, independentemente do sinal.
  const variation = Math.abs(lastDeviation) - Math.abs(firstDeviation);
  const elapsedDays = (new Date(last.created_at).getTime() - new Date(first.created_at).getTime()) / 86_400_000;

  if (elapsedDays <= 0) return null;

  const firstTimestamp = new Date(first.created_at).getTime();
  const days = valid.map(item => (new Date(item.created_at).getTime() - firstTimestamp) / 86_400_000);
  const deviations = valid.map(item => Math.abs(Number(item.desvio_percentual)));
  const regression = calculateLinearRegression(days, deviations);
  if (!regression) return null;

  const degradationPerMonth = regression.slopePerDay * 30;
  let forecast: CapacitorTrend['previsao'] = null;

  const criticalLimit = lastDeviation < 0 ? 10 : 15;
  const assessment = assessProjection({
    sampleCount: valid.length,
    periodDays: elapsedDays,
    variation,
    slopePerDay: regression.slopePerDay,
    rSquared: regression.rSquared,
    currentDeviation: lastDeviation,
    criticalLimit,
  });

  if (assessment.monthsToCritical !== null) {
    const forecastDate = new Date(new Date(last.created_at).getTime() + assessment.monthsToCritical * 30 * 86_400_000);
    forecast = { meses: assessment.monthsToCritical, data: forecastDate.toLocaleDateString('pt-BR') };
  }

  const trend = Math.abs(variation) < TREND_POLICY.stabilityDeadbandPercentagePoints
    ? 'estavel'
    : variation > 0 ? 'piorando' : 'melhorando';

  return {
    capacitorId: last.capacitores?.id || null,
    bancoId: last.bancos_capacitores?.id || null,
    nome: last.capacitores?.codigo_identificacao || 'Não identificado',
    banco: last.bancos_capacitores?.nome_banco || 'Não identificado',
    variacao: variation,
    degradacaoPorMes: degradationPerMonth,
    tendencia: trend,
    primeiraData: new Date(first.created_at).toLocaleDateString('pt-BR'),
    ultimaData: new Date(last.created_at).toLocaleDateString('pt-BR'),
    primeiroDesvio: firstDeviation,
    ultimoDesvio: lastDeviation,
    previsao: forecast,
    statusProjecao: assessment.status,
    mensagemProjecao: assessment.message,
    confianca: assessment.confidence,
    rQuadrado: regression.rSquared,
    amostras: valid.length,
    periodoDias: elapsedDays,
  };
}

export function calculateDeviationProjection(
  measurements: Pick<TrendMeasurement, 'created_at' | 'desvio_percentual'>[],
): DeviationProjection | null {
  const valid = measurements
    .filter(item => Number.isFinite(item.desvio_percentual) && !Number.isNaN(new Date(item.created_at).getTime()))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (valid.length < 2) return null;

  const firstTimestamp = new Date(valid[0].created_at).getTime();
  const days = valid.map(item => (new Date(item.created_at).getTime() - firstTimestamp) / 86_400_000);
  const deviations = valid.map(item => Math.abs(Number(item.desvio_percentual)));
  const regression = calculateLinearRegression(days, deviations);
  if (!regression) return null;

  const { slopePerDay, intercept, rSquared } = regression;
  const lastDay = days[days.length - 1];
  const futureDeviations = [90, 180, 270].map(offset =>
    Math.max(0, slopePerDay * (lastDay + offset) + intercept),
  );
  const latestSignedDeviation = Number(valid[valid.length - 1].desvio_percentual);
  const criticalLimit = latestSignedDeviation < 0 ? 10 : 15;
  const variation = deviations[deviations.length - 1] - deviations[0];
  const periodDays = days[days.length - 1];
  const assessment = assessProjection({
    sampleCount: valid.length,
    periodDays,
    variation,
    slopePerDay,
    rSquared,
    currentDeviation: latestSignedDeviation,
    criticalLimit,
  });

  let trend: DeviationProjection['trend'] = 'estavel';
  if (Math.abs(variation) >= TREND_POLICY.stabilityDeadbandPercentagePoints) {
    if (slopePerDay > 0.02) trend = 'alta';
    else if (slopePerDay > 0.005) trend = 'moderada';
  }

  return {
    slopePerDay,
    futureDeviations,
    monthsToCritical: assessment.monthsToCritical === null ? null : Math.round(assessment.monthsToCritical),
    trend,
    criticalLimit,
    reliable: assessment.reliable,
    status: assessment.status,
    message: assessment.message,
    confidence: assessment.confidence,
    rSquared,
    sampleCount: valid.length,
    periodDays,
  };
}
