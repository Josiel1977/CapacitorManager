export const SIZING_ENGINE_VERSION = "3.0.0-rc23";
export const REGULATORY_MINIMUM_FP = 0.92;
export const MINIMUM_INVOICES = 3;
export const RECOMMENDED_INVOICES = 6;

export type ConfidenceLevel = "validated" | "preliminary" | "insufficient";
export type InvoiceDemandSource = "invoice" | "manual_measurement" | "transformer_estimate";
export type InvoicePowerFactorSource = "invoice" | "manual_measurement" | "derived_energy" | "unknown";

export interface SizingInvoiceInput {
  id: string;
  month: string;
  demandKw: number;
  measuredPowerFactor?: number;
  excessReactiveKvarh?: number;
  reactiveTariff?: number;
  informedReactiveCharge?: number;
}

export interface SizingOptions {
  targetPowerFactor: number;
  percentile?: number;
  futureLoadMarginPercent?: number;
  controllerStages?: number;
  installedTransformerKva?: number;
  transformerSafetyLimit?: number;
  /** Percentual prudente da penalidade que se espera eliminar (0–100). */
  savingsRealizationPercent?: number;
  demandSource?: InvoiceDemandSource;
  powerFactorSource?: InvoicePowerFactorSource;
  /** Demanda ativa e FP obtidos no mesmo intervalo de integração. */
  coincidentDemandAndPowerFactor?: boolean;
}

export interface MonthlySizingResult {
  id: string;
  month: string;
  demandKw: number;
  powerFactor: number;
  theoreticalKvar: number;
  estimatedReactiveCharge: number;
}

export interface SizingAuditResult {
  engineVersion: string;
  calculatedAt: string;
  confidence: ConfidenceLevel;
  method: "invoice_pre_sizing";
  releaseLevel: "blocked" | "pre_sizing";
  specificationAllowed: false;
  targetPowerFactor: number;
  percentile: number;
  theoreticalKvar: number;
  p50Kvar: number;
  p90Kvar: number;
  p95Kvar: number;
  commercialKvar: number;
  projectedPowerFactor: number;
  stages: number[];
  monthly: MonthlySizingResult[];
  excludedInvoices: Array<{ id: string; month: string; reason: string }>;
  estimatedMonthlyReactiveCharge: number;
  estimatedMonthlySaving: number;
  transformerLimitKvar: number | null;
  limitApplied: boolean;
  warnings: string[];
  assumptions: string[];
  formula: string;
}

const round = (value: number, decimals = 4) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export const compensationKvar = (activePowerKw: number, currentFp: number, targetFp: number) => {
  if (!Number.isFinite(activePowerKw) || activePowerKw <= 0) return 0;
  if (!(currentFp > 0 && currentFp < 1) || !(targetFp > 0 && targetFp < 1)) return 0;
  if (currentFp >= targetFp) return 0;
  return Math.max(0, activePowerKw * (Math.tan(Math.acos(currentFp)) - Math.tan(Math.acos(targetFp))));
};

export const percentileValue = (values: number[], percentile: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const p = Math.min(1, Math.max(0, percentile));
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return round(sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower));
};

export const buildCommercialStages = (commercialKvar: number, controllerStages: number) => {
  const unitKvar = 2.5;
  const units = Math.round(commercialKvar / unitKvar);
  if (units <= 0) return [];
  const stageCount = Math.min(Math.max(1, Math.trunc(controllerStages)), units);
  const baseUnits = Math.floor(units / stageCount);
  let remainder = units % stageCount;
  return Array.from({ length: stageCount }, () => {
    const stageUnits = baseUnits + (remainder-- > 0 ? 1 : 0);
    return stageUnits * unitKvar;
  }).sort((a, b) => a - b);
};

