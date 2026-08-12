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

export interface PdfTextItemLike {
  str: string;
  transform?: number[];
}

export function reconstructPdfText(items: PdfTextItemLike[]): string {
  const positioned = items
    .filter((item) => item.str?.trim())
    .map((item, index) => ({
      text: item.str.trim(),
      x: item.transform?.[4] ?? index,
      y: item.transform?.[5] ?? 0,
    }));
  const rows: Array<{ y: number; items: typeof positioned }> = [];
  for (const item of positioned.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 2);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => row.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" "))
    .join("\n");
}

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
  const isEquatorialPara = /Equatorial/i.test(normalized) && /Par[aá]/i.test(normalized);
  const labelledMonth = normalized.match(/(?:Conta\s*M[eê]s|Refer[eê]ncia|Compet[eê]ncia)\s*[:\-]?\s*(\d{2}\/\d{4})/i);
  const monthCandidates = [...normalized.matchAll(/\b(0[1-9]|1[0-2])\/(20\d{2})\b/g)].map((match) => match[0]);
  const frequency = new Map<string, number>();
  for (const candidate of monthCandidates) frequency.set(candidate, (frequency.get(candidate) ?? 0) + 1);
  const predominantMonth = [...frequency.entries()].sort((a, b) =>
    b[1] - a[1] || Number(b[0].slice(3) + b[0].slice(0, 2)) - Number(a[0].slice(3) + a[0].slice(0, 2))
  )[0]?.[0];
  const days = normalized.match(/N[ºo°]\s*de\s*Dias\s*(\d{1,2})/i);
  const labelledTotal = normalized.match(/Total\s*a\s*Pagar\s*R\$\s*([\d.]+,\d{2})/i);
  const currencyValues = [...normalized.matchAll(/R\$\s*([\d.]+,\d{2})/gi)].map((match) => parseBR(match[1]));
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
    mes_referencia: labelledMonth?.[1] ?? predominantMonth ?? "",
    consumo_ponta_kwh: firstNumberAfter(normalized, /TUSD\s+Energia\s+Ponta\s*\(kWh\)/i),
    consumo_fora_ponta_kwh: firstNumberAfter(normalized, /TUSD\s+Energia\s+Fora\s+Ponta\s*\(kWh\)/i),
    demanda_ponta_kw: parseBR(demandPeak?.[1]),
    demanda_fora_ponta_kw: parseBR(demandOffPeak?.[1]),
    reativo_ponta_kvarh: reactivePeak?.quantity ?? 0,
    reativo_fora_ponta_kvarh: reactiveOffPeak?.quantity ?? 0,
    total_pagar: parseBR(labelledTotal?.[1]) || Math.max(0, ...currencyValues),
    dias_ciclo: days ? Number(days[1]) : 30,
    fp_calculado: undefined,
    reativo_origem: "excedente_faturado",
    penalidade_reativa_informada: penalty,
    tarifa_reativa_aplicada: weightedTariff,
    fonte_dados: "pdf",
  };
}
