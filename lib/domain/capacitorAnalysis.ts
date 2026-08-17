export type ValidationStatus = 'aprovado' | 'atencao' | 'reprovado';

export interface TrendMeasurement {
  created_at: string;
  desvio_percentual: number | null;
  capacitores?: { codigo_identificacao?: string | null } | null;
  bancos_capacitores?: { nome_banco?: string | null } | null;
}

export interface CapacitorTrend {
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
}

export function calculateTheoreticalCurrent(powerKvar: number, voltage: number): number {
  if (!Number.isFinite(powerKvar) || !Number.isFinite(voltage) || voltage <= 0) return 0;
  return (powerKvar * 1000) / (Math.sqrt(3) * voltage);
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
  const variation = lastDeviation - firstDeviation;
  const elapsedDays = (new Date(last.created_at).getTime() - new Date(first.created_at).getTime()) / 86_400_000;

  if (elapsedDays <= 0) return null;

  const degradationPerMonth = (variation / elapsedDays) * 30;
  let forecast: CapacitorTrend['previsao'] = null;

  if (degradationPerMonth > 0 && lastDeviation < 15) {
    const remainingMonths = (15 - lastDeviation) / degradationPerMonth;
    if (Number.isFinite(remainingMonths) && remainingMonths >= 0) {
      const forecastDate = new Date(new Date(last.created_at).getTime() + remainingMonths * 30 * 86_400_000);
      forecast = { meses: remainingMonths, data: forecastDate.toLocaleDateString('pt-BR') };
    }
  }

  return {
    nome: last.capacitores?.codigo_identificacao || 'Não identificado',
    banco: last.bancos_capacitores?.nome_banco || 'Não identificado',
    variacao: variation,
    degradacaoPorMes: degradationPerMonth,
    tendencia: variation > 0 ? 'piorando' : variation < 0 ? 'melhorando' : 'estavel',
    primeiraData: new Date(first.created_at).toLocaleDateString('pt-BR'),
    ultimaData: new Date(last.created_at).toLocaleDateString('pt-BR'),
    primeiroDesvio: firstDeviation,
    ultimoDesvio: lastDeviation,
    previsao: forecast,
  };
}
