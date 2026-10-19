import test from 'node:test';
import assert from 'node:assert/strict';
import {studyDemand,monthlyDemandCost,type DemandInput} from '../lib/demand-study.ts';
const input:DemandInput={mode:'verde',months:[{month:'2026-01',peak:80,offPeak:100}],contractedPeak:100,contractedOffPeak:150,tariffPeak:20,tariffOffPeak:10,minimumPeak:30,minimumOffPeak:30,growthPercent:0,marginPercent:10};
test('tolerância não isenta faturamento da demanda medida; ultrapassagem incide sobre excedente inteiro',()=>{
 assert.equal(monthlyDemandCost(105,100,10).total,1050);
 assert.equal(monthlyDemandCost(106,100,10).total,1180);
});
test('verde encontra limite econômico sem ultrapassagem e margem sobre pico',()=>{
 const r=studyDemand(input);
 assert.equal(r.scenarios[1].offPeak,100);
 assert.equal(r.scenarios[1].total,1000);
 assert.equal(r.scenarios[2].offPeak,110);
 assert.equal(r.saving,500);
 assert.equal(r.completeYear,false);
});
test('azul otimiza cada posto e aplica crescimento igualmente aos cenários',()=>{
 const r=studyDemand({...input,mode:'azul',growthPercent:20});
 assert.equal(r.scenarios[1].peak,96);
 assert.equal(r.scenarios[1].offPeak,120);
 assert.equal(r.scenarios[1].total,3120);
});
test('mínimos contratuais são respeitados mesmo quando contrato atual é inferior',()=>{
 const r=studyDemand({...input,minimumOffPeak:200});
 assert.equal(r.scenarios[1].offPeak,200);
 assert.equal(r.saving,-500);
});
test('rejeita dados ausentes, meses duplicados, negativos e não finitos',()=>{
 for(const value of [null,-1,NaN,Infinity]) assert.throws(()=>studyDemand({...input,months:[{month:'2026-01',peak:value,offPeak:100}]}));
 assert.throws(()=>studyDemand({...input,months:[...input.months,...input.months]}));
 assert.throws(()=>studyDemand({...input,tariffOffPeak:0}));
 assert.throws(()=>studyDemand({...input,months:[{month:'2026-13',peak:10,offPeak:10}]}));
});
test('otimização admite ultrapassagem isolada se reduzir custo no ciclo',()=>{
 const months=Array.from({length:12},(_,i)=>({month:`2026-${String(i+1).padStart(2,'0')}`,peak:50,offPeak:i===11?100:50}));
 const r=studyDemand({...input,months});
 assert.equal(r.scenarios[1].offPeak,50);
 assert.equal(r.scenarios[1].breaches,1);
 assert.equal(r.completeYear,true);
});
test('busca por pontos críticos coincide com varredura em centésimos de kW',()=>{
 for(const values of [[0.99,1.234,2.987],[2,2,2,4],[1.05,1.0501,1.1]]) {
  const study={...input,minimumOffPeak:1,tariffOffPeak:1,months:values.map((v,i)=>({month:`2026-0${i+1}`,peak:0,offPeak:v}))};
  const result=studyDemand(study);
  let best=Infinity;
  for(let c=100;c<=Math.ceil(Math.max(...values)*100);c++) best=Math.min(best,values.reduce((sum,v)=>sum+monthlyDemandCost(v,c/100,1).total,0));
  assert.ok(Math.abs(result.scenarios[1].total-Math.round(best*100)/100)<0.001);
 }
});
