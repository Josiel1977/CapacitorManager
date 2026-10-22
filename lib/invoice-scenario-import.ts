import type {InvoiceAuditResult} from './invoice-audit-result';
import type {InvoiceDetails} from './invoice-details';
import type {Mode,TariffScenario} from './energy-tariff-diagnosis';
type Item=InvoiceDetails['itens'][number];
type NumericField=Exclude<keyof TariffScenario,'mode'|'contractedPeak'|'contractedOffPeak'>;
export interface InvoiceScenarioValue {field:NumericField;label:string;value:number;unit:string;source:string;}
const normalized=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const valid=(v:number|null):v is number=>v!==null&&Number.isFinite(v)&&v>=0;
export function invoiceCurrentMode(invoice:InvoiceAuditResult):Mode|null {
 if(invoice.contexto_energetico?.b_optante)return 'B-optante';
 if(invoice.detalhes_fatura?.grupo!=='A')return null;
 const code=normalized(invoice.detalhes_fatura.modalidade??'');
 const green=/\bVERDE\b|_VERDE/.test(code),blue=/\bAZUL\b|_AZUL/.test(code);
 if(green&&!blue)return 'A-verde';
 if(blue&&!green)return 'A-azul';
 return null;
}
export function invoiceScenarioValues(invoice:InvoiceAuditResult,mode:Mode|null){
 const reconciled=invoice.detalhes_fatura?.soma_itens!==null&&invoice.detalhes_fatura?.soma_itens!==undefined&&Math.abs(invoice.detalhes_fatura.soma_itens-invoice.valorTotalFatura)<0.02;
 const items=invoice.detalhes_fatura?.itens??[],values:InvoiceScenarioValue[]=[],pending:string[]=[];
 const add=(field:NumericField,label:string,value:number,unit:string,source:string)=>values.push({field,label,value,unit,source});
 const moneyGroup=(field:'gdCharge'|'otherCharges',label:string,selected:Item[])=>{
  if(!selected.length){pending.push(`${label}: nenhum item explícito identificado; não foi presumido zero.`);return;}
  if(selected.some(item=>!valid(item.valor))){pending.push(`${label}: há crédito ou valor inválido; conferir a composição antes de preencher.`);return;}
  add(field,label,Math.round(selected.reduce((total,item)=>total+item.valor,0)*100)/100,'R$/mês',selected.map(item=>`${item.descricao}: R$ ${item.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}`).join('; '));
 };
 if(!reconciled)pending.push('Conciliação pendente: a soma dos itens não confere com o total. Corrija a extração antes de importar valores.');
 // Apenas subtotais positivos explicitamente identificados; nunca total líquido menos dívida.
 moneyGroup('otherCharges','Custos recorrentes identificados',items.filter(item=>/^(?:CIP\b|ADICIONAL\s+BANDEIRA\b|CONSUMO\s+REATIVO\s+EXCEDENTE\b|ENCARGO\s+ESCASSEZ\s+HIDRICA\b)/.test(normalized(item.descricao))));
 moneyGroup('gdCharge','Residual GD identificado',items.filter(item=>/^PARC\.\s*INJ\./.test(normalized(item.descricao))));
 if(mode==='B-optante'){
  const candidates=items.filter(item=>/^CONSUMO\s*\(KWH\)$/.test(normalized(item.descricao)));
  if(candidates.length===1&&valid(candidates[0].valor)&&valid(candidates[0].tarifa_com_tributos)&&candidates[0].tarifa_com_tributos>0)add('energyOffPeak','Energia monômia',candidates[0].tarifa_com_tributos,'R$/kWh',`${candidates[0].descricao}; tarifa com tributos explícita`);
  else pending.push('Energia monômia: tarifa com tributos ausente ou mais de uma linha; conferir a fatura.');
 }else if(mode){
  for(const [post,field] of [['FORA PONTA','energyOffPeak'],['PONTA','energyPeak']] as const){
   const description=(prefix:string)=>new RegExp(`^${prefix}\\s+ENERGIA\\s+${post}\\s*\\(KWH\\)$`);
   const te=items.filter(item=>description('TE').test(normalized(item.descricao))),tusd=items.filter(item=>description('TUSD').test(normalized(item.descricao)));
   if(te.length===1&&tusd.length===1&&valid(te[0].valor)&&valid(tusd[0].valor)&&valid(te[0].tarifa_com_tributos)&&valid(tusd[0].tarifa_com_tributos)&&valid(te[0].quantidade)&&valid(tusd[0].quantidade)&&Math.abs(te[0].quantidade-tusd[0].quantidade)<0.02){
    const rate=te[0].tarifa_com_tributos+tusd[0].tarifa_com_tributos;
    if(rate>0)add(field,`TE + TUSD ${post.toLocaleLowerCase('pt-BR')}`,Math.round(rate*1e9)/1e9,'R$/kWh',`${te[0].descricao} + ${tusd[0].descricao}; tarifas com tributos; quantidades compatíveis`);
   }else pending.push(`Energia ${post.toLocaleLowerCase('pt-BR')}: falta TE + TUSD com tributos e quantidades compatíveis. TUSD isolada não é a tarifa completa.`);
  }
  const demandRows=items.filter(item=>/^DEMANDA(?:\s+(?:ATIVA|UNICA|CONTRATADA))?(?:\s+(?:FORA\s+PONTA|PONTA|FP|NP))?\s*\(KW\)$/.test(normalized(item.descricao)));
  const readDemand=(field:'demandPeak'|'demandOffPeak',rows:Item[])=>{
   if(rows.length===1&&valid(rows[0].valor)&&valid(rows[0].tarifa_com_tributos)&&rows[0].tarifa_com_tributos>0)add(field,field==='demandPeak'?'Demanda ponta':'Demanda única / fora de ponta',rows[0].tarifa_com_tributos,'R$/kW',`${rows[0].descricao}; tarifa com tributos explícita`);
   else pending.push(`${field==='demandPeak'?'Demanda ponta':'Demanda única / fora de ponta'}: tarifa com tributos ausente ou ambígua.`);
  };
  const isOff=(item:Item)=>/FORA\s+PONTA|\bFP\b/.test(normalized(item.descricao));
  const isPeak=(item:Item)=>!isOff(item)&&/\bPONTA\b|\bNP\b/.test(normalized(item.descricao));
  readDemand('demandOffPeak',demandRows.filter(item=>mode==='A-verde'?!isPeak(item):isOff(item)));
  if(mode==='A-azul')readDemand('demandPeak',demandRows.filter(isPeak));
 }
 if(!mode)pending.push('Confirme a modalidade atual: o código da fatura não permite selecionar Verde, Azul ou B-optante com segurança.');
 return {mode,reconciled,values,pending,source:`Fatura ${invoice.mesReferencia} / ${invoice.concessionaria}; modalidade ${mode??'a confirmar'}; valores explícitos com tributos. Importação preliminar, sujeita à conferência; não são tarifas das modalidades alternativas.`};
}
export function fillInvoiceScenario(scenario:TariffScenario,invoice:InvoiceAuditResult){
 const detected=invoiceCurrentMode(invoice);
 if(detected&&detected!==scenario.mode)return {...scenario};
 const extracted=invoiceScenarioValues(invoice,scenario.mode),filled={...scenario};
 if(!extracted.reconciled)return filled;
 for(const value of extracted.values)if(filled[value.field]===null)filled[value.field]=value.value;
 return filled;
}
