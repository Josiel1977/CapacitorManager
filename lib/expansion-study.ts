export type LoadUnit = 'unknown' | 'input-kw' | 'shaft-kw' | 'cv';
export interface ExpansionLoad {
  name: string; quantity: number | null; power: number | null; unit: LoadUnit;
  efficiency: number | null; powerFactor: number | null; utilization: number | null;
  simultaneous: number | null; start: number | null; end: number | null;
}
export interface ExpansionStudy {
  version: 1; client: string; uc: string; distributor: 'equatorial-pa' | 'other';
  connection: 'unknown' | 'bt' | 'b-optante' | 'a';
  scee: boolean | null; localGeneration: boolean | null; remoteCredits: boolean | null; sameUnit: boolean;
  currentKva: number | null; currentCount: number | null; installedKw: number | null;
  measuredKw: number | null; baselinePf: number | null; measurementSource: string; grossPeakConfirmed: boolean;
  growth: number | null; margin: number | null; loading: number | null;
  action: 'keep' | 'add' | 'replace'; proposedKva: number | null; proposedCount: number | null;
  arrangement: 'unknown' | 'single-outdoor' | 'multiple-poles' | 'sheltered';
  loads: ExpansionLoad[]; verified: boolean; notes: string;
}
export const EXPANSION_SOURCES = [
  {title: 'REN ANEEL 1.000/2021, arts. 23 e 292 - confirmar texto vigente', url: 'https://www2.aneel.gov.br/cedoc/ren20211000.pdf'},
  {title: 'Celesc - critérios nacionais do art. 292, § 3º (não importar prazos locais)', url: 'https://www.celesc.com.br/micro-mini-geracao?catid=13:duvidas-frequentes&id=529:perguntas-frequentes&view=article'},
  {title: 'Equatorial Pará - NT.00002, rev. 10/2025; 5.14, 6.8 e tabela 10A', url: 'https://pa.equatorialenergia.com.br/wp-content/uploads/2025/12/NT.00002.EQTL-10-Fornecimento-de-Energia-Eletrica-em-Media-Tensao-138kV-231kV-e-345kV.pdf'},
];
export const TRANSFORMER_REFERENCES = [75, 112.5, 150, 225, 300, 500, 750, 1000, 1500, 2000];
export const newExpansionLoad = (): ExpansionLoad => ({name:'',quantity:1,power:null,unit:'unknown',efficiency:null,powerFactor:null,utilization:100,simultaneous:100,start:0,end:24});
export const newExpansionStudy = (): ExpansionStudy => ({version:1,client:'',uc:'',distributor:'equatorial-pa',connection:'unknown',scee:null,localGeneration:null,remoteCredits:null,sameUnit:false,currentKva:null,currentCount:null,installedKw:null,measuredKw:null,baselinePf:null,measurementSource:'',grossPeakConfirmed:false,growth:0,margin:10,loading:80,action:'keep',proposedKva:null,proposedCount:1,arrangement:'unknown',loads:[newExpansionLoad()],verified:false,notes:''});
const valid = (n: number | null): n is number => n !== null && Number.isFinite(n) && n >= 0;
const positive = (n: number | null): n is number => valid(n) && n > 0;
const integer = (n: number | null) => positive(n) && Number.isInteger(n);
const ratio = (n: number | null) => positive(n) && n <= 1;
const percent = (n: number | null) => valid(n) && n <= 100;
const reactive = (p: number, pf: number) => p * Math.tan(Math.acos(pf));
const operates = (hour: number, start: number, end: number) => start < end ? hour >= start && hour < end : hour >= start || hour < end;

