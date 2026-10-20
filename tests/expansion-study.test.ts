import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeExpansion,expansionReport,newExpansionStudy,newExpansionLoad,parseExpansionStudy,type ExpansionStudy} from '../lib/expansion-study.ts';
function example():ExpansionStudy {
 return {...newExpansionStudy(),client:'Exemplo sintético',connection:'b-optante',sameUnit:true,scee:true,localGeneration:true,remoteCredits:false,currentKva:112.5,currentCount:1,installedKw:70,measuredKw:50,baselinePf:1,measurementSource:'Campanha bruta em todos os circuitos, exemplo',grossPeakConfirmed:true,growth:0,margin:0,loading:100,verified:true,arrangement:'single-outdoor',loads:[{...newExpansionLoad(),name:'Máquina',quantity:1,power:20,unit:'input-kw',powerFactor:1}]};
}
const near=(a:number|null,b:number)=>assert.ok(a!==null&&Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('112,5 kVA existentes não oferecem espaço regulatório para outro trafo no B-optante SCEE',()=>{
 const s=example();s.action='add';s.proposedKva=112.5;s.proposedCount=1;s.arrangement='multiple-poles';
 const r=analyzeExpansion(s);assert.equal(r.futureKva,225);assert.equal(r.eligibility,'outside');near(r.requiredKva,70);assert.equal(r.capacityAdequate,true);assert.match(r.metering,/6\.8\.8/);
});
test('mantém transformação existente quando a carga cabe, sem prometer enquadramento ou compra',()=>{
 const r=analyzeExpansion(example());near(r.requiredKva,70);assert.equal(r.eligibility,'within');assert.equal(r.fitsBOptante,true);assert.ok(r.guidance.some(text=>/manter a transformação atual/.test(text)));assert.match(r.metering,/Não há garantia/);
});
test('não sugere reduzir trafo para caber no teto quando a necessidade supera 112,5 kVA',()=>{
 const s=example();s.loads[0].power=80;const r=analyzeExpansion(s);
 near(r.requiredKva,130);assert.equal(r.reference,150);assert.equal(r.fitsBOptante,false);assert.equal(r.capacityAdequate,false);assert.ok(r.guidance.some(text=>/Não foi encontrada solução/.test(text)));
});
test('converte potência mecânica com rendimento e soma vetorialmente P/Q',()=>{
 const s=example();s.measuredKw=0;s.loads=[{...s.loads[0],power:10,unit:'shaft-kw',efficiency:0.8,powerFactor:0.8}];
 const r=analyzeExpansion(s);near(r.installedNew,12.5);near(r.peak!.p,12.5);near(r.peak!.q,9.375);near(r.peak!.kva,15.625);
 s.loads[0].unit='cv';s.loads[0].power=10;near(analyzeExpansion(s).installedNew,10*0.73549875/0.8);
});
test('horários não sobrepostos reduzem pico modelado, mas não carga instalada nem limite BT',()=>{
 const s=example();s.connection='bt';s.scee=false;s.measuredKw=0;s.installedKw=10;s.loads=[{...s.loads[0],power:40,start:0,end:12},{...s.loads[0],power:40,start:12,end:24}];
 const r=analyzeExpansion(s);near(r.installedTotal,90);near(r.peak!.p,40);assert.equal(r.eligibility,'outside');assert.match(r.eligibilityText,/simultaneidade não reduz carga instalada/);
});
test('operação noturna cobre as duas partes do dia; fim à meia-noite é aceito',()=>{
 const s=example();s.loads[0].start=22;s.loads[0].end=6;
 const r=analyzeExpansion(s);near(r.profile[23].p,70);near(r.profile[4].p,70);near(r.profile[12].p,50);
 s.loads[0].end=0;assert.equal(analyzeExpansion(s).issues.length,0);
});
test('crescimento, margem e carregamento têm bases explícitas e não são mínimos normativos',()=>{
 const s=example();s.growth=10;s.margin=10;s.loading=80;near(analyzeExpansion(s).requiredKva,70*1.1*1.1/0.8);
});
test('bloqueia referência sem pico bruto, fonte, FP ou confirmação; não usa kWh ou geração como abatimento',()=>{
 for(const change of [{grossPeakConfirmed:false},{baselinePf:null},{measurementSource:''},{verified:false},{sameUnit:false},{loading:0}]){
  const r=analyzeExpansion({...example(),...change});assert.equal(r.requiredKva,null);assert.ok(r.issues.length>0);
 }
 const s=example();s.loads[0].unit='unknown';assert.equal(analyzeExpansion(s).reference,null);
});
test('B-optante exige geração local, ausência de créditos remotos e valida UC; Grupo A não vira B sozinho',()=>{
 assert.equal(analyzeExpansion({...example(),remoteCredits:true}).eligibility,'outside');
 assert.equal(analyzeExpansion({...example(),localGeneration:false}).eligibility,'outside');
 assert.equal(analyzeExpansion({...example(),remoteCredits:null}).eligibility,'pending');
 assert.equal(analyzeExpansion({...example(),sameUnit:false}).eligibility,'pending');
 assert.equal(analyzeExpansion({...example(),connection:'a'}).eligibility,'not-applicable');
});
test('substituição é da transformação inteira e não se soma à antiga; nenhum B-optante acima do limite',()=>{
 const s=example();s.currentKva=75;s.action='replace';s.proposedKva=112.5;s.proposedCount=1;
 assert.equal(analyzeExpansion(s).futureKva,112.5);assert.equal(analyzeExpansion(s).eligibility,'within');
 s.proposedKva=150;assert.equal(analyzeExpansion(s).eligibility,'outside');
});
test('relatório conserva inventário e premissas, limitações e encaminhamento sem economia inventada',()=>{
 const s=example();const text=expansionReport(s,'20/10/2026').join('\n');
 assert.match(text,/50 kW/);assert.match(text,/112,5 kVA/);assert.match(text,/Máquina/);assert.match(text,/base atual máxima/);assert.match(text,/não foi calculada/);assert.match(text,/15 minutos/);
});
test('restauração valida estrutura e reseta confirmações; rejeita campos ausentes e números não finitos',()=>{
 const s=example();const restored=parseExpansionStudy(JSON.parse(JSON.stringify(s)));assert.equal(restored.verified,false);assert.equal(restored.grossPeakConfirmed,false);assert.equal(restored.sameUnit,false);assert.equal(restored.loads[0].power,20);
 assert.throws(()=>parseExpansionStudy({...s,currentKva:Infinity}));assert.throws(()=>parseExpansionStudy({...s,loads:[{name:'incompleta'}]}));assert.throws(()=>parseExpansionStudy({...s,connection:'B5'}));
});