export function calculateAuditableSizing(
  invoices: SizingInvoiceInput[],
  options: SizingOptions,
): SizingAuditResult {
  const percentile = options.percentile ?? 0.9;
  const targetFp = options.targetPowerFactor;
  const marginMultiplier = 1 + Math.max(0, options.futureLoadMarginPercent ?? 0) / 100;
  const warnings: string[] = [];
  const assumptions: string[] = [];
  const excludedInvoices: SizingAuditResult["excludedInvoices"] = [];

  if (!(targetFp >= REGULATORY_MINIMUM_FP && targetFp < 1)) {
    throw new Error(`O fator de potência alvo deve estar entre ${REGULATORY_MINIMUM_FP} e 0,99.`);
  }

  const monthly = invoices.flatMap<MonthlySizingResult>((invoice) => {
    const fp = invoice.measuredPowerFactor;
    if (!Number.isFinite(invoice.demandKw) || invoice.demandKw <= 0) {
      excludedInvoices.push({ id: invoice.id, month: invoice.month, reason: "Demanda ativa ausente ou inválida" });
      return [];
    }
    if (fp === undefined || !Number.isFinite(fp) || fp <= 0.3 || fp >= 1) {
      excludedInvoices.push({ id: invoice.id, month: invoice.month, reason: "FP medido/informado ausente ou inválido" });
      return [];
    }
    const theoreticalKvar = compensationKvar(invoice.demandKw * marginMultiplier, fp, targetFp);
    const informedCharge = invoice.informedReactiveCharge;
    const estimatedReactiveCharge = informedCharge !== undefined && Number.isFinite(informedCharge) && informedCharge >= 0
      ? informedCharge
      : Math.max(0, invoice.excessReactiveKvarh ?? 0) * Math.max(0, invoice.reactiveTariff ?? 0);
    return [{
      id: invoice.id,
      month: invoice.month,
      demandKw: invoice.demandKw,
      powerFactor: fp,
      theoreticalKvar: round(theoreticalKvar),
      estimatedReactiveCharge: round(estimatedReactiveCharge, 2),
    }];
  });

  let confidence: ConfidenceLevel = monthly.length < MINIMUM_INVOICES ? "insufficient" : "preliminary";

  if (confidence === "insufficient") {
    warnings.push(`São necessárias pelo menos ${MINIMUM_INVOICES} faturas válidas com demanda e FP confiável.`);
  } else if (monthly.length < RECOMMENDED_INVOICES || excludedInvoices.length > 0) {
    warnings.push(`Pré-dimensionamento com histórico limitado: recomenda-se analisar entre ${RECOMMENDED_INVOICES} e 12 faturas válidas.`);
  } else {
    warnings.push("Mesmo com histórico completo, faturas permitem apenas pré-dimensionamento. A especificação exige campanha temporal e validações de engenharia.");
  }
  if (excludedInvoices.length) warnings.push(`${excludedInvoices.length} fatura(s) foram excluídas da memória de cálculo.`);
  if ((options.futureLoadMarginPercent ?? 0) > 0) {
    warnings.push("A margem de crescimento aumenta o banco e deve ser justificada por expansão documentada da carga.");
  }
  if (options.demandSource === "transformer_estimate") {
    warnings.push("A potência ativa foi estimada pela carga do transformador; substitua-a por demanda medida para reduzir a incerteza.");
    assumptions.push("Demanda ativa estimada a partir da potência do transformador e do fator de carga informado.");
  } else if (options.demandSource === "manual_measurement") {
    assumptions.push("Demanda ativa informada manualmente pelo usuário.");
  } else {
    assumptions.push("Demanda ativa extraída do histórico de faturas.");
  }
  if (options.powerFactorSource === "derived_energy") {
    warnings.push("O FP foi derivado de energias agregadas e pode não coincidir com a demanda máxima do mês.");
    assumptions.push("Fator de potência derivado de energia ativa e reativa agregadas.");
  } else if (options.powerFactorSource === "manual_measurement") {
    assumptions.push("Fator de potência informado manualmente pelo usuário.");
  } else {
    assumptions.push("Fator de potência extraído/informado nas faturas válidas.");
  }
  if (!options.coincidentDemandAndPowerFactor) {
    warnings.push("Demanda e fator de potência não foram confirmados como coincidentes no mesmo intervalo; o resultado não libera compra ou instalação.");
  }

  const distribution = monthly.map((item) => item.theoreticalKvar);
  const p50Kvar = confidence === "insufficient" ? 0 : percentileValue(distribution, 0.5);
  const p90Kvar = confidence === "insufficient" ? 0 : percentileValue(distribution, 0.9);
  const p95Kvar = confidence === "insufficient" ? 0 : percentileValue(distribution, 0.95);
  const theoreticalKvar = confidence === "insufficient" ? 0 : percentileValue(distribution, percentile);
  let commercialKvar = Math.ceil(theoreticalKvar / 2.5) * 2.5;

  const installedKva = options.installedTransformerKva ?? 0;
  const transformerLimitKvar = installedKva > 0
    ? installedKva * (options.transformerSafetyLimit ?? 0.4)
    : null;
  let limitApplied = false;
  if (transformerLimitKvar !== null && commercialKvar > transformerLimitKvar) {
    commercialKvar = Math.floor(transformerLimitKvar / 2.5) * 2.5;
    limitApplied = true;
    confidence = "preliminary";
    warnings.push("O resultado atingiu o limite preventivo dos transformadores; é obrigatória medição em campo antes da especificação.");
  }

  const estimatedMonthlyReactiveCharge = monthly.length
    ? monthly.reduce((sum, item) => sum + item.estimatedReactiveCharge, 0) / monthly.length
    : 0;
  if (estimatedMonthlyReactiveCharge === 0) {
    warnings.push("Economia não calculada: informe o reativo excedente e a tarifa aplicável, ou o valor faturado da penalidade.");
  }

  const realization = Math.min(100, Math.max(0, options.savingsRealizationPercent ?? 90));
  if (estimatedMonthlyReactiveCharge > 0 && realization < 100) {
    warnings.push(`A economia usa realização prudente de ${realization}% da cobrança reativa média; não é garantia de resultado.`);
  }

  let projectedPowerFactor = monthly.length
    ? Math.min(...monthly.map((item) => item.powerFactor), targetFp)
    : targetFp;
  if (commercialKvar > 0 && !limitApplied) {
    projectedPowerFactor = targetFp;
  } else if (commercialKvar > 0 && monthly.length) {
    const representative = monthly.reduce((best, item) =>
      Math.abs(item.theoreticalKvar - theoreticalKvar) < Math.abs(best.theoreticalKvar - theoreticalKvar) ? item : best
    );
    const activePower = representative.demandKw * marginMultiplier;
    const originalReactive = activePower * Math.tan(Math.acos(representative.powerFactor));
    const remainingReactive = Math.max(0, originalReactive - commercialKvar);
    projectedPowerFactor = activePower / Math.sqrt(activePower ** 2 + remainingReactive ** 2);
    warnings.push('O fator de potência projetado ficou abaixo do alvo porque o limite preventivo do transformador restringiu o banco.');
  }

  return {
    engineVersion: SIZING_ENGINE_VERSION,
    calculatedAt: new Date().toISOString(),
    confidence,
    method: "invoice_pre_sizing",
    releaseLevel: confidence === "insufficient" ? "blocked" : "pre_sizing",
    specificationAllowed: false,
    targetPowerFactor: targetFp,
    percentile,
    theoreticalKvar: round(theoreticalKvar),
    p50Kvar: round(p50Kvar),
    p90Kvar: round(p90Kvar),
    p95Kvar: round(p95Kvar),
    commercialKvar: round(commercialKvar),
    projectedPowerFactor: round(projectedPowerFactor, 4),
    stages: buildCommercialStages(commercialKvar, options.controllerStages ?? 6),
    monthly,
    excludedInvoices,
    estimatedMonthlyReactiveCharge: round(estimatedMonthlyReactiveCharge, 2),
    estimatedMonthlySaving: round(estimatedMonthlyReactiveCharge * realization / 100, 2),
    transformerLimitKvar: transformerLimitKvar === null ? null : round(transformerLimitKvar),
    limitApplied,
    warnings,
    assumptions,
    formula: "Qc = P × [tan(arccos(FP atual)) − tan(arccos(FP alvo))]; faixa = P50/P90/P95 das faturas válidas",
  };
}
