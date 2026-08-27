export type ReactiveDirection = "indutivo" | "capacitivo" | "neutro";

export interface ReactiveExposureSample {
  activePowerKw: number;
  powerFactor: number;
  direction: ReactiveDirection;
}

export const estimateReactiveIntervalExposure = (
  sample: ReactiveExposureSample,
  tariffPerKwh: number,
  minimumPowerFactor: number,
  intervalMinutes: number,
) => {
  if (!Number.isFinite(sample.activePowerKw) || sample.activePowerKw <= 0) return 0;
  if (!Number.isFinite(sample.powerFactor) || sample.powerFactor <= 0 || sample.powerFactor >= minimumPowerFactor) return 0;
  if (sample.direction === "neutro" || !Number.isFinite(tariffPerKwh) || tariffPerKwh <= 0 || intervalMinutes <= 0) return 0;
  const activeEnergyKwh = sample.activePowerKw * intervalMinutes / 60;
  const excessFactor = Math.max(0, minimumPowerFactor / Math.max(0.01, sample.powerFactor) - 1);
  return activeEnergyKwh * tariffPerKwh * excessFactor;
};

export const estimateReactiveExposure = (
  samples: ReactiveExposureSample[],
  tariffPerKwh: number,
  minimumPowerFactor: number,
  intervalMinutes: number,
) => samples.reduce((totals, sample) => {
  const value = estimateReactiveIntervalExposure(sample, tariffPerKwh, minimumPowerFactor, intervalMinutes);
  if (sample.direction === "indutivo") totals.inductive += value;
  if (sample.direction === "capacitivo") totals.capacitive += value;
  totals.total += value;
  return totals;
}, { total: 0, inductive: 0, capacitive: 0 });
