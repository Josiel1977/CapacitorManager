'use client';
import { useState } from 'react';
import {ANEEL_DATASET,type OfficialTariff} from '@/lib/aneel-tariffs';
import type {ConsultingTariff} from '@/lib/tariff-consultancy';
import {readJsonResponse} from '@/lib/http-json-response';
const inputClass='mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm';
export default function AneelTariffCatalog({onApply}:{onApply:(mode:ConsultingTariff['mode'],key:'peak'|'offPeak'|'intermediate'|'demandPeak'|'demandOffPeak',value:number,source:string,date:string,agent:string,subgroup:string)=>void}){
 const [agent,setAgent]=useState('');const [agents,setAgents]=useState<string[]>([]);const [subgroup,setSubgroup]=useState('A4');const [date,setDate]=useState(new Date().toISOString().slice(0,10));
 const [rows,setRows]=useState<OfficialTariff[]>([]);const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [consulted,setConsulted]=useState('');
 async function load(list=false){setLoading(true);setError('');setRows([]);setConsulted('');try{
  const query=list?'agents=1':new URLSearchParams({agent,subgroup,date}).toString();
  const data=await readJsonResponse<{agents?:string[];tariffs?:OfficialTariff[];consultedAt?:string;rejected?:number}>(await fetch(`/api/tarifas-aneel?${query}`,{signal:AbortSignal.timeout(35000)}),'Falha ao consultar ANEEL.');
  if(list)setAgents(data.agents??[]);else {setRows(data.tariffs??[]);setConsulted(data.consultedAt??'');if(data.rejected)setError(`${data.rejected} registros com formato não suportado foram excluídos. Confira a fonte antes de selecionar.`);}
 }catch(e){setError(e instanceof Error?e.message:'Consulta indisponível.');}finally{setLoading(false);}}
 function selection(r:OfficialTariff){
  const m=r.mode.toLowerCase(),p=r.station.toLowerCase();
  const mode:ConsultingTariff['mode']|null=m==='verde'?'verde':m==='azul'?'azul':m==='branca'?'branca':m.includes('convencional')?'convencional':null;
  if(!mode)return null;
  const key=r.unit==='R$/kW'?(mode==='verde'?'demandOffPeak':mode==='azul'?(p.includes('fora')?'demandOffPeak':p==='ponta'?'demandPeak':null):null):mode==='convencional'?'offPeak':p.includes('fora')?'offPeak':p==='ponta'?'peak':p.includes('intermedi')?'intermediate':null;
  return key?{mode,key:key as 'peak'|'offPeak'|'intermediate'|'demandPeak'|'demandOffPeak'}:null;
 }
 return <details className="rounded-xl border border-blue-200 bg-blue-50/50 p-4"><summary className="cursor-pointer font-semibold text-primary">Consultar tarifas oficiais da ANEEL</summary><div className="mt-4 space-y-4">
 <p className="text-sm">Catálogo nacional das distribuidoras presentes na base oficial. Valores sem tributos; confira classe, subclasse, detalhe, acessante e vigência. Selecionar uma linha não confirma elegibilidade nem preenche outras linhas automaticamente.</p>
 <div className="grid gap-3 sm:grid-cols-3"><label>Distribuidora<input disabled={loading} list="aneel-agents" className={inputClass} value={agent} onChange={e=>{setAgent(e.target.value);setRows([]);}} placeholder="Sigla oficial, ex.: Equatorial PA"/><datalist id="aneel-agents">{agents.map(a=><option key={a} value={a}/>)}</datalist></label><label>Subgrupo<select disabled={loading} className={inputClass} value={subgroup} onChange={e=>{setSubgroup(e.target.value);setRows([]);}}>{['A1','A2','A3','A3a','A4','AS','B1','B2','B3','B4a','B4b'].map(v=><option key={v}>{v}</option>)}</select></label><label>Data de referência<input disabled={loading} type="date" className={inputClass} value={date} onChange={e=>{setDate(e.target.value);setRows([]);}}/></label></div>
 <div className="flex flex-wrap gap-3"><button type="button" disabled={loading} className="rounded border px-3 py-2 disabled:opacity-50" onClick={()=>load(true)}>Carregar lista de distribuidoras</button><button type="button" disabled={loading||!agent||!date} className="rounded bg-primary px-3 py-2 text-white disabled:opacity-50" onClick={()=>load()}>{loading?'Consultando…':'Buscar tarifas'}</button></div>
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{consulted&&<p className="text-xs">Consulta: {consulted}. Cache de até 24 horas. {rows.length} registros. {rows.length===0?'Nenhuma tarifa aplicável encontrada; confirme os filtros.':''}</p>}
 {!!rows.length&&<div className="max-h-96 overflow-auto"><table className="w-full text-xs"><thead><tr>{['Modalidade / posto','Classe / detalhe','TE + TUSD','Vigência / resolução','Ação'].map(v=><th key={v} className="p-2 text-left">{v}</th>)}</tr></thead><tbody>{rows.map(r=>{const target=selection(r);return <tr key={r.id} className="border-t"><td className="p-2">{r.agent} / {r.subgroup}<br/>{r.mode} / {r.station}<br/>{r.unit}</td><td className="p-2">{r.classification} / {r.subclass}<br/>{r.detail}<br/>Acessante: {r.accessAgent}</td><td className="p-2">{r.unit==='R$/kW'?r.tusd.toFixed(5):r.total.toFixed(6)}<br/>TE {r.te.toFixed(6)}<br/>TUSD {r.tusd.toFixed(6)}</td><td className="p-2">{r.start} a {r.end}<br/>{r.resolution}<br/>Base gerada: {r.generated}</td><td className="p-2">{target&&<button type="button" className="rounded border bg-white p-2" onClick={()=>onApply(target.mode,target.key,r.unit==='R$/kW'?r.tusd:r.total,`${ANEEL_DATASET} | registro ${r.id} | ${r.agent} CNPJ ${r.cnpj} | ${r.subgroup} ${r.mode} ${r.station} | ${r.classification}/${r.subclass}/${r.detail} | acessante ${r.accessAgent} | ${r.resolution} | vigência ${r.start} a ${r.end} | geração ${r.generated} | consulta ${consulted}`,date,r.agent,r.subgroup)}>Usar nesta modalidade</button>}</td></tr>;})}</tbody></table></div>}
 <a className="text-sm underline" href={ANEEL_DATASET} target="_blank" rel="noreferrer">Abrir fonte oficial e resolução aplicável</a>
 </div></details>;
}
