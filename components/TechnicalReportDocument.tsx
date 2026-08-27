'use client';

import type { ReactNode } from 'react';
import { Zap } from 'lucide-react';
import type { BankAssessmentStatus, BankReportSummary } from '@/lib/bank-report';
import { packBankSections } from '@/lib/bank-report';
import { paginateBalanced } from '@/lib/balanced-pagination';

const PAGE_WIDTH_PX = 794;
const PAGE_HEIGHT_PX = 1122;
const BANKS_PER_SUMMARY_PAGE = 8;
const CLIENT_BANKS_PER_SUMMARY_PAGE = 7;
const MEASUREMENTS_PER_PAGE = 18;

function number(value: unknown, decimals = 2): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(decimals) : '---';
}

function deviation(value: unknown): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '---';
  return `${parsed > 0 ? '+' : ''}${parsed.toFixed(2)}%`;
}

function formatDate(value: unknown): string {
  if (!value) return 'Sem medição';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 'Data inválida' : date.toLocaleDateString('pt-BR');
}

function measuredValue(measurement: any): string {
  return measurement.tipo_teste === 'corrente'
    ? `${number(measurement.corrente_medida_a)} A`
    : `${number(measurement.capacitancia_medida_uf)} µF`;
}

function theoreticalValue(measurement: any): string {
  return measurement.tipo_teste === 'corrente'
    ? `${number(measurement.corrente_teorica_a)} A`
    : `${number(measurement.capacitancia_teorica_uf)} µF`;
}

function statusStyle(status: BankAssessmentStatus | string) {
  if (status === 'aprovado') return { label: 'APROVADO', color: '#047857', background: '#ecfdf5' };
  if (status === 'reprovado') return { label: 'REPROVADO', color: '#b91c1c', background: '#fef2f2' };
  if (status === 'atencao') return { label: 'ATENÇÃO', color: '#b45309', background: '#fffbeb' };
  return { label: 'SEM AVALIAÇÃO', color: '#475569', background: '#f1f5f9' };
}

function coverageStyle(bank: BankReportSummary) {
  if (bank.totalCapacitores === 0) return { label: 'Sem componentes', color: '#475569', background: '#f1f5f9' };
  if (bank.coberturaPercentual >= 100) return { label: 'Completa', color: '#047857', background: '#ecfdf5' };
  if (bank.coberturaPercentual > 0) return { label: 'Parcial', color: '#1d4ed8', background: '#eff6ff' };
  return { label: 'Pendente', color: '#475569', background: '#f1f5f9' };
}

function projectionLabel(trend: any): string {
  if (!trend) return 'Sem tendência';
  if (trend.previsao) return `≈ ${number(trend.previsao.meses, 1)} meses`;
  if (trend.statusProjecao === 'historico_insuficiente') return 'Histórico insuficiente';
  if (trend.statusProjecao === 'correlacao_fraca') return 'Sem correlação';
  if (trend.statusProjecao === 'horizonte_excedido') return 'Além de 36 meses';
  if (trend.statusProjecao === 'limite_atual') return 'Limite já atingido';
  return 'Estável / monitorar';
}

function trendLabel(trend: any): string {
  if (!trend) return 'Sem tendência';
  if (trend.tendencia === 'piorando') return 'Piora';
  if (trend.tendencia === 'melhorando') return 'Melhora';
  return 'Estável';
}

function trendStyle(trend: any) {
  if (!trend) return { color: '#475569', background: '#f1f5f9' };
  if (trend.tendencia === 'piorando') return { color: '#b91c1c', background: '#fef2f2' };
  if (trend.tendencia === 'melhorando') return { color: '#047857', background: '#ecfdf5' };
  return { color: '#475569', background: '#f1f5f9' };
}

function projectionStyle(trend: any) {
  if (!trend) return { color: '#475569', background: '#f1f5f9' };
  if (trend.statusProjecao === 'limite_atual') return { color: '#b91c1c', background: '#fef2f2' };
  if (trend.statusProjecao === 'disponivel') return { color: '#b45309', background: '#fffbeb' };
  if (trend.statusProjecao === 'historico_insuficiente') return { color: '#1d4ed8', background: '#eff6ff' };
  return { color: '#475569', background: '#f1f5f9' };
}

