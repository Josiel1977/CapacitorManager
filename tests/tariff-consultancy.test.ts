import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeConsultancy,consultancyReport,showExpansionExample,eligibleModes,parseConsultingStudy,type ConsultingStudy} from '../lib/tariff-consultancy.ts';
const fixture=():ConsultingStudy=>({version:1,client:'Teste',uc:'1',distributor:'Teste',subgroup:'A4',current:'verde',months:Array.from({length:12},(_,i)=>({month:`2026-${String(i+1).padStart(2,'0')}`,peakKwh:100,offPeakKwh:1000,intermediateKwh:0,peakKw:20,offPeakKw:100,reactiveCost:10,injectedKwh:null,compensatedKwh:null})),tariffs:[{mode:'verde',peak:1,offPeak:0.5,intermediate:null,demandPeak:null,demandOffPeak:10,residualGd:null,source:'tabela oficial conferida',date:'2026-07-01',verified:true},{mode:'azul',peak:0.6,offPeak:0.5,intermediate:null,demandPeak:20,demandOffPeak:5,residualGd:null,source:'tabela oficial conferida',date:'2026-07-01',verified:true}],contractedPeak:null,contractedOffPeak:150,minimumPeak:30,minimumOffPeak:30,growthPercent:0,marginPercent:10,availabilityKwh:100,gd:false,gdVerified:false,alternativesApproved:true,reviewed:true,notes:''});
test('compara energia e demanda no mesmo período e identifica verde econômica',()=>{
 const r=analyzeConsultancy(fixture());assert.deepEqual(r.issues,[]);assert.equal(r.baseline,25200);assert.equal(r.recommendation?.mode,'verde');assert.equal(r.recommendation?.total,19200);assert.equal(r.saving,6000);assert.equal(r.reactive.total,120);
});
test('histórico incompleto, lacuna ou duplicidade impede recomendação',()=>{
 for(const variant of ['short','duplicate','gap']){const s=fixture();if(variant==='short')s.months.pop();if(variant==='duplicate')s.months[1].month=s.months[0].month;if(variant==='gap')s.months[11].month='2027-02';assert.equal(analyzeConsultancy(s).recommendation,null);}
});
test('dados ausentes não viram zero, confirmação e fonte são obrigatórias',()=>{
 for(const change of [(s:ConsultingStudy)=>s.months[0].peakKw=null,(s:ConsultingStudy)=>s.tariffs[1].source='',(s:ConsultingStudy)=>s.reviewed=false,(s:ConsultingStudy)=>s.alternativesApproved=false,(s:ConsultingStudy)=>s.tariffs[1].verified=false]){const s=fixture();change(s);assert.equal(analyzeConsultancy(s).recommendation,null);}
});
test('consumo e injeção não são compensados automaticamente',()=>{
 const s=fixture(),before=analyzeConsultancy(s).baseline;s.months.forEach(m=>m.injectedKwh=99999);assert.equal(analyzeConsultancy(s).baseline,before);
 s.gd=true;assert.equal(analyzeConsultancy(s).recommendation,null);s.gdVerified=true;s.tariffs.forEach(t=>t.residualGd=50);const r=analyzeConsultancy(s);assert.equal(r.baseline,before!+600);
});
test('grupo B compara branca com piso de disponibilidade convencional',()=>{
 const s=fixture();s.subgroup='B3';s.current='convencional';s.months.forEach(m=>{m.peakKwh=0;m.offPeakKwh=10;m.intermediateKwh=0;});s.tariffs=[{...s.tariffs[0],mode:'convencional',offPeak:1},{...s.tariffs[1],mode:'branca',peak:2,offPeak:0.5,intermediate:1}];const r=analyzeConsultancy(s);assert.equal(r.baseline,1200);assert.equal(r.simulations[1].options[0].total,1200);assert.equal(r.recommendation,null);
});
test('elegibilidade restringe Verde em alta tensão e não troca Grupo B por A livremente',()=>{
 assert.deepEqual(eligibleModes('A1',true),['azul']);assert.deepEqual(eligibleModes('B-optante',false),['convencional']);assert.deepEqual(eligibleModes('B4',true),['convencional']);assert.deepEqual(eligibleModes('B1-baixa-renda',true),['convencional']);
});
test('restauração remove confirmações e rejeita estrutura perigosa ou incompleta',()=>{
 const s=fixture();const restored=parseConsultingStudy(JSON.parse(JSON.stringify(s)));assert.equal(restored.reviewed,false);assert.equal(restored.tariffs[0].verified,false);assert.throws(()=>parseConsultingStudy({...s,months:[{month:'2026-01'}]}));assert.throws(()=>parseConsultingStudy({...s,tariffs:[{...s.tariffs[0],peak:-1}]}));
});
test('relatório explica escopo, memória mensal, dados ausentes e plano de ação',()=>{
 const s=fixture();s.months.pop();const lines=consultancyReport(s,'20/10/2026').join('\n');assert.ok(lines.includes('Não há recomendação final'));assert.ok(lines.includes('MEMÓRIA MENSAL'));assert.ok(lines.includes('PLANO DE AÇÃO'));assert.ok(lines.includes('REFERÊNCIAS'));
});
test('consultoria não transforma zero contratado na Azul em dado ausente',()=>{
 for(const peakZero of [true,false]){
  const s=fixture();s.current='azul';s.contractedPeak=peakZero?0:30;s.contractedOffPeak=peakZero?100:0;s.minimumPeak=0;s.minimumOffPeak=0;
  const r=analyzeConsultancy(s);assert.equal(r.simulations.find(v=>v.mode==='azul')?.missing.length,0);assert.notEqual(r.baseline,null);
  assert.ok(r.baseline!>0);assert.ok(r.recommendation);
 }
});

test('clientes do Grupo A não recebem exemplo de migração do B-optante no relatório',()=>{
 for(const subgroup of ['A1','A2','A3','A3a','A4','AS']){
  const study={...fixture(),subgroup};
  assert.equal(showExpansionExample(subgroup),false);
  const report=consultancyReport(study,'21/10/2026').join('\n');
  assert.ok(!report.includes('AMPLIAÇÃO E MEDIÇÃO — EXEMPLO ORIENTATIVO'));
  assert.ok(!report.includes('um transformador atual de 112,5 kVA mais outro igual'));
  assert.ok(report.includes('PLANO DE AÇÃO'));
 }
});
test('Grupo B mantém exemplo e alternância de enquadramento não apaga observações',()=>{
 const study=fixture();study.notes='Observação técnica do responsável.';
 for(const subgroup of ['B1','B2','B3','B4','B1-baixa-renda','B-optante']){
  study.subgroup=subgroup;assert.equal(showExpansionExample(subgroup),true);
  assert.ok(consultancyReport(study,'21/10/2026').includes('AMPLIAÇÃO E MEDIÇÃO — EXEMPLO ORIENTATIVO (EQUATORIAL PARÁ)'));
 }
 study.subgroup='A4';assert.ok(consultancyReport(study,'21/10/2026').includes('Observações: Observação técnica do responsável.'));
});
