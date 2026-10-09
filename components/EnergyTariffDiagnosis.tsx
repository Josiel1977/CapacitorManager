'use client';
import { useState } from 'react';
import { diagnoseEnergyTariffs, type EnergyStudy, type TariffScenario, type Mode } from '@/lib/energy-tariff-diagnosis';
import type { InvoiceAuditResult } from '@/lib/invoice-audit-result';
const money = (n: number | null) => n === null ? 'Pendente' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const modes: Mode[] = ['B-optante', 'A-verde', 'A-azul'];
const newScenario = (mode: Mode): TariffScenario => ({mode, energyPeak:null, energyOffPeak:null, demandPeak:null, demandOffPeak:null, contractedPeak:null, contractedOffPeak:null, gdCharge:null, otherCharges:null});
const initial: EnergyStudy = {currentKva:null,futureKva:null,sameUnit:null,solarLocal:null,remoteCredits:null,netPeakKwh:null,netOffPeakKwh:null,measuredPeakKw:null,measuredOffPeakKw:null,confirmed:false,tariffSource:'',scenarios:modes.map(newScenario)};
export default function EnergyTariffDiagnosis({ invoice }: { invoice?: InvoiceAuditResult }) {
  const [study,setStudy] = useState<EnergyStudy>(initial);
  const [client,setClient] = useState('');
  const [notes,setNotes] = useState('');
  const [saved,setSaved] = useState('');
  const result = diagnoseEnergyTariffs(study);
  const context = invoice?.contexto_energetico;
  function field(key: keyof EnergyStudy, value: unknown) { setStudy(old => ({...old,[key]:value,confirmed:false})); }
  function scenario(index: number, key: keyof TariffScenario, value: number | null) {
    setStudy(old=>({...old,confirmed:false,scenarios:old.scenarios.map((s,i)=>i===index?{...s,[key]:value}:s)}));
  }
  function save() {
    try { localStorage.setItem('cm-energy-study-v1',JSON.stringify({study,client,notes})); setSaved('Rascunho salvo neste navegador.'); }
    catch { setSaved('Não foi possível salvar o rascunho neste navegador.'); }
  }
  function restore() {
    try {
      const raw = localStorage.getItem('cm-energy-study-v1'); if (!raw) {setSaved('Nenhum rascunho salvo.');return;}
      const data = JSON.parse(raw);
      if (!data.study || !Array.isArray(data.study.scenarios) || data.study.scenarios.length!==3 || data.study.scenarios.some((s: TariffScenario,i:number)=>s.mode!==modes[i])) throw new Error();
      const numericKeys = ['currentKva','futureKva','netPeakKwh','netOffPeakKwh','measuredPeakKw','measuredOffPeakKw'];
      if (numericKeys.some(k=>data.study[k]!==null && (typeof data.study[k]!=='number' || !Number.isFinite(data.study[k]) || data.study[k]<0))) throw new Error();
      if (['sameUnit','solarLocal','remoteCredits'].some(k=>data.study[k]!==null && typeof data.study[k]!=='boolean')) throw new Error();
      if (data.study.scenarios.some((s:TariffScenario)=>Object.entries(s).some(([k,v])=>k!=='mode' && v!==null && (typeof v!=='number' || !Number.isFinite(v) || v<0)))) throw new Error();
      if(typeof data.study.tariffSource!=='string' || typeof data.client!=='string' || typeof data.notes!=='string') throw new Error();
      setStudy({...data.study,confirmed:false});setClient(data.client);setNotes(data.notes);setSaved('Rascunho restaurado. Confira os dados e as tarifas novamente.');
    } catch {setSaved('Rascunho inválido ou indisponível.');}
  }
  return <section className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
    <div className="energy-controls space-y-5">
      <div><h2 className="text-xl font-bold text-primary">Diagnóstico solar e comparação tarifária</h2><p className="text-sm text-slate-600">Compare o cenário atual e a ampliação. Campos vazios significam dados ausentes; informe zero somente quando confirmado.</p></div>
      <label className="block text-sm">Cliente / unidade consumidora<input className="mt-1 w-full rounded border p-2" value={client} onChange={e=>setClient(e.target.value)}/></label>
      {context && <div className="rounded bg-blue-50 p-3 text-sm"><p>Identificado no PDF: {context.b_optante?'B-optante':'enquadramento a confirmar'} · {context.gd2?'GD2':'regime GD a confirmar'}.</p><p>Compensação: {context.energia_compensada_kwh.toLocaleString('pt-BR')} kWh · dívida/atrasos: {money(context.divida_e_atrasos)}.</p><button type="button" className="mt-2 font-bold underline" onClick={()=>{setNotes(`Fatura ${invoice?.mesReferencia}: consumo faturado após compensação ${invoice?.consumoKwh} kWh; compensação ${context.energia_compensada_kwh} kWh; cobrança reativa ${money(invoice?.totalMultas??null)}; dívida/atrasos ${money(context.divida_e_atrasos)}. Confirmar divisão do consumo líquido por posto para simular grupo A.`);setStudy(s=>({...s,netPeakKwh:null,netOffPeakKwh:null,confirmed:false}));}}>Usar dados da fatura nas observações</button><p className="mt-1">A fatura monômia não identifica consumo e demanda por posto. Preencha com medições; não atribuímos tudo a fora de ponta.</p></div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Numeric label="Transformadores atuais nesta UC (kVA)" value={study.currentKva} onChange={v=>field('currentKva',v)}/>
        <Numeric label="Total previsto nesta UC, incluindo os atuais (kVA)" value={study.futureKva} onChange={v=>field('futureKva',v)}/>
        <Choice label="Todos no mesmo ponto de medição / UC?" value={study.sameUnit} onChange={v=>field('sameUnit',v)}/>
        <Choice label="A geração solar está nesta UC?" value={study.solarLocal} onChange={v=>field('solarLocal',v)}/>
        <Choice label="Envia ou recebe créditos de outras UCs?" value={study.remoteCredits} onChange={v=>field('remoteCredits',v)}/>
      </div>
      <p className="text-sm text-slate-600">Referência: art. 11 da Lei 14.300 e art. 292 da REN 1.000. Limite geral de 112,5 kVA para B-optante com SCEE; confirmar regras aplicáveis e eventuais condições específicas com a distribuidora. kVA do transformador não é demanda contratada em kW.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Numeric label="Consumo líquido faturável na ponta (kWh/mês)" value={study.netPeakKwh} onChange={v=>field('netPeakKwh',v)}/>
        <Numeric label="Consumo líquido faturável fora de ponta (kWh/mês)" value={study.netOffPeakKwh} onChange={v=>field('netOffPeakKwh',v)}/>
        <Numeric label="Demanda máxima medida na ponta (kW)" value={study.measuredPeakKw} onChange={v=>field('measuredPeakKw',v)}/>
        <Numeric label="Demanda máxima medida fora de ponta (kW)" value={study.measuredOffPeakKw} onChange={v=>field('measuredOffPeakKw',v)}/>
      </div>
      <p className="text-sm text-slate-600">Use o mesmo mês e as mesmas cargas em todos os cenários. Consumo líquido após compensação por posto deve considerar as regras e conversões de créditos. Este simulador não calcula automaticamente o SCEE. Para ampliação, use uma previsão documentada das cargas novas.</p>
      <label className="block text-sm">Fonte, vigência e tensão das tarifas<input className="mt-1 w-full rounded border p-2" placeholder="Distribuidora, resolução/tabela, vigência, tensão e tributos" value={study.tariffSource} onChange={e=>field('tariffSource',e.target.value)}/></label>
      <p className="text-sm text-slate-600">Informe TE + TUSD de energia e tarifas de demanda com tributos na mesma base. Em encargos GD, inclua o custo residual da compensação de cada modalidade; em demais custos, CIP, bandeiras, reativo e outros itens recorrentes. Exclua parcelamentos, multa e juros. Não some novamente tributos já incluídos.</p>
      <div className="grid gap-4 lg:grid-cols-3">{study.scenarios.map((s,i)=><fieldset key={s.mode} className="space-y-3 rounded-xl border p-4"><legend className="px-1 font-bold">{s.mode}</legend>
        <Numeric label={s.mode==='B-optante'?'Energia monômia (R$/kWh)':'Energia fora de ponta (R$/kWh)'} value={s.energyOffPeak} onChange={v=>scenario(i,'energyOffPeak',v)}/>
        {s.mode!=='B-optante' && <><Numeric label="Energia ponta (R$/kWh)" value={s.energyPeak} onChange={v=>scenario(i,'energyPeak',v)}/><Numeric label={s.mode==='A-verde'?'Demanda única contratada (kW)':'Demanda fora de ponta contratada (kW)'} value={s.contractedOffPeak} onChange={v=>scenario(i,'contractedOffPeak',v)}/><Numeric label="Tarifa demanda (R$/kW)" value={s.demandOffPeak} onChange={v=>scenario(i,'demandOffPeak',v)}/></>}
        {s.mode==='A-azul' && <><Numeric label="Demanda ponta contratada (kW)" value={s.contractedPeak} onChange={v=>scenario(i,'contractedPeak',v)}/><Numeric label="Tarifa demanda ponta (R$/kW)" value={s.demandPeak} onChange={v=>scenario(i,'demandPeak',v)}/></>}
        <Numeric label="Encargos GD residuais (R$/mês)" value={s.gdCharge} onChange={v=>scenario(i,'gdCharge',v)}/><Numeric label="Demais custos recorrentes (R$/mês)" value={s.otherCharges} onChange={v=>scenario(i,'otherCharges',v)}/>
      </fieldset>)}</div>
      <label className="block text-sm">Geração dos inversores, cargas previstas, medições e recomendações<textarea className="mt-1 min-h-24 w-full rounded border p-2" value={notes} onChange={e=>setNotes(e.target.value)}/></label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={study.confirmed} onChange={e=>setStudy(s=>({...s,confirmed:e.target.checked}))}/>Conferi os dados, a compensação por posto, os custos GD, os tributos e a disponibilidade das modalidades para esta conexão.</label>
      <div className="flex flex-wrap gap-3"><button type="button" className="rounded bg-primary px-4 py-2 text-white" onClick={()=>window.print()}>Imprimir / salvar relatório em PDF</button><button type="button" className="rounded border px-4 py-2" onClick={save}>Salvar rascunho neste navegador</button><button type="button" className="rounded border px-4 py-2" onClick={restore}>Restaurar rascunho</button></div>{saved && <p role="status" className="text-sm">{saved}</p>}
    </div>
    <article id="energy-diagnosis-report" className="space-y-4 border-t pt-5">
      <h2 className="text-xl font-bold">Relatório de diagnóstico energético — Capacitor Manager</h2>
      <p>{client || 'Cliente não informado'} · Emitido em {new Date().toLocaleDateString('pt-BR')} · Simulação de um mês; não é garantia de economia.</p>
      <p>Transformadores: atual {study.currentKva??'pendente'} kVA; previsto {study.futureKva??'pendente'} kVA. B-optante com SCEE no cenário previsto: <strong>{result.bEligibility==='compativel'?'compatível com critérios informados, sujeito à confirmação':result.bEligibility==='incompativel'?'incompatível com critérios gerais':'pendente'}</strong>.</p>
      {invoice && <p>Fatura {invoice.mesReferencia}: total {money(invoice.valorTotalFatura)}; reativo {money(invoice.totalMultas)}; dívida/atrasos {money(context?.divida_e_atrasos??null)}; total sem dívida/atrasos {money(context && context.divida_e_atrasos<=invoice.valorTotalFatura?invoice.valorTotalFatura-context.divida_e_atrasos:null)}. Compensação solar: {context?.energia_compensada_kwh??'pendente'} kWh (não equivale à geração total).</p>}
      <p>Consumo líquido ponta / fora: {study.netPeakKwh??'pendente'} / {study.netOffPeakKwh??'pendente'} kWh. Demanda medida ponta / fora: {study.measuredPeakKw??'pendente'} / {study.measuredOffPeakKw??'pendente'} kW.</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Modalidade','Energia','Demanda','Ultrapassagem','Total mensal'].map(h=><th className="border-b p-2" key={h}>{h}</th>)}</tr></thead><tbody>{result.results.map(r=><tr key={r.mode}><td className="border-b p-2">{r.mode}{!r.eligible?' (elegibilidade não confirmada)':''}</td><td className="border-b p-2">{money(r.energy)}</td><td className="border-b p-2">{money(r.demand)}</td><td className="border-b p-2">{money(r.excess)}</td><td className="border-b p-2 font-bold">{money(r.total)}</td></tr>)}</tbody></table></div>
      <p className="rounded bg-amber-50 p-3 font-semibold">{result.conclusion}</p>
      {result.results.filter(r=>r.missing.length).map(r=><p className="text-sm" key={r.mode}>Pendências {r.mode}: {r.missing.join('; ')}.</p>)}
      <ul className="list-disc space-y-1 pl-5 text-sm">{result.warnings.map(w=><li key={w}>{w}</li>)}<li>Solicitar 12 faturas, geração dos inversores, projeto homologado, placa dos transformadores e memória de massa por posto. Medir fator de potência e harmônicas antes de especificar capacitores.</li></ul>
      <p className="whitespace-pre-wrap text-sm">Observações: {notes || 'Não informadas.'}</p>
      <p className="text-sm">Fonte das tarifas: {study.tariffSource || 'Não informada'}. Dados conferidos: {study.confirmed?'sim':'não'}.</p>
      <details open className="text-xs"><summary className="font-bold">Premissas auditáveis da simulação</summary>{study.scenarios.map(s=><p key={s.mode}>{s.mode}: energia ponta/fora {s.energyPeak??'—'} / {s.energyOffPeak??'—'} R$/kWh; demanda contratada ponta/fora {s.contractedPeak??'—'} / {s.contractedOffPeak??'—'} kW; tarifa demanda ponta/fora {s.demandPeak??'—'} / {s.demandOffPeak??'—'} R$/kW; GD {money(s.gdCharge)}; demais custos {money(s.otherCharges)}.</p>)}<p>Demanda faturada: maior entre medida e contratada; verde usa maior demanda entre os postos. Ultrapassagem acima de 5%: adicional de duas vezes a tarifa de demanda sobre o excedente. Modelo geral, sem contratos especiais. B-optante é contrafactual se inelegível. Valores anuais e retorno exigem estudo de 12 ciclos e investimento de adequação.</p><p>Referências: Lei 14.300/2022, art. 11; REN ANEEL 1.000/2021, arts. 292 e 301. Conferir a versão vigente e as condições da distribuidora.</p></details>
    </article>
    <style>{`@media print { body * { visibility: hidden; } #energy-diagnosis-report, #energy-diagnosis-report * { visibility: visible; } #energy-diagnosis-report { position: absolute; left: 0; top: 0; width: 100%; padding: 12mm; background: white; color: black; font-size: 10pt; } .energy-controls { display: none; } #energy-diagnosis-report table { font-size: 9pt; } #energy-diagnosis-report tr { break-inside: avoid; } }`}</style>
  </section>;
}
function Numeric({label,value,onChange}:{label:string;value:number|null;onChange:(v:number|null)=>void}) {return <label className="block text-sm">{label}<input className="mt-1 w-full rounded border p-2" type="number" min="0" step="any" value={value??''} onChange={e=>onChange(e.target.value===''?null:Number(e.target.value))}/></label>;}
function Choice({label,value,onChange}:{label:string;value:boolean|null;onChange:(v:boolean|null)=>void}) {return <label className="block text-sm">{label}<select className="mt-1 w-full rounded border p-2" value={value===null?'':value?'yes':'no'} onChange={e=>onChange(e.target.value===''?null:e.target.value==='yes')}><option value="">A confirmar</option><option value="yes">Sim</option><option value="no">Não</option></select></label>;}
