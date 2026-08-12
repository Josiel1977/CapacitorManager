export interface ParsedEquatorialInvoice {
  concessionaria: "EQUATORIAL_PARA" | "DESCONHECIDA";
  mes_referencia: string;
  consumo_ponta_kwh: number;
  consumo_fora_ponta_kwh: number;
  demanda_ponta_kw: number;
  demanda_fora_ponta_kw: number;
  reativo_ponta_kvarh: number;
  reativo_fora_ponta_kvarh: number;
  total_pagar: number;
  dias_ciclo: number;
  fp_calculado?: number;
  reativo_origem: "excedente_faturado";
  penalidade_reativa_informada: number | null;
  tarifa_reativa_aplicada: number | null;
  fonte_dados: "pdf";
}

const BR_NUMBER = "([\\d.]+,\\d+)";

const parseBR = (value?: string) => value
  ? Number(value.replace(/\./g, "").replace(",", "."))
  : 0;

const firstNumberAfter = (text: string, label: RegExp) => {
  const match = text.match(new RegExp(`${label.source}\\s*${BR_NUMBER}`, "i"));
  return parseBR(match?.[1]);
};

const billedItem = (text: string, label: RegExp) => {
  const match = text.match(new RegExp(
    `${label.source}\\s*${BR_NUMBER}\\s+${BR_NUMBER}\\s+${BR_NUMBER}\\s+${BR_NUMBER}\\s+${BR_NUMBER}\\s+${BR_NUMBER}`,
    "i",
  ));
  if (!match) return null;
  return {
    quantity: parseBR(match[1]),
    grossTariff: parseBR(match[2]),
    netTariff: parseBR(match[3]),
    billedAmount: parseBR(match[6]),
  };
};

export function parseEquatorialInvoiceText(text: string): ParsedEquatorialInvoice {
  const normalized = text.replace(/\s+/g, " ").trim();
  const isEquatorialPara = /Equatorial\s+Par[aá]\s+Distribuidora/i.test(normalized);
  const month = normalized.match(/(?:Conta\s*M[eê]s|Refer[eê]ncia|Compet[eê]ncia)\s*[:\-]?\s*(\d{2}\/\d{4})/i)
    ?? normalized.match(/\b(\d{2}\/\d{4})\b/);
  const days = normalized.match(/N[ºo°]\s*de\s*Dias\s*(\d{1,2})/i);
  const total = normalized.match(/Total\s*a\s*Pagar\s*R\$\s*([\d.]+,\d{2})/i);
  const demandOffPeak = normalized.match(/Dem\.\s*M[aá]x\.\s*F\.\s*Ponta\s*\(kW\)\s*:\s*([\d.,]+)/i);
  const demandPeak = normalized.match(/Dem\.\s*M[aá]x\.\s*Ponta\s*\(kW\)\s*:\s*([\d.,]+)/i);
  const reactivePeak = billedItem(normalized, /Consumo\s+Reativo\s+Excedente\s+NP\s*\(kVAr\)/i);
  const reactiveOffPeak = billedItem(normalized, /Consumo\s+Reativo\s+Excedente\s+FP\s*\(kVAr\)/i);
  const reactiveItems = [reactivePeak, reactiveOffPeak].filter((item): item is NonNullable<typeof item> => item !== null);
  const penalty = reactiveItems.length
    ? reactiveItems.reduce((sum, item) => sum + item.billedAmount, 0)
    : null;
  const weightedTariff = reactiveItems.length
    ? reactiveItems.reduce((sum, item) => sum + item.quantity * item.grossTariff, 0) /
      reactiveItems.reduce((sum, item) => sum + item.quantity, 0)
    : null;

  return {
    concessionaria: isEquatorialPara ? "EQUATORIAL_PARA" : "DESCONHECIDA",
    mes_referencia: month?.[1] ?? "",
    consumo_ponta_kwh: firstNumberAfter(normalized, /TUSD\s+Energia\s+Ponta\s*\(kWh\)/i),
    consumo_fora_ponta_kwh: firstNumberAfter(normalized, /TUSD\s+Energia\s+Fora\s+Ponta\s*\(kWh\)/i),
    demanda_ponta_kw: parseBR(demandPeak?.[1]),
    demanda_fora_ponta_kw: parseBR(demandOffPeak?.[1]),
    reativo_ponta_kvarh: reactivePeak?.quantity ?? 0,
    reativo_fora_ponta_kvarh: reactiveOffPeak?.quantity ?? 0,
    total_pagar: parseBR(total?.[1]),
    dias_ciclo: days ? Number(days[1]) : 30,
    fp_calculado: undefined,
    reativo_origem: "excedente_faturado",
    penalidade_reativa_informada: penalty,
    tarifa_reativa_aplicada: weightedTariff,
    fonte_dados: "pdf",
  };
}