export function analyzeExpansion(study: ExpansionStudy) {
  const issues: string[] = [];
  if (!positive(study.currentKva) || !integer(study.currentCount)) issues.push('Informar a soma da capacidade e a quantidade dos transformadores da mesma UC.');
  if (!positive(study.installedKw)) issues.push('Informar a carga elétrica instalada atual em kW; não confundir com consumo em kWh.');
  if (!valid(study.measuredKw) || !ratio(study.baselinePf)) issues.push('Informar pico elétrico bruto atual e fator de potência medido (maior que zero e até 1).');
  if (!study.measurementSource.trim() || !study.grossPeakConfirmed) issues.push('Confirmar origem e abrangência do pico bruto: incluir autoconsumo solar e condições sem geração. A fatura líquida não dimensiona o transformador.');
  if (valid(study.measuredKw) && positive(study.installedKw) && study.measuredKw > study.installedKw) issues.push('Pico atual superior à carga instalada declarada: conferir unidades e inventário.');
  if (!percent(study.growth) || !percent(study.margin) || !positive(study.loading) || study.loading > 100) issues.push('Conferir crescimento/margem (0 a 100%) e carregamento de planejamento (maior que zero e até 100%).');
  if (!study.sameUnit) issues.push('Confirmar que os dados e transformadores pertencem à mesma UC. Não somar ou dividir UCs artificialmente.');
  if (!study.verified) issues.push('Conferir inventário, fatores e horários antes de liberar uma referência de transformação.');
  if (study.connection === 'unknown') issues.push('Confirmar se a conexão é BT, B-optante em MT ou Grupo A.');
  if (study.scee === null) issues.push('Confirmar a participação no SCEE.');
  if (study.connection === 'b-optante' && study.scee === false) issues.push('B-optante sem SCEE exige análise específica dos demais critérios do art. 292; não há aprovação automática neste módulo.');
  if (study.distributor !== 'equatorial-pa') issues.push('Norma de medição de outra distribuidora não implementada; consultar o padrão local.');
  const loads = study.loads.map((load, index) => {
    const ok = load.name.trim() && integer(load.quantity) && positive(load.power) && ratio(load.powerFactor) && percent(load.utilization) && percent(load.simultaneous)
      && valid(load.start) && load.start <= 23 && Number.isInteger(load.start) && valid(load.end) && load.end <= 24 && Number.isInteger(load.end) && load.start !== load.end
      && load.unit !== 'unknown' && (load.unit === 'input-kw' || ratio(load.efficiency));
    if (!ok) { issues.push(`Carga ${index+1}: completar nome, quantidade, base da potência, rendimento quando mecânica, FP, fatores e horários inteiros (0 a 24).`); return null; }
    const installed = load.power! * load.quantity! * (load.unit === 'cv' ? 0.73549875 : 1) / (load.unit === 'input-kw' ? 1 : load.efficiency!);
    const p = installed * load.utilization! / 100 * load.simultaneous! / 100;
    const q=reactive(p,load.powerFactor!);
    if (![installed,p,q].every(Number.isFinite)) {issues.push(`Carga ${index+1}: valores excedem a faixa de cálculo; conferir unidades.`);return null;}
    return {installed,p,q,start:load.start!,end:load.end!};
  });
  if (!study.loads.length || study.loads.length > 100) issues.push('Informar de 1 a 100 cargas novas.');
  const inputsReady = !issues.length;
  const numericalReady = inputsReady; // Sem premissas conferidas, não fabricar uma potência sugerida.
  const installedNew = loads.every(Boolean) && loads.length ? loads.reduce((sum,load)=>sum+load!.installed,0) : null;
  const installedTotal = installedNew !== null && valid(study.installedKw) ? study.installedKw + installedNew : null;
  const profile = numericalReady ? Array.from({length:24},(_,hour)=>{
    let p = study.measuredKw!, q = reactive(study.measuredKw!,study.baselinePf!);
    for (const load of loads) if (load && operates(hour,load.start,load.end)) {p+=load.p;q+=load.q;}
    const factor = 1 + study.growth! / 100;
    return {hour,p:p*factor,q:q*factor,kva:Math.hypot(p,q)*factor};
  }) : [];
  const peak = profile.length ? profile.reduce((a,b)=>a.kva>=b.kva?a:b) : null;
  const requiredKva = peak ? peak.kva * (1+study.margin!/100)/(study.loading!/100) : null;
  const reference = requiredKva === null ? null : TRANSFORMER_REFERENCES.find(kva=>kva+1e-9>=requiredKva) ?? null;
  const proposedValid = study.action === 'keep' || (positive(study.proposedKva) && integer(study.proposedCount));
  if (!proposedValid) issues.push('Completar capacidade unitária e quantidade da alternativa de transformação.');
  const currentValid = positive(study.currentKva) && integer(study.currentCount);
  const futureKva = currentValid && proposedValid ? study.action === 'keep' ? study.currentKva! : (study.action === 'add' ? study.currentKva! : 0) + study.proposedKva! * study.proposedCount! : null;
  const futureCount = currentValid && proposedValid ? study.action === 'keep' ? study.currentCount! : (study.action === 'add' ? study.currentCount! : 0) + study.proposedCount! : null;
  if (study.arrangement === 'single-outdoor' && futureCount !== null && futureCount !== 1) issues.push('Arranjo declarado como único transformador, mas a alternativa possui mais de um: corrigir o cadastro.');
  let eligibility: 'pending' | 'within' | 'outside' | 'not-applicable' = 'pending';
  let eligibilityText = 'Enquadramento pendente: confirmar tensão, regime, transformadores, geração e condições da distribuidora.';
  if (study.connection === 'a') {eligibility='not-applicable';eligibilityText='Cliente já no Grupo A: avaliar expansão e contratação de demanda. Retorno ao faturamento B exige estudo específico, não é automático.';}
  else if (study.sameUnit && study.connection === 'bt' && installedTotal !== null) {
    eligibility = installedTotal > 75 ? 'outside' : 'within';
    eligibilityText = installedTotal > 75 ? 'Carga instalada prevista superior a 75 kW: fora do critério geral de atendimento BT. Exceções e tensão de conexão dependem da distribuidora; reduzir simultaneidade não reduz carga instalada.' : 'Carga instalada dentro do critério geral de 75 kW para BT, sem aprovação automática: tensão, equipamentos perturbadores e rede ainda precisam de avaliação. Transformador particular não é requisito universal do Grupo B.';
  } else if (study.sameUnit && study.connection === 'b-optante' && study.scee === true && futureKva !== null) {
    if (futureKva > 112.5 || study.localGeneration === false || study.remoteCredits === true) {eligibility='outside';eligibilityText='Alternativa incompatível com os critérios gerais de B-optante com SCEE: soma máxima de 112,5 kVA, geração na própria UC e ausência de envio/recebimento de excedentes em outra UC.';}
    else if (study.localGeneration === true && study.remoteCredits === false) {eligibility='within';eligibilityText='Alternativa dentro dos critérios gerais cadastrados de B-optante com SCEE. Isso é triagem de faturamento, não autorização de conexão ou comprovação de capacidade elétrica.';}
  }
  const capacityAdequate = requiredKva !== null && futureKva !== null ? futureKva+1e-9 >= requiredKva : null;
  const fitsBOptante = requiredKva !== null && study.connection === 'b-optante' && study.scee === true ? requiredKva <= 112.5 + 1e-9 : null;
  const guidance: string[] = [];
  if (study.sameUnit && study.connection === 'b-optante' && study.scee === true && positive(study.currentKva) && study.currentKva >= 112.5) guidance.push('A transformação atual já atinge ou supera 112,5 kVA. Acrescentar qualquer potência nominal na mesma UC ultrapassa o critério geral do B-optante com SCEE, mesmo se as máquinas não funcionarem juntas. Isso não informa se há folga elétrica no transformador atual.');
  if (requiredKva !== null && study.connection === 'b-optante' && study.scee) {
    if (fitsBOptante) guidance.push(study.currentKva! >= requiredKva ? 'O modelo indica avaliar manter a transformação atual e organizar as cargas, em vez de acrescentar capacidade. Confirmar também os critérios de faturamento e a capacidade de cada circuito.' : `Referência para substituir toda a transformação por um único equipamento: ${reference} kVA, sujeita à aprovação. Não adicionar esse valor à capacidade atual: o limite considera a soma na UC.`);
    else guidance.push('Não foi encontrada solução de transformação dentro de 112,5 kVA com estas premissas. Rever ciclos, intertravamentos e consumo simultâneo com medições, ou estudar faturamento no Grupo A. Não reduzir o trafo apenas para enquadrar a tarifa.');
  }
  if (requiredKva !== null && study.connection !== 'b-optante') guidance.push(reference === null ? 'Necessidade superior ao catálogo de referência deste módulo: dimensionamento específico.' : `Referência para um único transformador atendendo toda a carga modelada: ${reference} kVA. Não é indicação de comprar, nem seleção do transformador adicional de um conjunto.`);
  if (capacityAdequate === false) guidance.push('A alternativa cadastrada não atende ao critério de capacidade planejada. O enquadramento tarifário não compensa insuficiência elétrica.');
  if (futureCount !== null && futureCount > 1) guidance.push('Somar kVA não comprova capacidade por setor: distribuir as cargas por transformador e estudar cada equipamento, proteção e rede interna.');
  let metering = 'Ponto de medição pendente: confirmar localização, arranjo e padrão aprovado. Grupo tarifário e tipo de medição são decisões distintas.';
  if (study.distributor === 'equatorial-pa') {
    if (study.arrangement === 'multiple-poles' && futureCount !== null && futureCount > 1) metering='Equatorial PA, NT.00002, 6.8.8: vários postos em postes na rede interna exigem medição em MT em cabine/cubículo, inclusive com soma até 300 kVA. Confirmar o projeto e a localização.';
    else if (study.arrangement === 'sheltered') metering='Equatorial PA, NT.00002, 6.8.9: subestação abrigada utiliza medição em MT, inclusive até 300 kVA. Confirmar o projeto.';
    else if (study.arrangement === 'single-outdoor' && futureCount === 1 && futureKva !== null && futureKva <= 300) metering='Equatorial PA, NT.00002, 6.8.1: um único transformador até 300 kVA em poste/pedestal pode ter medição no secundário nas condições previstas. Localização pode exigir medição em MT (6.8.10). Não há garantia de dispensar cabine.';
  }
  const conclusion = capacityAdequate === false ? 'Alternativa não atende à capacidade de planejamento calculada, independentemente do enquadramento tarifário.'
    : eligibility === 'outside' ? 'Alternativa fora dos critérios gerais de permanência informados; solicitar estudo de enquadramento à distribuidora.'
    : issues.length || requiredKva === null || eligibility === 'pending' ? 'Diagnóstico pendente: completar dados, medições e critérios de enquadramento.'
    : 'Alternativa atende aos filtros globais simulados. Validar cada transformador e circuito, o projeto, a medição e a aprovação da distribuidora antes de executar.';
  return {issues:[...new Set(issues)],conclusion,profile,peak,installedNew,installedTotal,requiredKva,reference,futureKva,futureCount,eligibility,eligibilityText,capacityAdequate,fitsBOptante,guidance,metering};
}