function Page({
  children,
  page,
  total,
  clientName,
  date,
  title,
}: {
  children: ReactNode;
  page: number;
  total: number;
  clientName: string;
  date: string;
  title: string;
}) {
  return (
    <section
      data-pdf-page
      className="relative flex flex-col overflow-hidden bg-white text-slate-800 shadow-xl"
      style={{ width: `${PAGE_WIDTH_PX}px`, height: `${PAGE_HEIGHT_PX}px` }}
    >
      <header className="flex shrink-0 items-center justify-between border-b-4 border-[#eab308] bg-slate-900 px-10 py-5 text-white">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#eab308] p-2 text-slate-900"><Zap size={24} /></div>
          <div>
            <p className="text-xl font-black tracking-tight">CAPACITOR<span className="text-[#eab308]">MANAGER</span></p>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">{title}</p>
          </div>
        </div>
        <div className="max-w-[280px] text-right text-[10px]">
          <p className="truncate font-bold text-white">{clientName}</p>
          <p className="text-slate-400">Emissão: {date}</p>
        </div>
      </header>

      <main className="min-h-0 flex-1 px-10 py-7">{children}</main>

      <footer className="flex shrink-0 items-center justify-between border-t border-slate-200 px-10 py-4 text-[9px] text-slate-500">
        <span>JM Eletro Service · Relatório técnico gerado pelo CapacitorManager</span>
        <span className="font-bold text-slate-700">Página {page} de {total}</span>
      </footer>
    </section>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-5 border-b-2 border-[#eab308] pb-2 text-sm font-black uppercase tracking-widest text-slate-800">{children}</h2>;
}

function StatusPill({ status }: { status: BankAssessmentStatus | string }) {
  const style = statusStyle(status);
  return (
    <span className="inline-block rounded-full px-2 py-1 text-[7px] font-black" style={{ color: style.color, backgroundColor: style.background }}>
      {style.label}
    </span>
  );
}

function BankDetail({ bank }: { bank: BankReportSummary }) {
  const bankStatus = statusStyle(bank.status);
  const coverage = coverageStyle(bank);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-black">{bank.nomeBanco}</h3>
          <p className="truncate text-[8px] text-slate-400">
            {bank.localizacao || 'Localização não informada'} · {bank.tensaoNominal ? `${number(bank.tensaoNominal, 0)} V` : 'Tensão não informada'} · {number(bank.potenciaCadastradaKvar, 1)} kVAr cadastrados
          </p>
        </div>
        <div className="ml-4 flex shrink-0 items-center gap-2">
          <span className="rounded px-2 py-1 text-[7px] font-black" style={{ color: bankStatus.color, backgroundColor: bankStatus.background }}>{bankStatus.label}</span>
          <span className="rounded px-2 py-1 text-[7px] font-black" style={{ color: coverage.color, backgroundColor: coverage.background }}>{coverage.label} {number(bank.coberturaPercentual, 0)}%</span>
        </div>
      </div>

      {bank.capacitores.length > 0 ? (
        <table className="w-full table-fixed text-left text-[8px]">
          <thead>
            <tr className="bg-slate-100 text-[7px] font-black uppercase tracking-wide text-slate-500">
              <th className="w-[17%] px-2 py-2">Capacitor</th>
              <th className="w-[10%] px-2 py-2">kVAr</th>
              <th className="w-[20%] px-2 py-2">Condição atual</th>
              <th className="w-[13%] px-2 py-2">Desvio</th>
              <th className="w-[15%] px-2 py-2">Tendência</th>
              <th className="w-[25%] px-2 py-2">Confiança / projeção</th>
            </tr>
          </thead>
          <tbody>
            {bank.capacitores.map((capacitor) => {
              const measurement = capacitor.ultimaMedicao as any;
              const direction = trendStyle(capacitor.tendencia);
              const projection = projectionStyle(capacitor.tendencia);
              return (
                <tr key={capacitor.id} className="border-t border-slate-100 align-middle">
                  <td className="break-words px-2 py-2 font-bold">{capacitor.codigo}</td>
                  <td className="px-2 py-2">{number(capacitor.potenciaKvar, 1)}</td>
                  <td className="px-2 py-2"><StatusPill status={capacitor.status} /><br/><span className="text-[7px] text-slate-400">{measurement ? formatDate(measurement.created_at) : 'Medição pendente'}</span></td>
                  <td className="px-2 py-2 font-bold">{measurement ? deviation(measurement.desvio_percentual) : '---'}</td>
                  <td className="px-2 py-2"><span className="inline-block rounded px-1.5 py-1 font-bold" style={{ color: direction.color, backgroundColor: direction.background }}>{trendLabel(capacitor.tendencia)}</span></td>
                  <td className="break-words px-2 py-2"><span className="inline-block rounded px-1.5 py-1 font-semibold" style={{ color: projection.color, backgroundColor: projection.background }}>{projectionLabel(capacitor.tendencia)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="px-4 py-5 text-[9px] text-slate-500">Nenhum capacitor ativo está cadastrado neste banco.</p>
      )}
    </section>
  );
}

export default function TechnicalReportDocument({ reportData }: { reportData: any; trends: any[] }) {
  const banks: BankReportSummary[] = reportData.bancos || [];
  const reportMode: 'cliente' | 'todos' | 'banco' = reportData.reportMode
    || (banks.length === 1 ? 'banco' : 'todos');
  const showCover = reportMode === 'todos';
  const summaryPages = reportMode === 'banco'
    ? []
    : paginateBalanced(
      banks,
      reportMode === 'cliente' ? CLIENT_BANKS_PER_SUMMARY_PAGE : BANKS_PER_SUMMARY_PAGE,
    );
  const bankDetailPages = reportMode === 'cliente' ? [] : packBankSections(banks, 10);
  const measurementPages = reportMode !== 'cliente' && reportData.reportDetail === 'completo'
    ? banks.flatMap((bank) => paginateBalanced(bank.medicoes, MEASUREMENTS_PER_PAGE).map((items, index, pages) => ({
      bank,
      items,
      part: index + 1,
      total: pages.length,
    })))
    : [];
  const totalPages = (showCover ? 1 : 0) + summaryPages.length + bankDetailPages.length + measurementPages.length + 1;
  const totalCapacitors = banks.reduce((sum, bank) => sum + bank.totalCapacitores, 0);
  const assessedCapacitors = banks.reduce((sum, bank) => sum + bank.capacitoresAvaliados, 0);
  const consolidatedHistories = banks.reduce((sum, bank) => sum + bank.historicosConsolidados, 0);
  const reportCoverage = totalCapacitors > 0 ? (assessedCapacitors / totalCapacitors) * 100 : 0;
  const criticalBanks = banks.filter((bank) => bank.status === 'reprovado').length;
  const attentionBanks = banks.filter((bank) => bank.status === 'atencao').length;
  let pageNumber = 1;
  const clientName = reportData.cliente?.nome || 'Cliente não informado';
  const conclusionTitle = reportMode === 'cliente'
    ? 'Conclusão geral do cliente'
    : reportMode === 'banco'
      ? `Conclusão do banco ${banks[0]?.nomeBanco || ''}`
      : 'Conclusão orientada por banco';
  const conclusionMetrics = reportMode === 'banco'
    ? [
      ['Capacitores aprovados', reportData.stats?.aprovado || 0, '#047857', '#ecfdf5'],
      ['Em atenção', reportData.stats?.atencao || 0, '#b45309', '#fffbeb'],
      ['Reprovados', reportData.stats?.reprovado || 0, '#b91c1c', '#fef2f2'],
      ['Cobertura do banco', `${number(reportCoverage, 0)}%`, '#1d4ed8', '#eff6ff'],
    ]
    : [
      ['Bancos críticos', criticalBanks, '#b91c1c', '#fef2f2'],
      ['Bancos em atenção', attentionBanks, '#b45309', '#fffbeb'],
      ['Cobertura geral', `${number(reportCoverage, 0)}%`, '#1d4ed8', '#eff6ff'],
      ['Históricos consolidados', consolidatedHistories, '#475569', '#f1f5f9'],
    ];

  return (
    <div className="space-y-8 bg-slate-200 p-5" data-pdf-document>
      {showCover && <Page page={pageNumber++} total={totalPages} clientName={clientName} date={reportData.date} title="Gestão de bancos de capacitores">
        <div className="flex h-full flex-col">
          <div className="mb-7 rounded-2xl bg-slate-50 p-7">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Dados do cliente</p>
            <h1 className="text-3xl font-black text-slate-900">{clientName}</h1>
            <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-slate-600">
              <p>{reportData.cliente?.cnpj_cpf || 'CNPJ não informado'}</p>
              <p>{reportData.cliente?.contato_responsavel || 'Responsável não informado'}</p>
              <p>Escopo: {reportData.scope || 'Todos os bancos'}</p>
              <p>Emissão: {reportData.date} · {reportData.time}</p>
            </div>
          </div>

          <SectionTitle>Visão da instalação</SectionTitle>
          <div className="grid grid-cols-4 gap-3">
            {[
              ['Bancos', banks.length, '#0f172a', '#f1f5f9'],
              ['Capacitores', totalCapacitors, '#1d4ed8', '#eff6ff'],
              ['Avaliados', assessedCapacitors, '#047857', '#ecfdf5'],
              ['Cobertura', `${number(reportCoverage, 0)}%`, '#b45309', '#fffbeb'],
            ].map(([label, value, color, background]) => (
              <div key={String(label)} className="rounded-xl border p-4 text-center" style={{ color: String(color), backgroundColor: String(background), borderColor: `${String(color)}30` }}>
                <p className="text-[8px] font-black uppercase tracking-widest">{label}</p>
                <p className="mt-2 text-3xl font-black">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-7 grid grid-cols-3 gap-4">
            {[
              ['Aprovados', reportData.stats.aprovado, 'aprovado'],
              ['Atenção', reportData.stats.atencao, 'atencao'],
              ['Reprovados', reportData.stats.reprovado, 'reprovado'],
            ].map(([label, value, status]) => {
              const style = statusStyle(String(status));
              return (
                <div key={String(label)} className="rounded-xl border p-4 text-center" style={{ color: style.color, backgroundColor: style.background, borderColor: `${style.color}30` }}>
                  <p className="text-[8px] font-black uppercase tracking-widest">{label}</p>
                  <p className="mt-1 text-2xl font-black">{value}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-7 rounded-xl border border-slate-200 p-5 text-[11px] leading-5 text-slate-600">
            <p className="font-bold text-slate-800">Leitura correta do relatório</p>
            <p className="mt-2">A cor representa a <strong>última condição medida</strong>. A cobertura mostra quantos componentes do banco foram avaliados. “Histórico insuficiente” significa apenas que ainda não há série temporal suficiente para projetar uma tendência; não substitui nem altera o diagnóstico atual.</p>
          </div>

          <div className="mt-auto rounded-xl bg-slate-900 p-5 text-white">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#eab308]">Escopo e responsabilidade</p>
            <p className="mt-2 text-[11px] leading-5 text-slate-300">Relatório de apoio à decisão técnica. Potência cadastrada não significa potência disponível confirmada. Resultados e intervenções devem ser validados por inspeção, instrumentos calibrados e profissional habilitado.</p>
          </div>
        </div>
      </Page>}

      {summaryPages.map((items, index) => (
        <Page
          key={`summary-${index}`}
          page={pageNumber++}
          total={totalPages}
          clientName={clientName}
          date={reportData.date}
          title={reportMode === 'cliente' ? 'Relatório geral do cliente' : 'Resumo por banco'}
        >
          {reportMode === 'cliente' && index === 0 && (
            <>
              <div className="mb-4 grid grid-cols-4 gap-3 rounded-xl bg-slate-50 p-4 text-[9px] text-slate-600">
                <div className="col-span-2"><p className="text-[7px] font-black uppercase tracking-widest text-slate-400">Cliente</p><p className="mt-1 truncate text-sm font-black text-slate-900">{clientName}</p></div>
                <div><p className="text-[7px] font-black uppercase tracking-widest text-slate-400">CNPJ / CPF</p><p className="mt-1 font-semibold">{reportData.cliente?.cnpj_cpf || 'Não informado'}</p></div>
                <div><p className="text-[7px] font-black uppercase tracking-widest text-slate-400">Responsável</p><p className="mt-1 truncate font-semibold">{reportData.cliente?.contato_responsavel || 'Não informado'}</p></div>
              </div>
              <div className="mb-5 grid grid-cols-4 gap-3">
                {[
                  ['Bancos', banks.length, '#0f172a', '#f1f5f9'],
                  ['Capacitores', totalCapacitors, '#1d4ed8', '#eff6ff'],
                  ['Avaliados', assessedCapacitors, '#047857', '#ecfdf5'],
                  ['Cobertura', `${number(reportCoverage, 0)}%`, '#b45309', '#fffbeb'],
                ].map(([label, value, color, background]) => (
                  <div key={String(label)} className="rounded-lg border px-3 py-2 text-center" style={{ color: String(color), backgroundColor: String(background), borderColor: `${String(color)}30` }}>
                    <p className="text-[7px] font-black uppercase tracking-widest">{label}</p>
                    <p className="mt-1 text-xl font-black">{value}</p>
                  </div>
                ))}
              </div>
            </>
          )}
          <SectionTitle>{reportMode === 'cliente' ? 'Visão executiva dos bancos' : 'Condição consolidada por banco'} — parte {index + 1} de {summaryPages.length}</SectionTitle>
          <table className="w-full table-fixed text-left text-[9px]">
            <thead>
              <tr className="bg-slate-100 text-[8px] font-black uppercase tracking-wide text-slate-500">
                <th className="w-[17%] px-2 py-3">Banco</th>
                <th className="w-[16%] px-2 py-3">Localização</th>
                <th className="w-[12%] px-2 py-3">Potência</th>
                <th className="w-[10%] px-2 py-3">Caps.</th>
                <th className="w-[16%] px-2 py-3">Condição</th>
                <th className="w-[15%] px-2 py-3">Cobertura</th>
                <th className="w-[14%] px-2 py-3">Última inspeção</th>
              </tr>
            </thead>
            <tbody>
              {items.map((bank) => {
                const coverage = coverageStyle(bank);
                return (
                  <tr key={bank.id} className="border-b border-slate-200 align-middle">
                    <td className="break-words px-2 py-3 font-bold">{bank.nomeBanco}</td>
                    <td className="break-words px-2 py-3">{bank.localizacao || 'Não informada'}</td>
                    <td className="px-2 py-3 font-semibold">{number(bank.potenciaCadastradaKvar, 1)} kVAr</td>
                    <td className="px-2 py-3">{bank.totalCapacitores}</td>
                    <td className="px-2 py-3"><StatusPill status={bank.status} /></td>
                    <td className="px-2 py-3"><span className="inline-block rounded px-2 py-1 text-[7px] font-black" style={{ color: coverage.color, backgroundColor: coverage.background }}>{coverage.label}</span><br/><span className="text-[7px] text-slate-400">{bank.capacitoresAvaliados} de {bank.totalCapacitores}</span></td>
                    <td className="px-2 py-3">{formatDate(bank.ultimaInspecao)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-[9px] leading-4 text-slate-500">
            <strong className="text-slate-700">Regra de prioridade:</strong> uma reprovação atual torna o banco prioritário; atenção exige acompanhamento; cobertura parcial ou pendente exige completar a inspeção antes de concluir sobre todo o banco.
          </div>
        </Page>
      ))}

      {bankDetailPages.map((items, index) => (
        <Page key={`bank-${index}`} page={pageNumber++} total={totalPages} clientName={clientName} date={reportData.date} title="Detalhamento por banco">
          <SectionTitle>{reportMode === 'banco' ? `Diagnóstico do banco ${banks[0]?.nomeBanco || ''}` : `Bancos e componentes — parte ${index + 1} de ${bankDetailPages.length}`}</SectionTitle>
          {reportMode === 'banco' && index === 0 && (
            <div className="mb-4 grid grid-cols-3 gap-3 rounded-lg bg-slate-50 px-4 py-3 text-[8px] text-slate-600">
              <div><span className="font-black uppercase tracking-wide text-slate-400">CNPJ / CPF</span><p className="mt-1 font-semibold text-slate-800">{reportData.cliente?.cnpj_cpf || 'Não informado'}</p></div>
              <div><span className="font-black uppercase tracking-wide text-slate-400">Responsável</span><p className="mt-1 truncate font-semibold text-slate-800">{reportData.cliente?.contato_responsavel || 'Não informado'}</p></div>
              <div><span className="font-black uppercase tracking-wide text-slate-400">Escopo</span><p className="mt-1 truncate font-semibold text-slate-800">{reportData.scope || banks[0]?.nomeBanco}</p></div>
            </div>
          )}
          <div className="space-y-5">
            {items.map((bank) => <BankDetail key={bank.id} bank={bank} />)}
          </div>
          <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-[8px] leading-4 text-slate-500">
            Tendência e projeção são apresentadas separadamente da saúde atual. Decisões de retirada ou substituição exigem confirmação por reteste e avaliação técnica.
          </div>
        </Page>
      ))}

      {measurementPages.map(({ bank, items, part, total }) => (
        <Page key={`measurement-${bank.id}-${part}`} page={pageNumber++} total={totalPages} clientName={clientName} date={reportData.date} title="Histórico técnico por banco">
          <SectionTitle>{bank.nomeBanco} — medições {part} de {total}</SectionTitle>
          <table className="w-full table-fixed text-left text-[9px]">
            <thead>
              <tr className="bg-slate-100 text-[8px] font-black uppercase tracking-wide text-slate-500">
                <th className="w-[13%] px-1.5 py-3">Data</th><th className="w-[17%] px-1.5 py-3">Capacitor</th><th className="w-[10%] px-1.5 py-3">Tensão</th><th className="w-[13%] px-1.5 py-3">Tipo</th><th className="w-[14%] px-1.5 py-3">Teórico</th><th className="w-[14%] px-1.5 py-3">Medido</th><th className="w-[9%] px-1.5 py-3">Desvio</th><th className="w-[10%] px-1.5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((measurement: any) => (
                <tr key={measurement.id} className="border-b border-slate-200 align-middle">
                  <td className="px-1.5 py-3">{formatDate(measurement.created_at)}</td>
                  <td className="break-words px-1.5 py-3 font-semibold">{measurement.capacitores?.codigo_identificacao || '-'}</td>
                  <td className="px-1.5 py-3">{measurement.tensaoNominal ? `${measurement.tensaoNominal} V` : '---'}</td>
                  <td className="px-1.5 py-3">{measurement.tipo_teste === 'corrente' ? 'Corrente' : 'Capacitância'}</td>
                  <td className="px-1.5 py-3">{theoreticalValue(measurement)}</td>
                  <td className="px-1.5 py-3 font-semibold">{measuredValue(measurement)}</td>
                  <td className="px-1.5 py-3 font-bold">{deviation(measurement.desvio_percentual)}</td>
                  <td className="px-1.5 py-3"><StatusPill status={measurement.status_validacao} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Page>
      ))}

      <Page page={pageNumber} total={totalPages} clientName={clientName} date={reportData.date} title="Conclusão e assinaturas">
        <SectionTitle>{conclusionTitle}</SectionTitle>
        <div className="grid grid-cols-4 gap-3">
          {conclusionMetrics.map(([label, value, color, background]) => (
            <div key={String(label)} className="rounded-xl border p-4 text-center" style={{ color: String(color), backgroundColor: String(background), borderColor: `${String(color)}30` }}>
              <p className="text-[7px] font-black uppercase tracking-widest">{label}</p>
              <p className="mt-2 text-2xl font-black">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-7 rounded-xl border border-slate-200 p-6 text-[11px] leading-5 text-slate-600">
          <p className="font-bold text-slate-800">Plano de ação recomendado</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>{reportMode === 'banco' ? 'Priorizar capacitores reprovados' : 'Priorizar bancos com componente reprovado'} e confirmar o resultado por reteste antes da intervenção.</li>
            <li>Programar nova medição para itens em atenção e completar {reportMode === 'banco' ? 'a inspeção quando houver componente pendente' : 'os bancos com cobertura parcial ou pendente'}.</li>
            <li>Manter condições de ensaio comparáveis e registrar intervenções para consolidar tendências confiáveis.</li>
            <li>Quando houver telemetria, correlacionar os ensaios com fator de potência, potência reativa, harmônicos, temperatura, acionamento dos estágios e alarmes do controlador.</li>
          </ol>
        </div>

        <div className="mt-20 grid grid-cols-2 gap-16">
          <div className="border-t border-slate-500 pt-3 text-center"><p className="text-[10px] font-bold uppercase tracking-widest">Responsável técnico</p><p className="mt-1 text-[9px] text-slate-400">Assinatura / Carimbo / Registro</p></div>
          <div className="border-t border-slate-500 pt-3 text-center"><p className="text-[10px] font-bold uppercase tracking-widest">Cliente / Recebedor</p><p className="mt-1 text-[9px] text-slate-400">Assinatura / Data</p></div>
        </div>

        <div className="mt-auto rounded-xl bg-slate-900 p-6 text-center text-white">
          <p className="text-sm font-bold">JM ELETRO SERVICE</p>
          <p className="mt-2 text-[10px] text-slate-400">contato@jmeletroservice.com.br · (91) 98231-9448</p>
        </div>
      </Page>
    </div>
  );
}
