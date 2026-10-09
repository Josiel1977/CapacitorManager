import type { EnergyStudy } from './energy-tariff-diagnosis';
import type { InvoiceAuditResult } from './invoice-audit-result';
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
  const lines = ['RELATÓRIO DE DIAGNÓSTICO ENERGÉTICO', 'Capacitor Manager | JM Eletro Service',
    `Cliente / UC: ${input.client.trim() || 'Não informado'}`, `Emissão: ${input.date}`,
    diagnosis.best ? 'Comparação mensal simulada; confirmar estudo anual antes da contratação.' : 'Diagnóstico preliminar da fatura. Comparação tarifária ainda não concluída.', '', 'DADOS IDENTIFICADOS NA FATURA'];
  if (invoice) {
    lines.push(`Referência: ${invoice.mesReferencia} | Distribuidora: ${invoice.concessionaria}`,
      `Total a pagar: ${money(invoice.valorTotalFatura)}`,
      `Consumo ativo faturado: ${invoice.consumoKwh.toLocaleString('pt-BR')} kWh`,
      `Cobrança reativa identificada: ${money(invoice.totalMultas)}`);
    if (c) lines.push(`Energia compensada: ${c.energia_compensada_kwh.toLocaleString('pt-BR')} kWh`,
      `Parcelamento e encargos de atraso identificados: ${money(c.divida_e_atrasos)}`,
      c.divida_e_atrasos <= invoice.valorTotalFatura ? `Total sem esses itens financeiros: ${money(invoice.valorTotalFatura-c.divida_e_atrasos)}` : 'Conferir valores financeiros: valor identificado superior ao total da conta.');
  } else lines.push('Nenhuma fatura analisada. Importe o PDF para incluir dados comprovados da conta.');
  const details = invoice?.detalhes_fatura;
  if (details) {
    lines.push(`Titular: ${details.cliente ?? 'Não identificado'} | Documento: ${details.documento ?? 'Não identificado'}`,
      `UC: ${details.unidade_consumidora ?? 'Não identificada'} | Endereço: ${details.endereco ?? 'Não identificado'}`,
      `Grupo: ${details.grupo ?? 'Não identificado'} / ${details.subgrupo ?? 'Não identificado'} | Modalidade: ${details.modalidade ?? 'Não identificada'} | Fornecimento: ${details.fornecimento ?? 'Não identificado'}`,
      `Vencimento: ${details.vencimento ?? 'Não identificado'} | Leituras: ${details.leitura_anterior ?? 'Não identificada'} a ${details.leitura_atual ?? 'Não identificada'}`);
  }
  lines.push('', 'RECOMENDAÇÕES E PRÓXIMAS AÇÕES');
  if (c && c.divida_e_atrasos > 0) lines.push(`Separar os ${money(c.divida_e_atrasos)} de dívida/atrasos do custo recorrente de energia. Essa parcela não é economia obtida com capacitores ou troca de tarifa.`);
  if (c && (c.energia_compensada_kwh > 0 || c.gd2)) lines.push('Conferir geração mensal dos inversores, alarmes, autoconsumo e destinação dos créditos. A compensação na fatura não representa toda a produção solar.');
  if (invoice && invoice.totalMultas > 0) lines.push(`Solicitar memória de cálculo da cobrança reativa de ${money(invoice.totalMultas)} e confirmar enquadramento com a distribuidora. Medir fator de potência e harmônicas antes de especificar capacitores. Não dimensionar o banco pelo excedente mensal.`);
  if (study.currentKva !== null || study.futureKva !== null) lines.push(`Transformadores informados: atual ${study.currentKva ?? 'não informado'} kVA; total previsto ${study.futureKva ?? 'não informado'} kVA. Capacidade em kVA não equivale à demanda contratada em kW.`);
  if (study.sameUnit === true && study.futureKva !== null && study.futureKva > 112.5) lines.push('Ampliação informada acima de 112,5 kVA na mesma UC: confirmar com a distribuidora a adequação do enquadramento B-optante com SCEE e as condições de conexão antes da energização.');
  if (diagnosis.bEligibility === 'incompativel') lines.push('O cenário informado não atende aos critérios gerais de B-optante com SCEE. Confirmar condições específicas com a distribuidora.');
  lines.push('Solicitar 12 faturas, projeto homologado da solar, placa dos transformadores e memória de massa. Registrar consumo e demanda por horário e as cargas previstas na ampliação.');
  if (!diagnosis.best) lines.push('Ainda não é possível escolher a modalidade mais econômica. Faltam dados completos e conferidos de consumo/demanda por posto, tarifas e custos residuais da compensação. Não há economia de migração comprovada neste relatório.');
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
    for (const tax of details.tributos) lines.push(`${tax.nome}: base ${money(tax.base)}; alíquota ${tax.aliquota}%; valor ${money(tax.valor)}.`);
    if (details.historico_ativo_injetado.length) {
      lines.push('', 'HISTÓRICO DO GRÁFICO (ATIVO / INJETADO)');
      for (const h of details.historico_ativo_injetado) lines.push(`${h.mes}: ativo ${h.ativo_kwh.toLocaleString('pt-BR')} kWh / injetado ${h.injetado_kwh.toLocaleString('pt-BR')} kWh.`);
      lines.push('Energia injetada do gráfico não é reativo excedente nem produção solar total.');
    }
  }
  lines.push('', 'LIMITES DA ANÁLISE', 'Dados extraídos devem ser conferidos com o PDF original. Produção dos inversores e demanda por posto podem não constar na fatura. O relatório não aprova conexão nem substitui projeto elétrico. Comparações são mensais e não garantem economia.', 'Referências para enquadramento e demanda: Lei 14.300/2022, art. 11; REN ANEEL 1.000/2021, arts. 148, 292 e 301; confirmar versão vigente e condições da distribuidora.');
  return lines;
}
