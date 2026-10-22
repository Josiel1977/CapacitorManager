import type { InvoiceAuditResult } from './invoice-audit-result';
import type { ConsultingStudy, ConsultingMonth, ConsultingMode } from './tariff-consultancy';
import type { EnergyStudy } from './energy-tariff-diagnosis';
import {fillInvoiceScenario,invoiceCurrentMode,invoiceScenarioValues} from './invoice-scenario-import.ts';
import type { ExpansionStudy } from './expansion-study';

const known = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const monthKey = (value: string) => /^\d{2}\/\d{4}$/.test(value) ? `${value.slice(3)}-${value.slice(0,2)}` : '';

export function invoiceStudyFacts(invoice: InvoiceAuditResult) {
  const d=invoice.detalhes_fatura, c=invoice.consultoria;
  const compensatedItem=d?.itens.find(item=>/^Consumo\s+Compensado/i.test(item.descricao));
  const injectedItem=d?.itens.find(item=>/^Energia\s+Ativa\s+Injetada/i.test(item.descricao));
  const compensated=known(compensatedItem?.quantidade) ?? ((invoice.contexto_energetico?.energia_compensada_kwh??0)>0 ? invoice.contexto_energetico!.energia_compensada_kwh : null);
  const injected=known(c?.energia_injetada_kwh) ?? known(injectedItem?.quantidade);
  const gd=Boolean(invoice.contexto_energetico?.gd2 || (compensated??0)>0 || (injected??0)>0 || d?.itens.some(item=>/SCEE|Energia\s+Ativa\s+Injetada/i.test(item.descricao)));
  const bOptante=Boolean(invoice.contexto_energetico?.b_optante);
  const fmt=(value:number|null)=>value===null?'não identificada':value.toLocaleString('pt-BR');
  const summary=`Origem: auditoria da fatura ${invoice.mesReferencia}; cliente ${d?.cliente??'não identificado'}; UC ${d?.unidade_consumidora??'não identificada'}. Consumo faturado: ${fmt(known(invoice.consumoKwh))} kWh. Energia injetada na rede: ${fmt(injected)} kWh. Energia compensada: ${fmt(compensated)} kWh. Injeção e compensação são informações distintas; nenhuma representa a geração solar total. Valores ausentes não foram convertidos em zero. Conferir com o PDF original.`;
  return {client:d?.cliente??'',uc:d?.unidade_consumidora??'',distributor:invoice.concessionaria==='EQUATORIAL_PARA'?'EQUATORIAL PA':'',subgroup:bOptante?'B-optante':d?.subgrupo??'',gd,bOptante,compensated,injected,summary,
    peakKw:c?.demanda_ponta_identificada?known(invoice.demanda_ponta_kw):null,
    offPeakKw:c?.demanda_fora_identificada?known(invoice.demanda_fora_ponta_kw):null};
}

export function tariffStudyFromInvoice(base: ConsultingStudy, invoice: InvoiceAuditResult): ConsultingStudy {
  const f=invoiceStudyFacts(invoice),d=invoice.detalhes_fatura,c=invoice.consultoria;
  const blank=(month:string):ConsultingMonth=>({month,peakKwh:null,offPeakKwh:null,intermediateKwh:null,peakKw:null,offPeakKw:null,reactiveCost:null,injectedKwh:null,compensatedKwh:null});
  const hasPosts=d?.grupo==='A' && !f.bOptante && !f.gd;
  const months=invoice.historico_mensal.map(h=>({...blank(monthKey(h.mes_referencia)),peakKwh:hasPosts?known(h.consumo_ponta_kwh):null,offPeakKwh:hasPosts?known(h.consumo_fora_ponta_kwh):null,intermediateKwh:hasPosts?0:null,peakKw:known(h.demanda_ponta_kw),offPeakKw:known(h.demanda_fora_ponta_kw)}));
  const currentMonth=monthKey(invoice.mes_referencia);
  if(!months.some(m=>m.month===currentMonth))months.unshift(blank(currentMonth));
  for(const m of months)if(m.month===currentMonth){
    m.reactiveCost=known(invoice.penalidade_reativa_informada);m.injectedKwh=f.injected;m.compensatedKwh=f.compensated;
    // Uma conta monômia não comprova consumo por posto, mesmo sem GD.
    m.peakKwh=hasPosts?known(invoice.consumo_ponta_kwh):null;
    m.offPeakKwh=hasPosts?known(invoice.consumo_fora_ponta_kwh):null;
    m.intermediateKwh=hasPosts?0:null;
    m.peakKw=f.peakKw??m.peakKw;m.offPeakKw=f.offPeakKw??m.offPeakKw;
  }
  const code=d?.modalidade?.toUpperCase()??'';
  const current:ConsultingMode=f.bOptante||d?.grupo==='B'?'convencional':code.includes('AZUL')?'azul':'verde';
  return {...base,client:f.client,uc:f.uc,distributor:f.distributor,subgroup:f.subgroup,current,gd:f.gd,gdVerified:false,alternativesApproved:false,reviewed:false,
    months:months.slice(0,12),contractedOffPeak:c?.contratada_unica_kw??c?.contratada_fora_kw??null,contractedPeak:c?.contratada_ponta_kw??null,
    notes:`${f.summary}\nCódigo da modalidade: ${d?.modalidade??'não identificado'}. Confirmar modalidade, tarifas e enquadramento; não presumir tarifa de demanda a partir de benefícios. Consumo por posto permanece pendente quando houver SCEE ou conta monômia.`};
}

export function expansionStudyFromInvoice(base: ExpansionStudy, invoice: InvoiceAuditResult): ExpansionStudy {
  const f=invoiceStudyFacts(invoice);
  return {...base,client:f.client,uc:f.uc,distributor:invoice.concessionaria==='EQUATORIAL_PARA'?'equatorial-pa':'other',
    connection:f.bOptante?'b-optante':invoice.detalhes_fatura?.grupo==='A'?'a':'unknown',
    scee:f.gd?true:null,localGeneration:null,remoteCredits:null,sameUnit:false,grossPeakConfirmed:false,verified:false,
    notes:`${f.summary}\nA fatura não comprova capacidade dos transformadores, pico bruto sem geração, fator de potência ou novas cargas. Completar inventário e medições; não usar kWh nem descontar injeção para dimensionar a transformação.`};
}

export function energyStudyFromInvoice(base: EnergyStudy, invoice: InvoiceAuditResult): EnergyStudy {
  const f=invoiceStudyFacts(invoice),c=invoice.consultoria;
  const currentMode=invoiceCurrentMode(invoice);
  const extracted=invoiceScenarioValues(invoice,currentMode);
  const hasPosts=invoice.detalhes_fatura?.grupo==='A'&&!f.gd&&!f.bOptante;
  return {...base,confirmed:false,tariffSource:currentMode&&extracted.reconciled&&extracted.values.length?extracted.source:base.tariffSource,netPeakKwh:hasPosts?known(invoice.consumo_ponta_kwh):null,netOffPeakKwh:hasPosts?known(invoice.consumo_fora_ponta_kwh):null,
    measuredPeakKw:f.peakKw,measuredOffPeakKw:f.offPeakKw,
    scenarios:base.scenarios.map(s=>({...((s.mode===currentMode)?fillInvoiceScenario(s,invoice):s),contractedPeak:s.mode==='A-azul'?c?.contratada_ponta_kw??null:s.contractedPeak,
      contractedOffPeak:s.mode==='A-verde'?c?.contratada_unica_kw??null:s.mode==='A-azul'?c?.contratada_fora_kw??null:s.contractedOffPeak}))};
}
