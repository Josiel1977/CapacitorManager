export interface DemandMonth { month: string; peak: number | null; offPeak: number | null }
export interface DemandInput {
  mode: 'verde' | 'azul'; months: DemandMonth[];
  contractedPeak: number; contractedOffPeak: number;
  tariffPeak: number; tariffOffPeak: number;
  minimumPeak: number; minimumOffPeak: number;
  growthPercent: number; marginPercent: number;
}
const valid = (v: number) => Number.isFinite(v) && v >= 0;
const cents = (v: number) => Math.round(v * 100) / 100;
const up = (v: number) => Math.ceil((v - 1e-9) * 100) / 100;
export function monthlyDemandCost(measured: number, contracted: number, tariff: number) {
  const base = Math.max(measured, contracted) * tariff;
  const excess = measured - contracted * 1.05 > 1e-9 ? (measured - contracted) * 2 * tariff : 0;
  return { base, excess, total: base + excess };
}
function evaluate(values: number[], contract: number, tariff: number) {
  const rows = values.map(v => monthlyDemandCost(v, contract, tariff));
  return { contract, total: rows.reduce((s,r)=>s+r.total,0), excess: rows.reduce((s,r)=>s+r.excess,0), breaches: rows.filter(r=>r.excess>0).length };
}
function optimize(values: number[], tariff: number, minimum: number, current: number, margin: number) {
  // Cost is piecewise linear; minima occur at the floor, measured demand or the 5% threshold.
  const candidates = [...new Set([up(minimum), ...values.flatMap(v=>[v,v/1.05].flatMap(b=>[up(Math.max(minimum,b)),Math.max(up(minimum),Math.floor(b*100)/100)]))])];
  const economic = candidates.map(c=>evaluate(values,c,tariff)).sort((a,b)=>a.total-b.total || a.breaches-b.breaches || b.contract-a.contract)[0];
  return { current: evaluate(values,current,tariff), economic, margin: evaluate(values,up(Math.max(minimum,Math.max(...values)*(1+margin/100))),tariff) };
}
export function studyDemand(input: DemandInput) {
  if (!['verde','azul'].includes(input.mode)) throw new Error('Modalidade inválida.');
  const numbers = [input.contractedOffPeak,input.tariffOffPeak,input.minimumOffPeak,input.growthPercent,input.marginPercent,...(input.mode==='azul'?[input.contractedPeak,input.tariffPeak,input.minimumPeak]:[])];
  if (numbers.some(v=>!valid(v)) || input.contractedOffPeak<=0 || input.tariffOffPeak<=0 || input.minimumOffPeak<=0 || (input.mode==='azul' && (input.contractedPeak<=0 || input.tariffPeak<=0 || input.minimumPeak<=0))) throw new Error('Preencha contratos, tarifas e mínimos positivos; crescimento e margem não podem ser negativos.');
  if (!input.months.length || input.months.length>12) throw new Error('Informe de 1 a 12 meses.');
  const seen = new Set<string>();
  for (const row of input.months) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month) || seen.has(row.month)) throw new Error('Informe meses válidos, sem duplicidade.');
    seen.add(row.month);
    if (row.peak===null || row.offPeak===null || !valid(row.peak) || !valid(row.offPeak)) throw new Error('Preencha as demandas medidas de cada mês, inclusive zero quando confirmado.');
  }
  const factor = 1+input.growthPercent/100;
  const offValues = input.months.map(r=>(input.mode==='verde'?Math.max(r.peak!,r.offPeak!):r.offPeak!)*factor);
  const off = optimize(offValues,input.tariffOffPeak,input.minimumOffPeak,input.contractedOffPeak,input.marginPercent);
  const peak = input.mode==='azul'?optimize(input.months.map(r=>r.peak!*factor),input.tariffPeak,input.minimumPeak,input.contractedPeak,input.marginPercent):null;
  const scenarios = (['current','economic','margin'] as const).map(key=>({key,offPeak:off[key].contract,peak:peak?.[key].contract??null,total:cents(off[key].total+(peak?.[key].total??0)),excess:cents(off[key].excess+(peak?.[key].excess??0)),breaches:off[key].breaches+(peak?.[key].breaches??0)}));
  if (scenarios.some(s=>!Number.isFinite(s.total))) throw new Error('Valores excedem o limite de cálculo.');
  const dates=input.months.map(m=>m.month).sort();
  const serial=(m:string)=>Number(m.slice(0,4))*12+Number(m.slice(5));
  const completeYear=dates.length===12&&dates.every((m,i)=>i===0||serial(m)-serial(dates[i-1])===1);
  return { scenarios, months:input.months.length, saving:cents(scenarios[0].total-scenarios[1].total), completeYear };
}
