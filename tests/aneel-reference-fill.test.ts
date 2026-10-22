import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {referenceBundles,fillReferenceBundles} from '../lib/aneel-reference-fill.ts';
import type {OfficialTariff} from '../lib/aneel-tariffs.ts';
import type {ConsultingStudy} from '../lib/tariff-consultancy.ts';
const rows=JSON.parse(readFileSync(new URL('./fixtures/aneel-equatorial-pa-a4-2026-07.json',import.meta.url),'utf8')) as OfficialTariff[];
const date='2026-07-31';
function study(){return {distributor:'EQUATORIAL PA',subgroup:'A4',reviewed:true,tariffs:(['verde','azul'] as const).map(mode=>({mode,peak:null,offPeak:null,intermediate:null,demandPeak:null,demandOffPeak:null,residualGd:null,source:'',date:'',verified:false}))} as ConsultingStudy;}
test('resposta real ANEEL A4 julho/2026 forma Verde e Azul completas e elimina duplicatas equivalentes',()=>{
 const bundles=referenceBundles(rows,date);assert.equal(bundles.length,2);
 const filled=fillReferenceBundles(study(),bundles);
 assert.equal(filled.tariffs[0].offPeak,0.42079);assert.equal(filled.tariffs[0].peak,3.02115);assert.equal(filled.tariffs[0].demandOffPeak,44.81);
 assert.equal(filled.tariffs[1].peak,0.59043);assert.equal(filled.tariffs[1].demandPeak,100.12);
 assert.equal(filled.tariffs[1].demandOffPeak,44.81);assert.equal(filled.tariffs[1].date,date);
 assert.match(filled.tariffs[1].source,/3.507/);assert.match(filled.tariffs[1].source,/604947/);assert.equal(filled.tariffs[1].verified,false);assert.equal(filled.reviewed,false);
});
test('não mistura nem substitui cenário existente, não aplica distribuidora ou subgrupo diferente',()=>{
 const s=study();s.tariffs[0].offPeak=0;s.tariffs[0].verified=true;
 const filled=fillReferenceBundles(s,referenceBundles(rows,date));assert.equal(filled.tariffs[0],s.tariffs[0]);assert.notEqual(filled.tariffs[1],s.tariffs[1]);
 assert.equal(fillReferenceBundles({...s,subgroup:'B-optante'},referenceBundles(rows,date)).tariffs[1],s.tariffs[1]);
 assert.equal(fillReferenceBundles({...s,distributor:'OUTRA'},referenceBundles(rows,date)).tariffs[1],s.tariffs[1]);
});
test('não escolhe menor tarifa em conflito, não completa tarifas APE, TUSD sem TE nem vigências distintas',()=>{
 const one=rows.find(r=>r.mode==='Verde'&&r.station==='Ponta')!;
 assert.deepEqual(referenceBundles(rows.map(r=>({...r,detail:'APE'})),date),[]);
 assert.deepEqual(referenceBundles(rows,'2027-01-01'),[]);
 assert.equal(referenceBundles([...rows,{...one,id:'conflict',total:one.total+1}],date).some(b=>b.mode==='verde'),false);
 assert.equal(referenceBundles(rows.map(r=>r.mode==='Verde'&&r.unit==='R$/kWh'?{...r,te:0}:r),date).some(b=>b.mode==='verde'),false);
 assert.equal(referenceBundles(rows.map(r=>r.id===one.id?{...r,start:'2026-02-01'}:r),date).some(b=>b.mode==='verde'),false);
 assert.equal(referenceBundles(rows.filter(r=>r.station!=='Ponta'),date).length,0);
});
