export const ANEEL_DATASET = 'https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica';
export const ANEEL_RESOURCE = 'fcf2906c-7c32-4b9b-a637-054e7a5234f4';
export interface OfficialTariff {
  id: string; agent: string; cnpj: string; subgroup: string; mode: string; classification: string;
  subclass: string; detail: string; accessAgent: string; station: string; unit: 'R$/kWh' | 'R$/kW';
  tusd: number; te: number; total: number; start: string; end: string; resolution: string; generated: string;
}
export function validDate(date: string) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10)===date; }
const text = (r:Record<string,unknown>,key:string)=>typeof r[key]==='string'?r[key] as string:'';
function decimal(value:unknown) {
  if(typeof value==='number') return Number.isFinite(value)&&value>=0?value:null;
  if(typeof value!=='string' || !/^\d*(?:,\d+|\.\d+)?$/.test(value.trim()) || !value.trim()) return null;
  const n=Number(value.replace(',','.'));return Number.isFinite(n)&&n>=0?n:null;
}
export function normalizeTariff(r:Record<string,unknown>):OfficialTariff|null {
  if(text(r,'DscBaseTarifaria')!=='Tarifa de Aplicação')return null;
  const unit=text(r,'DscUnidadeTerciaria').replace(/\s/g,'');
  const factor=/^(?:R\$\/)?MWh$/i.test(unit)?0.001:/^(?:R\$\/)?(?:kWh|kW)$/i.test(unit)?1:null;
  const tusd=decimal(r.VlrTUSD),te=decimal(r.VlrTE);
  if(factor===null || tusd===null || te===null)return null;
  return {id:String(r._id),agent:text(r,'SigAgente'),cnpj:text(r,'NumCNPJDistribuidora'),subgroup:text(r,'DscSubGrupo'),mode:text(r,'DscModalidadeTarifaria'),classification:text(r,'DscClasse'),subclass:text(r,'DscSubClasse'),detail:text(r,'DscDetalhe'),accessAgent:text(r,'SigAgenteAcessante'),station:text(r,'NomPostoTarifario'),unit:/kW$/i.test(unit)?'R$/kW':'R$/kWh',tusd:tusd*factor,te:te*factor,total:(tusd+te)*factor,start:text(r,'DatInicioVigencia'),end:text(r,'DatFimVigencia'),resolution:text(r,'DscREH'),generated:text(r,'DatGeracaoConjuntoDados')};
}
export function tariffQuery(agent:string,subgroup:string,date:string) {
  if(!agent.trim()||agent.length>80||!['A1','A2','A3','A3a','A4','AS','B1','B2','B3','B4a','B4b','B4'].includes(subgroup)||!validDate(date))throw new Error('Distribuidora, subgrupo ou data inválidos.');
  return new URLSearchParams({resource_id:ANEEL_RESOURCE,filters:JSON.stringify({SigAgente:agent,DscSubGrupo:subgroup,DscBaseTarifaria:'Tarifa de Aplicação'}),limit:'10000'});
}
