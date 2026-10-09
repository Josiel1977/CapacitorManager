export type Mode = 'B-optante' | 'A-verde' | 'A-azul';
export interface TariffScenario {
  mode: Mode;
  energyPeak: number | null;
  energyOffPeak: number | null;
  demandPeak: number | null;
  demandOffPeak: number | null;
  contractedPeak: number | null;
  contractedOffPeak: number | null;
  gdCharge: number | null;
  otherCharges: number | null;
}
export interface EnergyStudy {
  currentKva: number | null;
  futureKva: number | null;
  sameUnit: boolean | null;
  solarLocal: boolean | null;
  remoteCredits: boolean | null;
  netPeakKwh: number | null;
  netOffPeakKwh: number | null;
  measuredPeakKw: number | null;
  measuredOffPeakKw: number | null;
  confirmed: boolean;
  tariffSource: string;
  scenarios: TariffScenario[];
}
const valid = (n: number | null): n is number => n !== null && Number.isFinite(n) && n >= 0;
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
function demandCost(measured: number, contracted: number, tariff: number) {
  const excess = measured > contracted * 1.05 ? (measured - contracted) * tariff * 2 : 0;
  return { base: Math.max(measured, contracted) * tariff, excess };
}
export function diagnoseEnergyTariffs(study: EnergyStudy) {
  const warnings: string[] = [];
  const kva = study.sameUnit === true ? study.futureKva : null;
  const bEligibility = kva === null || !valid(kva) || kva <= 0 || !valid(study.currentKva) || study.currentKva <= 0 || kva < study.currentKva || study.solarLocal === null || study.remoteCredits === null
    ? 'pendente'
    : kva > 112.5 || !study.solarLocal || study.remoteCredits ? 'incompativel' : 'compativel';
  if (study.sameUnit !== true) warnings.push('Confirmar a potência total por unidade consumidora e medição. Transformadores em UCs distintas exigem estudos separados.');
  if (bEligibility === 'incompativel') warnings.push('O cenário informado não atende aos critérios gerais de B-optante com SCEE. Confirmar enquadramento e adequação com a distribuidora antes da ampliação.');
  if (bEligibility === 'pendente') warnings.push('Elegibilidade de B-optante pendente: confirmar transformadores, geração local e alocação de créditos entre UCs.');
  warnings.push('Energia compensada/injetada não é geração solar total. Conferir inversores, autoconsumo e créditos. Não dimensionar capacitores pelo reativo excedente mensal.');
  const results = study.scenarios.map(s => {
    const missing: string[] = [];
    if (!valid(study.netPeakKwh) || !valid(study.netOffPeakKwh)) missing.push('consumo líquido por posto');
    if (!valid(s.energyOffPeak) || s.energyOffPeak <= 0) missing.push('tarifa de energia');
    if (!valid(s.gdCharge) || !valid(s.otherCharges)) missing.push('encargos GD e demais custos');
    if (s.mode !== 'B-optante') {
      if (!valid(s.energyPeak) || s.energyPeak <= 0) missing.push('tarifa de ponta');
      if (!valid(study.measuredPeakKw) || !valid(study.measuredOffPeakKw)) missing.push('demanda medida por posto');
      if (!valid(s.demandOffPeak) || s.demandOffPeak <= 0 || !valid(s.contractedOffPeak) || (s.mode === 'A-verde' && s.contractedOffPeak < 30)) missing.push('demanda contratada e tarifa (mínimo geral de 30 kW neste simulador)');
      if (s.mode === 'A-azul' && (!valid(s.demandPeak) || s.demandPeak <= 0 || !valid(s.contractedPeak))) missing.push('demanda contratada e tarifa de ponta');
      if (s.mode === 'A-azul' && valid(s.contractedPeak) && valid(s.contractedOffPeak) && Math.max(s.contractedPeak,s.contractedOffPeak) < 30) missing.push('mínimo geral de 30 kW em pelo menos um posto');
    }
    const eligible = s.mode !== 'B-optante' || bEligibility === 'compativel';
    if (missing.length) return { mode: s.mode, eligible, missing, energy: null, demand: null, excess: null, total: null };
    const energy = s.mode === 'B-optante'
      ? (study.netPeakKwh! + study.netOffPeakKwh!) * s.energyOffPeak!
      : study.netPeakKwh! * s.energyPeak! + study.netOffPeakKwh! * s.energyOffPeak!;
    const off = s.mode === 'B-optante' ? { base: 0, excess: 0 }
      : demandCost(s.mode === 'A-verde' ? Math.max(study.measuredPeakKw!, study.measuredOffPeakKw!) : study.measuredOffPeakKw!, s.contractedOffPeak!, s.demandOffPeak!);
    const peak = s.mode === 'A-azul' ? demandCost(study.measuredPeakKw!, s.contractedPeak!, s.demandPeak!) : { base: 0, excess: 0 };
    return { mode: s.mode, eligible, missing, energy: round(energy), demand: round(off.base + peak.base), excess: round(off.excess + peak.excess), total: round(energy + off.base + peak.base + off.excess + peak.excess + s.gdCharge! + s.otherCharges!) };
  });
  const complete = results.length === 3 && new Set(results.map(r => r.mode)).size === 3 && results.every(r => r.total !== null);
  const ranked = results.filter(r => r.eligible && r.total !== null).sort((a,b) => a.total! - b.total!);
  const tied = ranked.length > 1 && Math.abs(ranked[0].total! - ranked[1].total!) < 0.01;
  const best = complete && bEligibility !== 'pendente' && study.confirmed && study.tariffSource.trim() && !tied ? ranked[0]?.mode ?? null : null;
  return { bEligibility, warnings, results, best,
    conclusion: best ? `Menor custo mensal simulado: ${best}. Validar a modalidade disponível para a tensão de conexão e comparar 12 meses antes de contratar.`
      : tied ? 'Cenários empatados: não há uma modalidade de menor custo identificada.'
      : 'Recomendação econômica pendente. Preencha os três cenários, confirme a elegibilidade e confira os dados e a fonte das tarifas.' };
}
