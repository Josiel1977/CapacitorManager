import {studyDemand,monthlyDemandCost} from './demand-study.ts';
import {validDate} from './aneel-tariffs.ts';
export type ConsultingMode='verde'|'azul'|'convencional'|'branca';
export interface ConsultingMonth {
 month:string; peakKwh:number|null; offPeakKwh:number|null; intermediateKwh:number|null;
 peakKw:number|null; offPeakKw:number|null; reactiveCost:number|null; injectedKwh:number|null; compensatedKwh:number|null;
}
export interface ConsultingTariff {
 mode:ConsultingMode; peak:number|null; offPeak:number|null; intermediate:number|null;
 demandPeak:number|null; demandOffPeak:number|null; residualGd:number|null;
 source:string; date:string; verified:boolean;
}
export interface ConsultingStudy {
 version:1; client:string; uc:string; distributor:string; subgroup:string; current:ConsultingMode;
 months:ConsultingMonth[]; tariffs:ConsultingTariff[];
 contractedPeak:number|null; contractedOffPeak:number|null; minimumPeak:number; minimumOffPeak:number;
 growthPercent:number; marginPercent:number; availabilityKwh:30|50|100;
 gd:boolean; gdVerified:boolean; alternativesApproved:boolean; reviewed:boolean; notes:string;
}
export const CONSULTING_SOURCES=[
 {title:'Equatorial Pará - NT.00002, revisão 10: ampliação e medição (itens 6.8.1 e 6.8.8–6.8.10)',url:'https://pa.equatorialenergia.com.br/wp-content/uploads/2025/12/NT.00002.EQTL-10-Fornecimento-de-Energia-Eletrica-em-Media-Tensao-138kV-231kV-e-345kV.pdf'},
 {title:'ANEEL - modalidades tarifárias',url:'https://www.gov.br/aneel/pt-br/assuntos/tarifas/entenda-a-tarifa/modalidades-tarifarias'},
 {title:'REN ANEEL 1.000/2021 consolidada - contratação, faturamento e reativo',url:'https://www2.aneel.gov.br/cedoc/ren20211000.pdf'},
 {title:'ANEEL - tarifas de aplicação, TE e TUSD',url:'https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica'},
 {title:'Lei 14.300/2022 - geração distribuída e SCEE',url:'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/lei/l14300.htm'},
 {title:'ANEEL - estudos de inversão de fluxo, Despacho 2.216/2024',url:'https://www2.aneel.gov.br/cedoc/adsp20242216_2.pdf'},
];
export const EXPANSION_EXAMPLE = [
 'Exemplo orientativo — Equatorial Pará: um transformador atual de 112,5 kVA mais outro igual na mesma UC somam 225 kVA. É capacidade de transformação, não demanda contratada de 225 kW. Com SCEE, a soma ultrapassa o requisito de 112,5 kVA do B-optante (REN 1.000, art. 292, § 3º).',
 'Passar do faturamento B-optante ao Grupo A não exige, por si só, cabine de medição primária. Pela NT.00002.EQTL, revisão 10, item 6.8.1, um único transformador até 300 kVA em poste ou pedestal tem medição no secundário, respeitadas as condições de localização e os demais requisitos da norma.',
 'Se forem dois transformadores, cada um em seu poste na rede interna e distribuídos conforme o centro de carga, o item 6.8.8 prevê medição em média tensão em cabine de alvenaria ou cubículo blindado, mesmo com soma até 300 kVA. Subestação abrigada também exige medição em média tensão (item 6.8.9); a localização pode impor outras condições (item 6.8.10).',
 'Comparar duas alternativas de projeto: acrescentar outro transformador com a medição exigida versus substituir o atual por um único maior. A definição depende de medições, cargas futuras, quedas de tensão, proteção, custos, norma vigente e aprovação da distribuidora. Este exemplo não dimensiona a instalação nem recomenda obra automaticamente.',
];
export const EXPANSION_NOTES_TEMPLATE = 'AMPLIAÇÃO A AVALIAR (preencher e validar): transformador atual ___ kVA; nova carga ___ kW; alternativa A — acrescentar ___ kVA; alternativa B — substituir por um único de ___ kVA; localização dos transformadores ___; ponto/padrão de medição ___; demanda prevista ___ kW; custos das alternativas ___; enquadramento SCEE/B-optante ___; aprovação da distribuidora pendente.';
export const CONSULTING_METHOD=[
 'Estudo prospectivo: reaplica as tarifas de referência ao perfil mensal informado. Não reconstitui faturas históricas e não comprova restituição de tributos. Tarifas de todas as alternativas na mesma base, sem tributos, bandeiras e CIP. Não se aplica cálculo genérico de ICMS por dentro.',
 'Demanda regular = max(medida prevista, contratada) × tarifa. Para consumo, se medida > 1,05 × contratada: adicional = 2 × tarifa × (medida - contratada). Verde usa o maior pico entre os postos; Azul calcula cada posto. A tolerância não disponibiliza capacidade adicional.',
 'A busca de demanda considera incrementos de 0,01 kW e mínimos informados. Em empate prefere menos ultrapassagens e maior contrato. A alternativa com margem usa o maior pico previsto × (1 + margem). Azul permite zero em um posto, mantendo pelo menos 30 kW no outro; Verde usa o mínimo geral de 30 kW. Confirmar incrementos, mínimos, prazos e condições de alteração no CUSD.',
 'Crescimento percentual aplica-se a energia e demanda de todos os meses e cenários. Energia injetada, compensada e custo reativo registrados são evidências separadas, sem projeção automática de geração ou eliminação de reativo.',
 'Convencional: maior entre consumo líquido informado e custo de disponibilidade em kWh. Branca: soma por posto, respeitando o piso de disponibilidade calculado pela tarifa convencional. Baixa renda e B4 não são elegíveis à Branca neste módulo.',
 'SCEE: confirmar consumo líquido faturável e conversões de créditos por posto para cada alternativa; informar custo residual GD mensal específico de cada modalidade. Não calcula automaticamente transição GD, créditos, autoconsumo ou tributação. Energia injetada não é geração total; não subtrair injeção novamente do consumo já líquido.',
 'Reativo excedente mensal não é reativo total: não permite deduzir fator de potência verdadeiro ou dimensionar banco de capacitores. Exigir curva horária, P/Q, sinal indutivo/capacitivo, harmônicas e períodos de medição. Consumo e injeção de potência são contratos distintos; fluxo reverso exige análise da rede e aprovação da distribuidora.',
 'Recomendação condicionada: 12 meses consecutivos, dados completos e revisados, alternativas elegíveis confirmadas, tarifas documentadas e SCEE validado quando aplicável. Mesmo assim requer validação técnica e contratual; não é garantia de economia.',
];
const valid=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const round=(n:number)=>Math.round(n*100)/100;
const fullMonth=(m:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(m);
export function eligibleModes(subgroup:string,approved:boolean):ConsultingMode[]{
 if(['A1','A2','A3'].includes(subgroup))return ['azul'];
 if(['A3a','A4','AS'].includes(subgroup))return ['verde','azul'];
 if(subgroup==='B-optante')return approved?['convencional','verde','azul']:['convencional'];
 if(['B1','B2','B3'].includes(subgroup))return ['convencional','branca'];
 if(['B4','B1-baixa-renda'].includes(subgroup))return ['convencional'];
 return [];
}
export function analyzeConsultancy(s:ConsultingStudy){
 const issues:string[]=[];
 if(!s.client.trim()||!s.uc.trim()||!s.distributor.trim())issues.push('Preencha cliente, UC e distribuidora.');
 if(!s.months.length||s.months.length>12)issues.push('Informe de 1 a 12 meses.');
 const sorted=[...s.months].sort((a,b)=>a.month.localeCompare(b.month));
 const unique=new Set(sorted.map(m=>m.month));
 if(sorted.some(m=>!fullMonth(m.month))||unique.size!==sorted.length)issues.push('Meses inválidos ou duplicados.');
 const index=(m:string)=>Number(m.slice(0,4))*12+Number(m.slice(5));
 const consecutive=sorted.length===12&&unique.size===12&&sorted.every((m,i)=>fullMonth(m.month)&&(i===0||index(m.month)-index(sorted[i-1].month)===1));
 if(!consecutive)issues.push('Complete 12 meses consecutivos para uma recomendação anual.');
 if(s.subgroup==='B1-baixa-renda')issues.push('Tarifa social exige cálculo específico por faixa e benefício; este modelo não libera recomendação para baixa renda.');
 if(!s.reviewed)issues.push('Confira e confirme os dados do estudo.');
 if(!s.alternativesApproved)issues.push('Confirme a elegibilidade das alternativas e as condições da conexão/CUSD.');
 if(!valid(s.growthPercent)||!valid(s.marginPercent)||!valid(s.minimumPeak)||!valid(s.minimumOffPeak))issues.push('Crescimento, margem ou mínimos inválidos.');
 const modes=eligibleModes(s.subgroup,s.alternativesApproved);
 if(!modes.includes(s.current))issues.push('Modalidade atual incompatível com o enquadramento informado.');
 if(!s.gd&&s.months.some(m=>valid(m.injectedKwh)&&m.injectedKwh>0))issues.push('Há energia injetada no histórico: confirme o enquadramento GD/SCEE antes da recomendação.');
 if(s.gd&&!s.gdVerified)issues.push('Valide o SCEE e o consumo líquido por posto em cada alternativa.');
 const factor=1+s.growthPercent/100;
 const simulations=modes.map(mode=>{
  const missing:string[]=[];
  const matches=s.tariffs.filter(t=>t.mode===mode),t=matches[0];
  if(matches.length!==1)missing.push('uma única tabela de tarifas por modalidade');
  if(!t||!t.verified||!t.source.trim()||!validDate(t.date))missing.push('tarifas conferidas, fonte e data de referência');
  const a=mode==='verde'||mode==='azul';
  const keys:('peak'|'offPeak'|'intermediate'|'demandPeak'|'demandOffPeak')[]=mode==='convencional'?['offPeak']:mode==='branca'?['peak','offPeak','intermediate']:mode==='azul'?['peak','offPeak','demandPeak','demandOffPeak']:['peak','offPeak','demandOffPeak'];
  if(!t||keys.some(k=>!valid(t[k])||t[k]!<=0))missing.push('valores tarifários positivos');
  if(s.gd&&(!t||!valid(t.residualGd)))missing.push('custo residual GD mensal específico');
  if(!s.months.length||s.months.length>12||s.months.some(m=>!fullMonth(m.month))||unique.size!==s.months.length)missing.push('meses válidos e únicos');
  if(s.months.some(m=>!valid(m.peakKwh)||!valid(m.offPeakKwh)||!valid(m.intermediateKwh)))missing.push('consumo líquido por posto, inclusive zero confirmado no intermediário do Grupo A');
  if(a&&s.months.some(m=>valid(m.intermediateKwh)&&m.intermediateKwh!==0))missing.push('intermediário deve ser zero nas modalidades do Grupo A');
  if(a&&s.months.some(m=>!valid(m.peakKw)||!valid(m.offPeakKw)))missing.push('demandas máximas por posto');
  if(!valid(s.growthPercent)||!valid(s.marginPercent))missing.push('crescimento e margem');
  const conventional=s.tariffs.find(v=>v.mode==='convencional');
  if(mode==='branca'&&(!conventional||!valid(conventional.offPeak)||conventional.offPeak<=0||!conventional.verified))missing.push('tarifa convencional para custo de disponibilidade');
  if(![30,50,100].includes(s.availabilityKwh))missing.push('custo de disponibilidade');
  if(missing.length||!t)return {mode,missing,options:[]};
  let demand:ReturnType<typeof studyDemand>|null=null;
  if(a){
   try{demand=studyDemand({mode:mode as 'verde'|'azul',months:s.months.map(m=>({month:m.month,peak:m.peakKw,offPeak:m.offPeakKw})),contractedPeak:s.current===mode&&valid(s.contractedPeak)?s.contractedPeak:s.minimumPeak,contractedOffPeak:s.current===mode&&valid(s.contractedOffPeak)?s.contractedOffPeak:Math.max(30,s.minimumOffPeak),tariffPeak:t.demandPeak??1,tariffOffPeak:t.demandOffPeak!,minimumPeak:s.minimumPeak,minimumOffPeak:mode==='verde'?Math.max(30,s.minimumOffPeak):s.minimumOffPeak,growthPercent:s.growthPercent,marginPercent:s.marginPercent});}
   catch(e){return {mode,missing:[e instanceof Error?e.message:'Dados de demanda inválidos'],options:[]};}
  }
  const options=(a?['economic','margin']:['economic']) .map(kind=>{
   const d=demand?.scenarios.find(v=>v.key===kind);
   const monthly=s.months.map(m=>{
    const totalKwh=(m.peakKwh!+m.offPeakKwh!+m.intermediateKwh!)*factor;
    const energy=mode==='convencional'?Math.max(totalKwh,s.availabilityKwh)*t.offPeak!:mode==='branca'?Math.max((m.peakKwh!*t.peak!+m.offPeakKwh!*t.offPeak!+m.intermediateKwh!*t.intermediate!)*factor,s.availabilityKwh*conventional!.offPeak!):(m.peakKwh!*t.peak!+(m.offPeakKwh!+m.intermediateKwh!)*t.offPeak!)*factor;
    const off=a?monthlyDemandCost((mode==='verde'?Math.max(m.peakKw!,m.offPeakKw!):m.offPeakKw!)*factor,d!.offPeak,t.demandOffPeak!):{base:0,excess:0};
    const peak=mode==='azul'?monthlyDemandCost(m.peakKw!*factor,d!.peak!,t.demandPeak!):{base:0,excess:0};
    return {month:m.month,energy:round(energy),demand:round(off.base+peak.base),excess:round(off.excess+peak.excess),gd:s.gd?t.residualGd!:0,total:round(energy+off.base+peak.base+off.excess+peak.excess+(s.gd?t.residualGd!:0))};
   });
   return {kind,peak:d?.peak??null,offPeak:d?.offPeak??null,total:round(monthly.reduce((v,m)=>v+m.total,0)),excess:round(monthly.reduce((v,m)=>v+m.excess,0)),monthly};
  });
  return {mode,missing,options};
 });
 const currentTariff=s.tariffs.find(t=>t.mode===s.current);
 const currentSimulation=simulations.find(r=>r.mode===s.current);
 let baseline:number|null=null;
 if(currentSimulation&&!currentSimulation.missing.length&&currentTariff){
  if(s.current==='verde'||s.current==='azul'){
   if(valid(s.contractedOffPeak)&&(s.current==='verde'?s.contractedOffPeak>=30:valid(s.contractedPeak)&&Math.max(s.contractedPeak,s.contractedOffPeak)>=30)){
    const energy=currentSimulation.options[0].monthly.reduce((v,m)=>v+m.energy+m.gd,0);
    baseline=round(energy+s.months.reduce((v,m)=>v+monthlyDemandCost((s.current==='verde'?Math.max(m.peakKw!,m.offPeakKw!):m.offPeakKw!)*factor,s.contractedOffPeak!,currentTariff.demandOffPeak!).total+(s.current==='azul'?monthlyDemandCost(m.peakKw!*factor,s.contractedPeak!,currentTariff.demandPeak!).total:0),0));
   }else issues.push('Informe demandas contratadas atuais para comparação econômica.');
  }else baseline=currentSimulation.options[0].total;
 }
 const dateSet=new Set(s.tariffs.filter(t=>modes.includes(t.mode)).map(t=>t.date));
 if(dateSet.size>1)issues.push('Use a mesma data tarifária de referência em todas as modalidades.');
 const ranked=simulations.flatMap(r=>r.options.filter(o=>o.kind==='economic').map(o=>({...o,mode:r.mode}))).sort((a,b)=>a.total-b.total);
 const complete=simulations.length>0&&simulations.every(r=>!r.missing.length)&&baseline!==null&&ranked.every(r=>Number.isFinite(r.total));
 if(!complete)issues.push('Comparação incompleta: preencha todas as modalidades elegíveis e o contrato atual.');
 const tied=ranked.length>1&&Math.abs(ranked[0].total-ranked[1].total)<0.01;
 if(!ranked.length)issues.push('Não há alternativa calculável com os dados atuais.');
 if(tied)issues.push('Alternativas empatadas; não há modalidade economicamente superior identificada.');
 const recommendation=!issues.length&&complete&&!tied?ranked[0]:null;
 const demandFindings: string[]=[];
 if(s.current==='verde'||s.current==='azul'){
  const posts=s.current==='verde'?['unique'] as const:['peak','off'] as const;
  for(const post of posts){
   const contract=post==='peak'?s.contractedPeak:s.contractedOffPeak;
   const values=s.months.map(m=>post==='peak'?m.peakKw:post==='off'?m.offPeakKw:valid(m.peakKw)&&valid(m.offPeakKw)?Math.max(m.peakKw,m.offPeakKw):null);
   if(values.length&&values.every(valid)&&valid(contract)){const measured=values as number[];const max=Math.max(...measured),breaches=measured.filter(v=>v-contract*1.05>1e-9).length;demandFindings.push(`${post==='unique'?'Demanda única':post==='peak'?'Ponta':'Fora de ponta'}: contrato ${contract} kW; maior medida ${max} kW; folga no maior pico ${round(Math.max(0,contract-max))} kW; ${breaches} meses acima de 105% do contrato informado. Comparação histórica supõe contrato constante; conferir alterações no período.`);}
  }
 }
 const reactive=s.months.filter(m=>valid(m.reactiveCost));
 const injection=s.months.filter(m=>valid(m.injectedKwh));
 return {issues,simulations,baseline,ranked,recommendation,demandFindings,saving:recommendation&&baseline!==null?round(baseline-recommendation.total):null,consecutive,
  reactive:{months:reactive.length,total:round(reactive.reduce((v,m)=>v+m.reactiveCost!,0))},
  injection:{months:injection.length,kwh:round(injection.reduce((v,m)=>v+m.injectedKwh!,0))}};
}
export function consultancyReport(s:ConsultingStudy,date:string){
 const r=analyzeConsultancy(s);
 return ['CONSULTORIA E GESTÃO TARIFÁRIA',`Estudo v1 | Emissão: ${date}`,`Cliente: ${s.client} | UC: ${s.uc}`,`Distribuidora: ${s.distributor} | Subgrupo: ${s.subgroup} | Atual: ${s.current}`,
 `Status: ${r.recommendation?'Recomendação condicionada à validação técnica e contratual':'Estudo preliminar / pendências'}`,
 `Período: ${s.months.length} meses | Crescimento: ${s.growthPercent}% | Margem de pico: ${s.marginPercent}%`,
 `Contrato atual: única/fora ${s.contractedOffPeak??'ausente'} kW; ponta ${s.contractedPeak??'não aplicável'} kW.`,
 `Mínimos simulados: única/fora ${s.minimumOffPeak} kW; ponta ${s.minimumPeak} kW. Disponibilidade Grupo B: ${s.availabilityKwh} kWh.`,
 `SCEE: ${s.gd?'sim':'não'} | Conferido: ${s.gdVerified?'sim':'não'} | Elegibilidade: ${s.alternativesApproved?'confirmada':'pendente'} | Dados: ${s.reviewed?'revisados':'pendentes'}`,
 'DIAGNÓSTICO DA CONTRATAÇÃO',...r.demandFindings,
 'CONCLUSÃO',r.recommendation?`Menor custo prospectivo: ${r.recommendation.mode}; demanda única/fora ${r.recommendation.offPeak??'não aplicável'} kW, ponta ${r.recommendation.peak??'não aplicável'} kW. Diferença estimada no período: R$ ${r.saving?.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}.`:'Não há recomendação final liberada. Confira as pendências abaixo.',
 ...r.issues.map(v=>`Pendência: ${v}`),'COMPARAÇÃO NA MESMA BASE SEM TRIBUTOS',`Referência atual simulada: ${r.baseline===null?'ausente':`R$ ${r.baseline.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`}`,
 ...r.simulations.flatMap(v=>v.missing.length?[`${v.mode}: pendente - ${v.missing.join('; ')}`]:v.options.map(o=>`${v.mode} / ${o.kind==='margin'?'com margem':'econômica'}: R$ ${o.total.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}; ultrapassagem R$ ${o.excess.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}; demanda única/fora ${o.offPeak??'-'} kW, ponta ${o.peak??'-'} kW.`)),
 'TARIFAS E RASTREABILIDADE',...s.tariffs.map(t=>`${t.mode}: energia ponta ${t.peak??'-'}, fora ${t.offPeak??'-'}, intermediário ${t.intermediate??'-'} R$/kWh; demanda ponta ${t.demandPeak??'-'}, única/fora ${t.demandOffPeak??'-'} R$/kW; residual GD ${t.residualGd??'-'} R$/mês. Referência: ${t.date}; conferida: ${t.verified?'sim':'não'}. Fonte: ${t.source}`),
 'HISTÓRICO INFORMADO',...s.months.map(m=>`${m.month}: consumo líquido ponta ${m.peakKwh??'?'} / fora ${m.offPeakKwh??'?'} / intermediário ${m.intermediateKwh??'?'} kWh; demanda ponta ${m.peakKw??'?'} / fora ${m.offPeakKw??'?'} kW; reativo R$ ${m.reactiveCost??'?'}; injetado ${m.injectedKwh??'?'} kWh; compensado ${m.compensatedKwh??'?'} kWh.`),
 'MEMÓRIA MENSAL DAS ALTERNATIVAS',...r.simulations.flatMap(v=>v.options.flatMap(o=>[`${v.mode} / ${o.kind}`,...o.monthly.map(m=>`${m.month}: energia R$ ${m.energy.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}, demanda R$ ${m.demand.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}, ultrapassagem R$ ${m.excess.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}, GD R$ ${m.gd.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}; total R$ ${m.total.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}.`)])),
 'REATIVO E ENERGIA INJETADA',`Reativo identificado: R$ ${r.reactive.total.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})} em ${r.reactive.months} meses informados; não equivale a economia garantida. Injeção informada: ${r.injection.kwh} kWh em ${r.injection.months} meses; não equivale à geração total.`,
 'PLANO DE AÇÃO','1. Conferir 12 faturas, CUSD, resolução tarifária e perfil por posto; obter curva de carga de 15 minutos quando necessária.','2. Validar cargas futuras, capacidade de conexão, opções disponíveis e custos de adequação com a distribuidora.','3. Para reativo: realizar campanha horária de P/Q/FP e harmônicas, revisar o banco existente e emitir especificação por responsável habilitado.','4. Para energia injetada: conferir projeto/aprovação, potência de inversores, medição bidirecional, créditos, regime GD e limites de exportação.','5. Solicitar formalmente a alteração após validação, registrar protocolo, vigência e monitorar as faturas seguintes.',
 'AMPLIAÇÃO E MEDIÇÃO — EXEMPLO ORIENTATIVO (EQUATORIAL PARÁ)',...EXPANSION_EXAMPLE,
 `Observações: ${s.notes}`,'PREMISSAS E LIMITES',...CONSULTING_METHOD,'REFERÊNCIAS',...CONSULTING_SOURCES.map(v=>`${v.title}: ${v.url}`)];
}
export function parseConsultingStudy(value:unknown):ConsultingStudy {
 if(!value||typeof value!=='object')throw new Error('Arquivo inválido.');
 const s=value as ConsultingStudy;
 if(s.version!==1||!Array.isArray(s.months)||s.months.length>12||!Array.isArray(s.tariffs)||s.tariffs.length>4)throw new Error('Versão ou estrutura inválida.');
 if(['client','uc','distributor','subgroup','notes'].some(k=>typeof s[k as keyof ConsultingStudy]!=='string'))throw new Error('Identificação inválida.');
 if(!['verde','azul','convencional','branca'].includes(s.current))throw new Error('Modalidade inválida.');
 for(const m of s.months){if(!m||typeof m.month!=='string'||Object.entries(m).some(([k,v])=>k!=='month'&&v!==null&&!valid(v)))throw new Error('Histórico inválido.'); for(const key of ['peakKwh','offPeakKwh','intermediateKwh','peakKw','offPeakKw','reactiveCost','injectedKwh','compensatedKwh']) if(!(key in m))throw new Error('Histórico incompleto.');}
 for(const t of s.tariffs){if(!t||!['verde','azul','convencional','branca'].includes(t.mode)||typeof t.source!=='string'||typeof t.date!=='string'||typeof t.verified!=='boolean')throw new Error('Tarifa inválida.');for(const k of ['peak','offPeak','intermediate','demandPeak','demandOffPeak','residualGd'] as const)if(t[k]!==null&&!valid(t[k]))throw new Error('Valor tarifário inválido.');}
 for(const k of ['minimumPeak','minimumOffPeak','growthPercent','marginPercent'] as const)if(s[k]!==null&&!valid(s[k]))throw new Error('Premissas inválidas.');
 for(const k of ['contractedPeak','contractedOffPeak'] as const)if(s[k]!==null&&!valid(s[k]))throw new Error('Contrato inválido.');
 if(![30,50,100].includes(s.availabilityKwh)||['gd','gdVerified','alternativesApproved','reviewed'].some(k=>typeof s[k as keyof ConsultingStudy]!=='boolean'))throw new Error('Confirmações inválidas.');
 return {...s,minimumPeak:s.minimumPeak??NaN,minimumOffPeak:s.minimumOffPeak??NaN,growthPercent:s.growthPercent??NaN,marginPercent:s.marginPercent??NaN,reviewed:false,gdVerified:false,alternativesApproved:false,tariffs:s.tariffs.map(t=>({...t,verified:false}))};
}
