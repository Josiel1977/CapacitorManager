'use client';
import { useState } from 'react';
import { studyDemand, type DemandInput, type DemandMonth } from '@/lib/demand-study';
const money = (n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const labels = {current:'Contrato atual',economic:'Menor custo no histórico',margin:'Pico previsto + margem'};
const initial: DemandInput = {mode:'verde',months:[],contractedPeak:0,contractedOffPeak:0,tariffPeak:0,tariffOffPeak:0,minimumPeak:30,minimumOffPeak:30,growthPercent:0,marginPercent:10};
export default function DemandStudy() {
  const [input,setInput] = useState(initial);
  const [months,setMonths] = useState<DemandMonth[]>([{month:'',peak:null,offPeak:null}]);
  const [client,setClient] = useState('');
  const [source,setSource] = useState('');
  const [confirmed,setConfirmed] = useState(false);
  const [pdfError,setPdfError] = useState('');
  let result: ReturnType<typeof studyDemand> | null = null;
  let error = '';
  try { result = studyDemand({...input,months}); } catch(e) {error = e instanceof Error?e.message:'Dados inválidos';}
  function change(key:keyof DemandInput,value:number|string) {setInput(s=>({...s,[key]:value}));setConfirmed(false);}
  function row(index:number,key:keyof DemandMonth,value:string|number|null) {setMonths(rows=>rows.map((r,i)=>i===index?{...r,[key]:value}:r));setConfirmed(false);}
  const ready = result && confirmed && source.trim() && client.trim();
  async function pdf() {
    if (!ready || !result) return;
    setPdfError('');
    try {
      const {createEnergyDiagnosisPdf} = await import('@/lib/energy-diagnosis-pdf');
      const lines = ['ESTUDO DE DEMANDA CONTRATADA',`Cliente / UC: ${client}`,`Data: ${new Date().toLocaleDateString('pt-BR')} | Modalidade: ${input.mode}`,`Fonte e vigência das tarifas: ${source}`,`Período: ${[...months].sort((a,b)=>a.month.localeCompare(b.month))[0].month} a ${[...months].sort((a,b)=>a.month.localeCompare(b.month)).at(-1)!.month} (${result.months} meses)`, `Crescimento: ${input.growthPercent}% | Margem sobre o pico previsto: ${input.marginPercent}%`, `Tarifa única/fora de ponta: ${money(input.tariffOffPeak)}/kW | Ponta: ${input.mode==='azul'?money(input.tariffPeak)+'/kW':'não se aplica'}`,`Mínimo simulado único/fora de ponta: ${input.minimumOffPeak} kW; ponta: ${input.mode==='azul'?input.minimumPeak+' kW':'não se aplica'}`,'HISTÓRICO INFORMADO',...months.map(m=>`${m.month}: ponta ${m.peak} kW; fora de ponta ${m.offPeak} kW`),'COMPARAÇÃO',...result.scenarios.map(s=>`${labels[s.key]}: única/fora ${s.offPeak} kW${s.peak===null?'':`; ponta ${s.peak} kW`}. Total no período: ${money(s.total)}; ultrapassagem: ${money(s.excess)}; ocorrências por posto: ${s.breaches}.`),`Diferença atual menos menor custo: ${money(result.saving)} no período.`,'MEMÓRIA E LIMITES',...method];
      (await createEnergyDiagnosisPdf(lines)).save('Estudo-Demanda.pdf');
    } catch {setPdfError('Não foi possível gerar o PDF. Tente novamente.');}
  }
  return <section className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
    <h2 className="text-xl font-bold text-primary">Estudo de demanda contratada</h2>
    <p className="text-sm text-slate-600">Informe até 12 faturas da mesma UC. Use demanda máxima medida em kW, nunca consumo em kWh ou potência do transformador em kVA. Transcreva e confira os dados das faturas; o PDF da auditoria não preenche este histórico automaticamente.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <label>Cliente / UC<input className="mt-1 w-full rounded border p-2" value={client} onChange={e=>{setClient(e.target.value);setConfirmed(false);}}/></label>
      <label>Modalidade<select className="mt-1 w-full rounded border p-2" value={input.mode} onChange={e=>change('mode',e.target.value)}><option value="verde">Grupo A — Verde (demanda única)</option><option value="azul">Grupo A — Azul (por posto)</option></select></label>
      <label className="sm:col-span-2">Fonte, vigência e base tributária das tarifas<input className="mt-1 w-full rounded border p-2" value={source} onChange={e=>{setSource(e.target.value);setConfirmed(false);}} placeholder="Distribuidora, tabela/resolução, tensão, vigência e tributos"/></label>
      {([['contractedOffPeak',input.mode==='verde'?'Demanda única atual (kW)':'Contrato fora de ponta (kW)'],['tariffOffPeak','Tarifa demanda única/fora de ponta (R$/kW)'],['minimumOffPeak','Mínimo contratável único/fora de ponta (kW)'],...(input.mode==='azul'?[['contractedPeak','Contrato ponta (kW)'],['tariffPeak','Tarifa demanda ponta (R$/kW)'],['minimumPeak','Mínimo contratável ponta (kW)']]:[]),['growthPercent','Crescimento previsto da demanda (%)'],['marginPercent','Margem sobre o pico previsto (%)']] as [keyof DemandInput,string][]).map(([key,label])=><label key={key}>{label}<input className="mt-1 w-full rounded border p-2" type="number" min="0" step="any" value={Number.isNaN(input[key])?'':input[key] as number} onChange={e=>change(key,e.target.value===''?NaN:Number(e.target.value))}/></label>)}
    </div>
    <p className="text-sm text-slate-600">Grupo B não possui contratação de demanda neste modelo. Confirme os mínimos de cada posto com a distribuidora; 30 kW é apenas o valor inicial editável. Contratos sazonais, rurais, períodos de teste, descontos e regras especiais exigem análise própria.</p>
    <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="pb-2 text-left font-semibold">Histórico de demandas medidas</caption><thead><tr>{['Mês','Ponta (kW)','Fora de ponta (kW)','Ação'].map(h=><th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>{months.map((m,i)=><tr key={i}><td className="p-1"><input aria-label={`Mês ${i+1}`} className="w-full rounded border p-2" type="month" value={m.month} onChange={e=>row(i,'month',e.target.value)}/></td>{(['peak','offPeak'] as const).map(k=><td key={k} className="p-1"><input aria-label={`${k==='peak'?'Ponta':'Fora de ponta'} mês ${i+1}`} className="w-full min-w-24 rounded border p-2" type="number" min="0" step="any" value={m[k]??''} onChange={e=>row(i,k,e.target.value===''?null:Number(e.target.value))}/></td>)}<td><button type="button" className="p-2 underline" disabled={months.length===1} onClick={()=>{setMonths(ms=>ms.filter((_,j)=>j!==i));setConfirmed(false);}}>Remover</button></td></tr>)}</tbody></table></div>
    <button type="button" className="rounded border px-4 py-2 disabled:opacity-50" disabled={months.length>=12} onClick={()=>{setMonths(ms=>[...ms,{month:'',peak:null,offPeak:null}]);setConfirmed(false);}}>Adicionar mês</button>
    {error && <p role="status" className="text-sm text-amber-800">{error}</p>}
    {result && <><p className="rounded bg-amber-50 p-3 text-sm">{result.completeYear?'12 meses informados. Confira se representam o ciclo operacional e a sazonalidade.':'Estudo preliminar: menos de 12 meses. Complete um ciclo anual antes de decidir a contratação.'} A alternativa econômica pode admitir ultrapassagens; compare com a opção de margem.</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Cenário','Única / fora (kW)','Ponta (kW)','Custo no período','Ultrapassagem','Ocorrências por posto'].map(h=><th className="p-2 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{result.scenarios.map(s=><tr key={s.key} className="border-t"><th className="p-2 text-left">{labels[s.key]}</th><td>{s.offPeak}</td><td>{s.peak??'—'}</td><td>{money(s.total)}</td><td>{money(s.excess)}</td><td>{s.breaches}</td></tr>)}</tbody></table></div><p className="font-semibold">Diferença entre atual e menor custo: {money(result.saving)} em {result.months} meses.</p></>}
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Conferi UC, demandas medidas, mínimos, tarifas e premissas de crescimento.</label>
    <button type="button" disabled={!ready} onClick={pdf} className="rounded bg-primary px-4 py-2 text-white disabled:opacity-50">Baixar estudo em PDF</button>
    {pdfError && <p role="alert" className="text-red-700">{pdfError}</p>}
    <details className="text-sm text-slate-600"><summary className="cursor-pointer font-semibold">Memória de cálculo e limites</summary>{method.map(t=><p key={t} className="mt-2">{t}</p>)}</details>
  </section>;
}
const method = ['Custo mensal regular: maior entre demanda medida prevista e contratada, multiplicado pela tarifa. Se a medida superar 105% da contratada, soma-se 2 × tarifa × (medida - contratada), conforme modelo geral de consumo da REN ANEEL 1.000/2021, art. 301. A tolerância não representa capacidade adicional disponível.','Verde: maior demanda entre ponta e fora de ponta. Azul: cálculo independente por posto. A busca considera contratos em passos de 0,01 kW e mínimos informados; confirmar os incrementos permitidos pela distribuidora. Crescimento percentual incide sobre todo o histórico, igualmente nos três cenários. A margem incide sobre o maior pico já acrescido do crescimento.','A comparação cobre apenas demanda regular e ultrapassagem, com tarifas constantes na mesma base tributária. Não inclui energia, reativos, impostos adicionais ou alteração de modalidade. O contrato atual é mantido constante no período como cenário de referência; não representa auditoria das cobranças históricas efetivas.','Sem extrapolação anual automática. O menor custo histórico não garante custo futuro. Validar sazonalidade, novas cargas, capacidade da entrada e prazos/regras de alteração contratual antes de solicitar mudança. Dados desta tela permanecem apenas durante a sessão; baixe o PDF para conservar o estudo.'];
