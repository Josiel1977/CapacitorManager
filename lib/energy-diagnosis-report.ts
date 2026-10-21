import type { EnergyStudy } from './energy-tariff-diagnosis';
import type { InvoiceAuditResult } from './invoice-audit-result';
import { reviewInvoiceCharges } from './invoice-charge-review.ts';
import { invoiceStudyFacts } from './audit-study-import.ts';
export interface DiagnosisReportInput {
  client: string;
  notes: string;
  date: string;
  study: EnergyStudy;
  invoice?: InvoiceAuditResult;
  diagnosis: {
    bEligibility: string;
    conclusion: string;
    best: string | null;
    results: Array<{ mode: string; eligible: boolean; total: number | null; energy: number | null; demand: number | null; excess: number | null }>;
  };
}
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function buildEnergyDiagnosisReport(input: DiagnosisReportInput): string[] {
  const { invoice, study, diagnosis } = input;
  const c = invoice?.contexto_energetico;
  const details = invoice?.detalhes_fatura;
  const charges = details && invoice ? reviewInvoiceCharges(details, invoice.valorTotalFatura) : null;
  const hasSolarEvidence = !!(c?.gd2 || c?.energia_compensada_kwh || invoice?.consultoria?.energia_injetada_kwh || details?.itens.some(item => /SCEE|Injetada/i.test(item.descricao)));
  const lines = ['RELATÓRIO DE DIAGNÓSTICO ENERGÉTICO', 'Capacitor Manager | JM Eletro Service',
    `Cliente / UC: ${input.client.trim() || 'Não informado'}`, `Emissão: ${input.date}`,
    diagnosis.best ? 'Comparação mensal simulada; confirmar estudo anual antes da contratação.' : 'Diagnóstico preliminar da fatura. Comparação tarifária ainda não concluída.', '', 'DADOS IDENTIFICADOS NA FATURA'];
  if (invoice) {
    lines.push(`Referência: ${invoice.mesReferencia} | Distribuidora: ${invoice.concessionaria}`,
      `Total a pagar: ${money(invoice.valorTotalFatura)}`,
      `Consumo ativo faturado: ${invoice.consumoKwh.toLocaleString('pt-BR')} kWh`,
      `Cobrança reativa identificada: ${money(invoice.totalMultas)}`);
    const facts = invoiceStudyFacts(invoice);
    lines.push(facts.injected===null ? 'Energia injetada na rede: não identificada.' : `Energia injetada na rede identificada: ${facts.injected.toLocaleString('pt-BR')} kWh`, 'Energia injetada, compensação e geração total são grandezas distintas; a geração total não foi inferida.');
    if (c) lines.push(c.energia_compensada_kwh > 0 ? `Energia compensada identificada: ${c.energia_compensada_kwh.toLocaleString('pt-BR')} kWh` : 'Energia compensada: não identificada; isso não comprova ausência de geração solar.');
    if (charges) {
      lines.push(`Multas, juros e correções identificados (débitos): ${money(charges.financialCharges)}`,
        `Parcelas de dívida ou acordo identificadas (débitos): ${money(charges.debtInstallments)}`,
        charges.reconciled ? 'Conciliação: soma dos itens confere com o total da fatura; origem e cálculo ainda sujeitos à validação.' : 'CONCILIAÇÃO PENDENTE: extração incompleta ou divergente. Não utilizar o total líquido como custo recorrente de energia.',
        'Valor zero significa nenhum débito positivo identificado nesta categoria, não ausência comprovada da cobrança.');
    }
  } else lines.push('Nenhuma fatura analisada. Importe o PDF para incluir dados comprovados da conta.');
  if (details) {
    lines.push(`Titular: ${details.cliente ?? 'Não identificado'} | Documento: ${details.documento ?? 'Não identificado'}`,
      `UC: ${details.unidade_consumidora ?? 'Não identificada'} | Endereço: ${details.endereco ?? 'Não identificado'}`,
      `Grupo: ${details.grupo ?? 'Não identificado'} / ${details.subgrupo ?? 'Não identificado'}${c?.b_optante?' | Faturamento: B-optante':''} | Modalidade: ${details.modalidade ?? 'Não identificada'} | Fornecimento: ${details.fornecimento ?? 'Não identificado'}`,
      `Vencimento: ${details.vencimento ?? 'Não identificado'} | Leituras: ${details.leitura_anterior ?? 'Não identificada'} a ${details.leitura_atual ?? 'Não identificada'}`);
  }
  if (invoice?.consultoria) {
    const demand = invoice.consultoria;
    const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    lines.push('', 'DEMANDA CONTRATADA E HISTÓRICO IDENTIFICADO');
    if (demand.contratada_unica_kw !== null) lines.push(`Demanda contratada única: ${number(demand.contratada_unica_kw)} kW.`);
    if (demand.contratada_ponta_kw !== null) lines.push(`Demanda contratada na ponta: ${number(demand.contratada_ponta_kw)} kW.`);
    if (demand.contratada_fora_kw !== null) lines.push(`Demanda contratada fora de ponta: ${number(demand.contratada_fora_kw)} kW.`);
    lines.push(`Máxima medida no mês - ponta: ${demand.demanda_ponta_identificada ? number(invoice.demanda_ponta_kw) : 'não identificada'} kW; fora de ponta: ${demand.demanda_fora_identificada ? number(invoice.demanda_fora_ponta_kw) : 'não identificada'} kW.`);
    const history = invoice.historico_mensal.filter(item => item.demanda_ponta_kw !== undefined && item.demanda_fora_ponta_kw !== undefined);
    if (history.length) {
      const largest = Math.max(...history.flatMap(item => [item.demanda_ponta_kw!, item.demanda_fora_ponta_kw!]));
      lines.push(`Histórico disponível: ${history.length} meses; maior demanda medida entre os postos: ${number(largest)} kW.`,
        ['Histórico de demanda por mês (ponta / fora de ponta):',...history.map(month=>`${month.mes_referencia}: ${number(month.demanda_ponta_kw!)} / ${number(month.demanda_fora_ponta_kw!)} kW.`)].join('\n'));
      if (demand.contratada_unica_kw !== null && largest < demand.contratada_unica_kw) lines.push(`Diferença entre o contrato atual e a maior demanda do histórico: ${number(demand.contratada_unica_kw - largest)} kW. Isso não é economia comprovada nem recomendação de redução; confirmar contratos vigentes em cada mês, completar 12 meses e considerar a expansão.`);
    }
  }
  const adjustments = details?.itens.filter(item => /Devolu[çc][ãa]o\s+de\s+ajuste|Benef[íi]cio\s+Tarif[áa]rio/i.test(item.descricao)) ?? [];
  if (adjustments.length) {
    lines.push('', 'AJUSTES E BENEFÍCIOS QUE AFETAM O TOTAL');
    for (const item of adjustments) lines.push(`${item.descricao}: ${money(item.valor)}.`);
    lines.push('O total líquido deste mês inclui ajustes e benefícios. Não o utilizar isoladamente como custo mensal típico, nem como base para prometer economia. Confirmar com a distribuidora a origem, o período e a continuidade de cada item. Benefício tarifário sem identificação de SCEE não comprova geração solar ou enquadramento no mercado livre.');
  }
  lines.push('', 'RECOMENDAÇÕES E PRÓXIMAS AÇÕES');
  if (charges) for (const item of charges.items.filter(item => item.kind !== 'outro')) lines.push(`${item.description}: ${money(item.amount)}. Conferir: ${item.evidence} Ação: ${item.action}`);
  if (c && (c.energia_compensada_kwh > 0 || c.gd2)) lines.push('Conferir geração mensal dos inversores, alarmes, autoconsumo e destinação dos créditos. A compensação na fatura não representa toda a produção solar.');
  if (invoice && invoice.totalMultas > 0) lines.push(`Solicitar memória de cálculo da cobrança reativa de ${money(invoice.totalMultas)} e confirmar enquadramento com a distribuidora. Medir fator de potência e harmônicas antes de especificar capacitores. Não dimensionar o banco pelo excedente mensal.`);
  if (study.currentKva !== null || study.futureKva !== null) lines.push(`Transformadores informados: atual ${study.currentKva ?? 'não informado'} kVA; total previsto ${study.futureKva ?? 'não informado'} kVA. Capacidade em kVA não equivale à demanda contratada em kW.`);
  if (study.sameUnit === true && study.futureKva !== null && study.futureKva > 112.5) lines.push('Ampliação informada acima de 112,5 kVA na mesma UC: confirmar com a distribuidora a adequação do enquadramento B-optante com SCEE e as condições de conexão antes da energização.');
  if (diagnosis.bEligibility === 'incompativel') lines.push('O cenário informado não atende aos critérios gerais de B-optante com SCEE. Confirmar condições específicas com a distribuidora.');
  lines.push(`Solicitar 12 faturas, contratos de fornecimento e uso da rede, placa dos transformadores e memória de massa.${hasSolarEvidence ? ' Solicitar o projeto homologado da geração solar.' : ' Confirmar se há geração própria; solicitar o projeto homologado somente se aplicável.'} Registrar consumo e demanda por horário e as cargas previstas na ampliação.`);
  if (details?.itens.some(item => /TUSD\s+Energia/i.test(item.descricao))) lines.push('A fatura discrimina TUSD de energia. Confirmar o regime de contratação e se a compra de energia é faturada separadamente; incluir todos os contratos e contas antes de comparar o custo total. Não presumir mercado livre somente pela sigla da modalidade.');
  if (!diagnosis.best) lines.push('Ainda não é possível escolher a modalidade mais econômica. Faltam dados completos e conferidos de consumo/demanda por posto, tarifas e, quando aplicáveis, custos residuais da compensação. Não há economia de migração comprovada neste relatório.');
  const complete = diagnosis.results.filter(r=>r.total!==null);
  if (complete.length) {
    lines.push('', 'COMPARAÇÃO MENSAL SIMULADA');
    for (const r of complete) lines.push(`${r.mode}${r.eligible?'':' (elegibilidade não confirmada)'}: energia ${money(r.energy!)}; demanda ${money(r.demand!)}; ultrapassagem ${money(r.excess!)}; total ${money(r.total!)}.`);
    lines.push(diagnosis.conclusion, `Fonte e vigência das tarifas: ${study.tariffSource || 'Não informadas'}`, `Dados conferidos: ${study.confirmed?'sim':'não'}`,
      `Consumo líquido ponta / fora: ${study.netPeakKwh ?? 'não informado'} / ${study.netOffPeakKwh ?? 'não informado'} kWh. Demanda medida ponta / fora: ${study.measuredPeakKw ?? 'não informado'} / ${study.measuredOffPeakKw ?? 'não informado'} kW.`);
    for (const s of study.scenarios.filter(s=>complete.some(r=>r.mode===s.mode))) lines.push(`${s.mode}: energia ponta/fora ${s.energyPeak??'não aplicável'} / ${s.energyOffPeak??'não informada'} R$/kWh; demanda contratada ponta/fora ${s.contractedPeak??'não aplicável'} / ${s.contractedOffPeak??'não aplicável'} kW; tarifa demanda ponta/fora ${s.demandPeak??'não aplicável'} / ${s.demandOffPeak??'não aplicável'} R$/kW; encargos GD ${s.gdCharge===null?'não informado':money(s.gdCharge)}; demais custos ${s.otherCharges===null?'não informado':money(s.otherCharges)}.`);
  }
  if (input.notes.trim()) lines.push('', 'OBSERVAÇÕES DO RESPONSÁVEL', input.notes.trim());
  if (details) {
    lines.push('', 'DEMONSTRATIVO DA FATURA');
    for (const item of details.itens) lines.push(`${item.descricao}: ${money(item.valor)}${item.quantidade===null?'':`; quantidade ${item.quantidade.toLocaleString('pt-BR')}; tarifa com/sem tributos ${item.tarifa_com_tributos} / ${item.tarifa_sem_tributos}`}${item.pis_cofins===null?'':`; PIS/COFINS ${money(item.pis_cofins)}`}${item.icms===null?'':`; ICMS ${money(item.icms)}`}.`);
    if (details.soma_itens !== null) lines.push(`Soma dos itens: ${money(details.soma_itens)}. ${Math.abs(details.soma_itens-invoice!.valorTotalFatura)<0.02?'Conciliada com o total.':'Divergente do total: conferir o original.'}`);
    lines.push('Tributos demonstrativos já integram os itens; não somar novamente.');
    if(details.tributos.length)lines.push('TRIBUTOS DEMONSTRATIVOS',details.tributos.map(tax=>`${tax.nome}: base ${money(tax.base)}; alíquota ${tax.aliquota}%; valor ${money(tax.valor)}.`).join('\n'));
    if (details.historico_ativo_injetado.length) {
      lines.push('', 'HISTÓRICO DO GRÁFICO (ATIVO / INJETADO)');
      lines.push(details.historico_ativo_injetado.map(h=>`${h.mes}: ativo ${h.ativo_kwh.toLocaleString('pt-BR')} kWh / injetado ${h.injetado_kwh.toLocaleString('pt-BR')} kWh.`).join('\n'));
      lines.push('Energia injetada do gráfico não é reativo excedente nem produção solar total.');
    }
  }
  lines.push('', 'LIMITES DA ANÁLISE', 'Dados extraídos devem ser conferidos com o PDF original. Produção dos inversores e demanda por posto podem não constar na fatura. O relatório não aprova conexão nem substitui projeto elétrico. Comparações são mensais e não garantem economia.', 'Referências para enquadramento e demanda: Lei 14.300/2022, art. 11; REN ANEEL 1.000/2021, arts. 148, 292 e 301; confirmar versão vigente e condições da distribuidora.');
  return lines;
}