const n = (value: number | null) => value === null ? 'pendente' : value.toLocaleString('pt-BR',{maximumFractionDigits:2});
export function expansionReport(study: ExpansionStudy, date: string) {
  const r = analyzeExpansion(study);
  return ['ESTUDO PRELIMINAR DE EXPANSÃO E TRANSFORMAÇÃO','Capacitor Manager | JM Eletro Service',`Cliente: ${study.client || 'não informado'} | UC: ${study.uc || 'não informada'} | Emissão: ${date}`,
    'Triagem técnica e de faturamento. Não é projeto, autorização de conexão, recomendação de compra ou garantia de economia.', '', 'CENÁRIO INFORMADO',
    `Conexão: ${{unknown:'a confirmar',bt:'Grupo B atendido em baixa tensão','b-optante':'B-optante em média tensão',a:'Grupo A'}[study.connection]}; distribuidora: ${study.distributor==='equatorial-pa'?'Equatorial Pará':'outra'}; SCEE: ${study.scee===null?'pendente':study.scee?'sim':'não'}; geração local: ${study.localGeneration===null?'pendente':study.localGeneration?'sim':'não'}; créditos remotos: ${study.remoteCredits===null?'pendente':study.remoteCredits?'sim':'não'}; mesma UC confirmada: ${study.sameUnit?'sim':'não'}.`,
    `Transformação atual: ${n(study.currentKva)} kVA em ${n(study.currentCount)} equipamentos. Alternativa: ${{keep:'manter',add:'adicionar',replace:'substituir toda a transformação'}[study.action]}; potência unitária informada: ${n(study.proposedKva)} kVA; quantidade: ${n(study.proposedCount)}. Total previsto: ${n(r.futureKva)} kVA em ${n(r.futureCount)} equipamentos. Arranjo: ${{unknown:'a definir','single-outdoor':'único em poste/pedestal','multiple-poles':'vários postos na rede interna',sheltered:'abrigado'}[study.arrangement]}.`,
    `Carga elétrica instalada atual: ${n(study.installedKw)} kW; novas cargas nominais elétricas: ${n(r.installedNew)} kW; total instalado: ${n(r.installedTotal)} kW.`,
    `Base bruta atual: ${n(study.measuredKw)} kW; FP: ${n(study.baselinePf)}; fonte/campanha: ${study.measurementSource||'não informada'}; base bruta confirmada: ${study.grossPeakConfirmed?'sim':'não'}.`,
    `Crescimento adicional sobre toda a carga modelada: ${n(study.growth)}%; margem: ${n(study.margin)}%; carregamento de planejamento: ${n(study.loading)}% (premissa editável, não limite normativo). Premissas conferidas: ${study.verified?'sim':'não'}.`,
    '', 'CARGAS NOVAS E OPERAÇÃO',...study.loads.map((load,i)=>`${i+1}. ${load.name||'sem nome'}: ${n(load.quantity)} x ${n(load.power)} ${{unknown:'(base de potência a confirmar)','input-kw':'kW elétricos','shaft-kw':'kW mecânicos',cv:'cv mecânicos'}[load.unit]}; rendimento ${load.unit==='input-kw'?'não aplicável':n(load.efficiency)}; FP ${n(load.powerFactor)}; utilização ${n(load.utilization)}%; simultaneidade ${n(load.simultaneous)}%; operação ${n(load.start)}h a ${n(load.end)}h.`),
    '', 'RESULTADO E ALTERNATIVAS',
    r.conclusion,
    `Pico bruto modelado: ${n(r.peak?.p??null)} kW / ${n(r.peak?.kva??null)} kVA; hora crítica: ${r.peak===null?'pendente':`${r.peak.hour}h`}. Capacidade de planejamento requerida: ${n(r.requiredKva)} kVA. Referência de um único transformador: ${n(r.reference)} kVA.`,
    r.eligibilityText,...r.guidance,r.metering,...r.issues.map(issue=>`PENDÊNCIA: ${issue}`),
    '', 'METODOLOGIA E PRÓXIMAS AÇÕES',
    'Potência mecânica de motor é convertida para entrada elétrica por rendimento (cv x 0,73549875 / rendimento). Para cada hora, somam-se P e Q indutivo das cargas ativas. S = raiz(P² + Q²). A base atual máxima é mantida em todas as horas como hipótese conservadora; não representa uma curva medida. Horários em horas inteiras, inclusive atravessando a meia-noite.',
    'Capacidade de planejamento = maior S x (1 + margem/100) / (carregamento/100). Crescimento aplica-se à base e às novas cargas; não repetir crescimento já incluído no inventário. Fatores menores que 100% dependem de evidência operacional, não de conveniência tarifária. Catálogo de referência trifásico: 75 a 2.000 kVA, conforme faixas da tabela 10A da NT.00002; confirmar padrão e fabricante.',
    'Não deduz geração solar para reduzir a capacidade necessária. Não calcula partidas de motores, harmônicos, desequilíbrio, demanda faturável de 15 minutos, fluxo reverso, curto-circuito, proteção, queda de tensão, refrigeração ou capacidade individual de cada trafo. Medir e verificar essas condições antes de especificar equipamentos. Não dimensionar por kWh mensal ou reativo excedente.',
    'Comparar custos de manter, substituir ou adicionar transformação e adequar a medição, com orçamentos de obra e 12 meses de tarifas e demanda. Grupo B é enquadramento tarifário, não garantia de ausência de instalação em média tensão. A alternativa mais barata não foi calculada neste módulo. Solicitar estudo/aprovação à distribuidora e projeto com responsabilidade técnica.',
    ...(study.notes.trim()?['','OBSERVAÇÕES',study.notes]:[]), '', 'REFERÊNCIAS',...EXPANSION_SOURCES.map(source=>`${source.title}: ${source.url}`)];
}

