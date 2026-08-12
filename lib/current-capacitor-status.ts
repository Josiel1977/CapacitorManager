export type ValidationStatus = "aprovado" | "atencao" | "reprovado";

export interface CapacitorMeasurementStatus {
  capacitor_id: string | null | undefined;
  tipo_teste: string | null | undefined;
  created_at: string;
  status_validacao: ValidationStatus | string | null | undefined;
}

export interface CurrentCapacitorStatus {
  capacitorId: string;
  status: ValidationStatus;
  latestMeasurements: CapacitorMeasurementStatus[];
}

const severity: Record<ValidationStatus, number> = {
  aprovado: 0,
  atencao: 1,
  reprovado: 2,
};

const isStatus = (value: unknown): value is ValidationStatus =>
  value === "aprovado" || value === "atencao" || value === "reprovado";

export function deriveCurrentCapacitorStatuses(
  measurements: CapacitorMeasurementStatus[],
): CurrentCapacitorStatus[] {
  const latestByCapacitorAndTest = new Map<string, CapacitorMeasurementStatus>();

  for (const measurement of measurements) {
    if (!measurement.capacitor_id || !measurement.tipo_teste || !isStatus(measurement.status_validacao)) continue;
    const key = `${measurement.capacitor_id}:${measurement.tipo_teste}`;
    const current = latestByCapacitorAndTest.get(key);
    if (!current || new Date(measurement.created_at).getTime() > new Date(current.created_at).getTime()) {
      latestByCapacitorAndTest.set(key, measurement);
    }
  }

  const grouped = new Map<string, CapacitorMeasurementStatus[]>();
  for (const measurement of latestByCapacitorAndTest.values()) {
    const list = grouped.get(measurement.capacitor_id!) ?? [];
    list.push(measurement);
    grouped.set(measurement.capacitor_id!, list);
  }

  return [...grouped.entries()].map(([capacitorId, latestMeasurements]) => ({
    capacitorId,
    status: latestMeasurements.reduce<ValidationStatus>((worst, measurement) =>
      severity[measurement.status_validacao as ValidationStatus] > severity[worst]
        ? measurement.status_validacao as ValidationStatus
        : worst, "aprovado"),
    latestMeasurements,
  }));
}

export function countCurrentCapacitorStatuses(measurements: CapacitorMeasurementStatus[]) {
  return deriveCurrentCapacitorStatuses(measurements).reduce(
    (counts, capacitor) => {
      counts[capacitor.status] += 1;
      return counts;
    },
    { aprovado: 0, atencao: 0, reprovado: 0 },
  );
}
