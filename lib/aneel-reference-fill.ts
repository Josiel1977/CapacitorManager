import {ANEEL_DATASET,type OfficialTariff} from './aneel-tariffs.ts';
import type {ConsultingStudy,ConsultingTariff} from './tariff-consultancy.ts';
type Key='peak'|'offPeak'|'demandPeak'|'demandOffPeak';
export interface ReferenceBundle {mode:'verde'|'azul'; agent:string;subgroup:string;date:string;values:Partial<Record<Key,number>>;source:string;}
/** Only ordinary regulated references, complete and unambiguous. Never special APE/access tariffs. */
export function referenceBundles(rows:OfficialTariff[],date:string):ReferenceBundle[]{
 const ordinary=(r:OfficialTariff)=>[r.classification,r.subclass,r.detail,r.accessAgent].every(v=>v==='Não se aplica');
 const bundles:ReferenceBundle[]=[];
 for(const mode of ['verde','azul'] as const){
  const candidates=rows.filter(r=>r.mode.toLowerCase()===mode&&ordinary(r)&&r.start<=date&&r.end>=date&&/^A/.test(r.subgroup));
  const values:Partial<Record<Key,number>>={};const used:OfficialTariff[]=[];let conflict=false;
  for(const r of candidates){
   const p=r.station.toLowerCase();
   const key:Key|null=r.unit==='R$/kW'?(mode==='verde'&&p==='não se aplica'?'demandOffPeak':mode==='azul'?(p==='fora ponta'?'demandOffPeak':p==='ponta'?'demandPeak':null):null):p==='fora ponta'?'offPeak':p==='ponta'?'peak':null;
   if(!key)continue;
   const value=r.unit==='R$/kW'?r.tusd:r.total;
   if(!(value>0)||!Number.isFinite(value)||(r.unit==='R$/kWh'&&!(r.te>0))) {conflict=true;continue;}
   if(values[key]!==undefined&&Math.abs(values[key]!-value)>1e-9)conflict=true;
   values[key]=Number(value.toFixed(8));used.push(r);
  }
  const required:Key[]=mode==='verde'?['offPeak','peak','demandOffPeak']:['offPeak','peak','demandOffPeak','demandPeak'];
  if(conflict||!required.every(k=>values[k]!==undefined))continue;
  // Duplicates are harmless only within the exact same provenance and validity.
  if(new Set(used.map(r=>JSON.stringify([r.agent,r.cnpj,r.subgroup,r.start,r.end,r.resolution]))).size!==1)continue;
  const r=used[0];
  bundles.push({mode,agent:r.agent,subgroup:r.subgroup,date,values,source:`${ANEEL_DATASET} | Referência regulada comum, sem tributos; confirmar regime do cliente, classe e elegibilidade. Não representa contrato de compra de energia no mercado livre. | ${r.agent} CNPJ ${r.cnpj} | ${r.subgroup} ${mode} | ${r.resolution} | vigência ${r.start} a ${r.end} | registros ${used.map(x=>x.id).join(', ')} | geração ${[...new Set(used.map(x=>x.generated))].join(', ')} | referência ${date}`});
 }
 return bundles;
}
export function fillReferenceBundles(study:ConsultingStudy,bundles:ReferenceBundle[]):ConsultingStudy{
 let changed=false;
 const tariffs=study.tariffs.map(t=>{
  const b=bundles.find(b=>b.mode===t.mode&&study.subgroup===b.subgroup&&study.distributor.trim().toUpperCase()===b.agent.trim().toUpperCase());
  // Preserve the entire scenario if it already contains any tariff, source, or date.
  if(!b||t.source||t.date||(['offPeak','peak','intermediate','demandOffPeak','demandPeak'] as const).some(k=>t[k]!==null))return t;
  changed=true;return {...t,...b.values,date:b.date,source:b.source,verified:false} as ConsultingTariff;
 });
 return changed?{...study,tariffs,reviewed:false}:study;
}
