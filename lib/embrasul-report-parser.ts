export const EMBRASUL_PARSER_VERSION = "1.0.0";

export interface EmbrasulReport {
  analyzer: string;
  serialNumber: string | null;
  softwareVersion: string | null;
  integrationMinutes: number | null;
  startedAt: string | null;
  endedAt: string | null;
  averageActivePowerKw: number | null;
  averageReactivePowerKvar: number | null;
  averageApparentPowerKva: number | null;
  averagePowerFactor: number | null;
  maximumApparentPowerKva: number | null;
  averagePhaseVoltageV: number | null;
  averagePhaseCurrentA: number | null;
  reactiveBehavior: "capacitivo" | "indutivo" | "nao_classificado";
  fixedCapacitorConnected: boolean | null;
  fixedCapacitorKvar: number | null;
  confidence: "insuficiente" | "preliminar";
  alerts: string[];
  rawText: string;
}

const br = (value?: string) => value ? Number(value.replace(/\./g, "").replace(",", ".")) : null;
const capture = (text: string, pattern: RegExp) => text.match(pattern)?.[1];

export function parseEmbrasulReport(
  text: string,
  context: { fixedCapacitorConnected?: boolean | null; fixedCapacitorKvar?: number | null } = {},
): EmbrasulReport {
  const normalized = text.replace(/\s+/g, " ").trim();
  const header = normalized.match(/EMBRASUL\s+([^\s]+).*?N\.S[:.]\s*(\d+).*?V\.S[.:]?\s*([\d,.]+)/i);
  const integration = capture(normalized, /Integra[cç][aã]o\s*=\s*(\d+)\s*minutos/i)
    ?? capture(normalized, /\((\d+)\s*minutos\)/i);
  const interval = normalized.match(/Intervalo considerado:\s*.*?(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2}(?:,\d+)?)\s*at[eé]\s*.*?(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2}(?:,\d+)?)/i);
  const averages = normalized.match(/Pot[eê]ncias m[eé]dias.*?Total\s+([\d.,]+)\s+(-?[\d.,]+)\s+([\d.,]+)\s+(-?[\d.,]+)/i);
  const apparentMax = capture(normalized, /3f\s+([\d.,]+)\s+\d{2}\/\d{2}\/\d{4}/i);
  const phaseA = br(capture(normalized, /Fase A:\s*tens[oõ]es\s*\[V\]\s*Correntes\s*\[A\]\s*M[eé]dia\s+([\d.,]+)/i));
  const phaseB = br(capture(normalized, /Fase B:\s*tens[oõ]es\s*\[V\]\s*Correntes\s*\[A\]\s*M[eé]dia\s+([\d.,]+)/i));
  const phaseC = br(capture(normalized, /Fase C:\s*tens[oõ]es\s*\[V\]\s*Correntes\s*\[A\]\s*M[eé]dia\s+([\d.,]+)/i));
  const currentA = br(capture(normalized, /Fase A:.*?Correntes\s*\[A\].*?M[eé]dia\s+[\d.,]+\s+M[eé]dia\s+([\d.,]+)/i));
  const currentB = br(capture(normalized, /Fase B:.*?Correntes\s*\[A\].*?M[eé]dia\s+[\d.,]+\s+M[eé]dia\s+([\d.,]+)/i));
  const currentC = br(capture(normalized, /Fase C:.*?Correntes\s*\[A\].*?M[eé]dia\s+[\d.,]+\s+M[eé]dia\s+([\d.,]+)/i));
  const p = br(averages?.[1]);
  const q = br(averages?.[2]);
  const s = br(averages?.[3]);
  const fp = br(averages?.[4]);
  const alerts: string[] = [];
  if (q != null && q < 0) alerts.push("Reativo líquido capacitivo identificado no ponto de medição.");
  if (q != null && q < 0 && context.fixedCapacitorConnected) alerts.push("Sobrecompensação provável com capacitor fixo conectado; comparar com campanha de capacitor desligado.");
  if (!/THD|harm[oô]nic/i.test(normalized)) alerts.push("Relatório sem THDv/THDi: não concluir sobre dessintonia ou ressonância.");
  if (/M[ií]nimo\s+-[\d.,]+/i.test(normalized)) alerts.push("Há grandeza de corrente com sinal negativo; validar diagrama fasorial e associação dos TCs.");

  const toIso = (date?: string, time?: string) => {
    if (!date || !time) return null;
    const [d, m, y] = date.split("/");
    return `${y}-${m}-${d}T${time.replace(",", ".")}`;
  };
  const voltageValues = [phaseA, phaseB, phaseC].filter((v): v is number => v != null);
  const currentValues = [currentA, currentB, currentC].filter((v): v is number => v != null);
  return {
    analyzer: header?.[1] ? `EMBRASUL ${header[1]}` : "EMBRASUL",
    serialNumber: header?.[2] ?? null,
    softwareVersion: header?.[3]?.replace(",", ".") ?? null,
    integrationMinutes: integration ? Number(integration) : null,
    startedAt: toIso(interval?.[1], interval?.[2]),
    endedAt: toIso(interval?.[3], interval?.[4]),
    averageActivePowerKw: p,
    averageReactivePowerKvar: q,
    averageApparentPowerKva: s,
    averagePowerFactor: fp,
    maximumApparentPowerKva: br(apparentMax),
    averagePhaseVoltageV: voltageValues.length ? voltageValues.reduce((a, b) => a + b, 0) / voltageValues.length : null,
    averagePhaseCurrentA: currentValues.length ? currentValues.reduce((a, b) => a + b, 0) / currentValues.length : null,
    reactiveBehavior: q == null ? "nao_classificado" : q < 0 ? "capacitivo" : "indutivo",
    fixedCapacitorConnected: context.fixedCapacitorConnected ?? null,
    fixedCapacitorKvar: context.fixedCapacitorKvar ?? null,
    confidence: p != null && q != null && s != null ? "preliminar" : "insuficiente",
    alerts,
    rawText: text,
  };
}