export function parseExpansionStudy(value: unknown): ExpansionStudy {
  if (!value || typeof value !== 'object') throw new Error('Estudo inválido.');
  const base=newExpansionStudy(), data=value as Record<string,unknown>;
  if(data.version!==1)throw new Error('Versão de estudo não suportada.');
  const enums: Record<string,string[]>={distributor:['equatorial-pa','other'],connection:['unknown','bt','b-optante','a'],action:['keep','add','replace'],arrangement:['unknown','single-outdoor','multiple-poles','sheltered']};
  for(const [key,defaultValue] of Object.entries(base)) {
    if(key==='loads'||key==='version')continue;
    const v=data[key];
    if(enums[key]){if(typeof v!=='string'||!enums[key].includes(v))throw new Error(`Campo inválido: ${key}`);}
    else if(['scee','localGeneration','remoteCredits'].includes(key)){if(v!==null&&typeof v!=='boolean')throw new Error(`Campo inválido: ${key}`);}
    else if(typeof defaultValue==='string'){if(typeof v!=='string'||v.length>20000)throw new Error(`Campo inválido: ${key}`);}
    else if(typeof defaultValue==='boolean'){if(typeof v!=='boolean')throw new Error(`Campo inválido: ${key}`);}
    else if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0))throw new Error(`Campo inválido: ${key}`);
  }
  if(!Array.isArray(data.loads)||data.loads.length<1||data.loads.length>100)throw new Error('Inventário inválido.');
  const loads=data.loads.map(raw=>{
    if(!raw||typeof raw!=='object')throw new Error('Carga inválida.');
    const item=raw as Record<string,unknown>,clean=newExpansionLoad();
    if(typeof item.name!=='string'||item.name.length>2000||!['unknown','input-kw','shaft-kw','cv'].includes(String(item.unit)))throw new Error('Identificação de carga inválida.');
    for(const key of Object.keys(clean).filter(key=>key!=='name'&&key!=='unit')){const v=item[key];if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0))throw new Error('Número de carga inválido.');}
    for(const key of Object.keys(clean))Object.assign(clean,{[key]:item[key]});return clean;
  });
  const restored={...base};for(const key of Object.keys(base).filter(key=>key!=='loads'))Object.assign(restored,{[key]:data[key]});
  return {...restored,loads,verified:false,grossPeakConfirmed:false,sameUnit:false};
}
