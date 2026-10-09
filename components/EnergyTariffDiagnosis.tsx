'use client';
import { useState } from 'react';
import { diagnoseEnergyTariffs, type EnergyStudy, type TariffScenario, type Mode } from '@/lib/energy-tariff-diagnosis';
import { buildEnergyDiagnosisReport } from '@/lib/energy-diagnosis-report';
import type { InvoiceAuditResult } from '@/lib/invoice-audit-result';
const money = (n: number | null) => n === null ? 'Pendente' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const modes: Mode[] = ['B-optante', 'A-verde', 'A-azul'];
const newScenario = (mode: Mode): TariffScenario => ({mode, energyPeak:null, energyOffPeak:null, demandPeak:null, demandOffPeak:null, contractedPeak:null, contractedOffPeak:null, gdCharge:null, otherCharges:null});
const initial: EnergyStudy = {currentKva:null,futureKva:null,sameUnit:null,solarLocal:null,remoteCredits:null,netPeakKwh:null,netOffPeakKwh:null,measuredPeakKw:null,measuredOffPeakKw:null,confirmed:false,tariffSource:'',scenarios:modes.map(newScenario)};
export default function EnergyTariffDiagnosis({ invoice }: { invoice?: InvoiceAuditResult }) {
  const [study,setStudy] = useState<EnergyStudy>(initial);
  const [client,setClient] = useState(invoice?.detalhes_fatura?.cliente ? `${invoice.detalhes_fatura.cliente} / UC ${invoice.detalhes_fatura.unidade_consumidora ?? 'não identificada'}` : '');
  const [notes,setNotes] = useState('');
  const [saved,setSaved] = useState('');
  const [generating,setGenerating] = useState(false);
  const [pdfError,setPdfError] = useState('');
  const result = diagnoseEnergyTariffs(study);
  const context = invoice?.contexto_energetico;
  const reportLines = buildEnergyDiagnosisReport({client,notes,study,invoice,diagnosis:result,date:new Date().toLocaleDateString('pt-BR')});
  async function downloadReport() {
    setGenerating(true); setPdfError('');
    try {
      const { createEnergyDiagnosisPdf } = await import('@/lib/energy-diagnosis-pdf');
      const pdf = await createEnergyDiagnosisPdf(reportLines);
      pdf.save('Diagnostico-Energetico.pdf');
      setSaved('PDF gerado. Verifique os downloads do navegador.');
    } catch {
      setPdfError('Não foi possível gerar o PDF. Tente novamente ou use Imprimir relatório.');
    } finally { setGenerating(false); }
  }
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
      <div className="flex flex-wrap gap-3"><button type="button" disabled={generating || !invoice} className="rounded bg-primary px-4 py-2 text-white disabled:opacity-50" onClick={downloadReport}>{generating ? 'Gerando PDF…' : 'Gerar e baixar relatório PDF'}</button><button type="button" className="rounded border px-4 py-2" onClick={()=>window.print()}>Imprimir relatório</button></div>
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
      <div className="flex flex-wrap gap-3"><button type="button" className="rounded border px-4 py-2" onClick={save}>Salvar rascunho neste navegador</button><button type="button" className="rounded border px-4 py-2" onClick={restore}>Restaurar rascunho</button></div>{pdfError && <p role="alert" className="text-sm text-red-700">{pdfError}</p>}{!invoice && <p className="text-sm">Analise uma fatura para gerar o PDF com os dados identificados.</p>}{saved && <p role="status" className="text-sm">{saved}</p>}
    </div>
    <article id="energy-diagnosis-report" className="space-y-3 border-t pt-5">
      {reportLines.map((line,index) => !line ? <div key={index} className="h-2"/> : line === line.toLocaleUpperCase('pt-BR') ? <h3 key={index} className="font-bold text-primary">{line}</h3> : <p key={index} className="whitespace-pre-wrap text-sm">{line}</p>)}
    </article>
    <style>{`@media print { body * { visibility: hidden; } #energy-diagnosis-report, #energy-diagnosis-report * { visibility: visible; } #energy-diagnosis-report { position: absolute; left: 0; top: 0; width: 100%; padding: 12mm; background: white; color: black; font-size: 10pt; } .energy-controls { display: none; } #energy-diagnosis-report table { font-size: 9pt; } #energy-diagnosis-report tr { break-inside: avoid; } }`}</style>
  </section>;
}
function Numeric({label,value,onChange}:{label:string;value:number|null;onChange:(v:number|null)=>void}) {return <label className="block text-sm">{label}<input className="mt-1 w-full rounded border p-2" type="number" min="0" step="any" value={value??''} onChange={e=>onChange(e.target.value===''?null:Number(e.target.value))}/></label>;}
function Choice({label,value,onChange}:{label:string;value:boolean|null;onChange:(v:boolean|null)=>void}) {return <label className="block text-sm">{label}<select className="mt-1 w-full rounded border p-2" value={value===null?'':value?'yes':'no'} onChange={e=>onChange(e.target.value===''?null:e.target.value==='yes')}><option value="">A confirmar</option><option value="yes">Sim</option><option value="no">Não</option></select></label>;}
