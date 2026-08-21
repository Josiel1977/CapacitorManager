'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, FileText, Search } from 'lucide-react';
import TechnicalReportDocument from '@/components/TechnicalReportDocument';
import { buildBankReportSummaries, reconcileMeasurementsToBanks } from '@/lib/bank-report';
import { calculateCapacitorTrend, calculateDeltaCapacitance, calculateExpectedCapacitorCurrent, classifyDeviation } from '@/lib/domain/capacitorAnalysis';
import { supabase } from '@/lib/supabase';

const PDF_PAGE_WIDTH_PX = 794;
const PDF_PAGE_HEIGHT_PX = 1122;

export default function RelatoriosPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [selectedCliente, setSelectedCliente] = useState('');
  const [bancos, setBancos] = useState<any[]>([]);
  const [selectedBanco, setSelectedBanco] = useState('resumo_cliente');
  const [reportDetail, setReportDetail] = useState<'gerencial' | 'completo'>('gerencial');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tendencias, setTendencias] = useState<any[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchClientes() {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');

      if (error) {
        console.warn('[Relatórios] Não foi possível carregar os clientes.', error);
        return;
      }
      if (mounted) setClientes(data || []);
    }

    void fetchClientes();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;

    setSelectedBanco('resumo_cliente');
    setReportData(null);
    setTendencias([]);

    if (!selectedCliente) {
      setBancos([]);
      return () => { mounted = false; };
    }

    async function fetchBancos() {
      const { data, error } = await supabase
        .from('bancos_capacitores')
        .select('id, nome_banco, localizacao')
        .eq('cliente_id', selectedCliente)
        .eq('ativo', true)
        .order('nome_banco');

      if (error) {
        console.warn('[Relatórios] Não foi possível carregar os bancos.', error);
        return;
      }
      if (mounted) setBancos(data || []);
    }

    void fetchBancos();
    return () => { mounted = false; };
  }, [selectedCliente]);

  async function fetchBankAssets(clienteId: string) {
    let bankQuery = supabase
      .from('bancos_capacitores')
      .select(`
        id,
        nome_banco,
        localizacao,
        tensao_nominal,
        potencia_total_kvar,
        potencia_trafo_kva
      `)
      .eq('cliente_id', clienteId)
      .eq('ativo', true)
      .order('nome_banco');

    if (selectedBanco !== 'todos' && selectedBanco !== 'resumo_cliente') {
      bankQuery = bankQuery.eq('id', selectedBanco);
    }
    const { data: bankData, error: bankError } = await bankQuery;
    if (bankError) throw bankError;

    const banks = bankData || [];
    const bankIds = banks.map((bank) => bank.id);
    if (bankIds.length === 0) return [];

    const { data: capacitorData, error: capacitorError } = await supabase
      .from('capacitores')
      .select('id, banco_id, codigo_identificacao, potencia_kvar, ativo')
      .in('banco_id', bankIds)
      .order('codigo_identificacao');
    if (capacitorError) throw capacitorError;

    const capacitorsByBank = new Map<string, any[]>();
    (capacitorData || []).forEach((capacitor) => {
      const current = capacitorsByBank.get(capacitor.banco_id) || [];
      current.push(capacitor);
      capacitorsByBank.set(capacitor.banco_id, current);
    });

    return banks.map((bank) => ({
      ...bank,
      capacitores: capacitorsByBank.get(bank.id) || [],
    }));
  }

  async function fetchAndRecalculateMedicoes(clienteId: string) {
    let query = supabase
      .from('medicoes')
      .select(`
        *,
        bancos_capacitores(id, nome_banco),
        capacitores(id, codigo_identificacao, potencia_kvar, capacitancia_nominal_uf, tensao_nominal_v)
      `)
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false });

    const { data: medicoes, error } = await query;

    if (error) throw error;

    return (medicoes || []).map((med: any) => {
      let desvio = med.desvio_percentual;
      let status = med.status_validacao;
      let correnteTeorica = med.corrente_teorica_a;
      let capacitanciaTeorica = med.capacitancia_teorica_uf;
      let teoricoLabel = '---';
      let tensaoExibicao = null;

      if (med.capacitores) {
        const tensaoNominal = med.capacitores.tensao_nominal_v;
        const tensaoMedida = med.tensao_medida_v || tensaoNominal;
        tensaoExibicao = tensaoMedida;

        if (med.tipo_teste === 'corrente' && med.corrente_medida_a !== null) {
          correnteTeorica = calculateExpectedCapacitorCurrent(
            med.capacitores.potencia_kvar,
            tensaoNominal,
            tensaoMedida,
            60,
            med.frequencia_medida_hz || 60,
          );
          teoricoLabel = `${correnteTeorica.toFixed(2)} A @ ${tensaoMedida}V`;

          if (correnteTeorica > 0) {
            desvio = ((med.corrente_medida_a - correnteTeorica) / correnteTeorica) * 100;
            status = classifyDeviation(desvio);
          }
        } else if (med.tipo_teste === 'capacitancia' && med.capacitancia_medida_uf !== null) {
          capacitanciaTeorica = calculateDeltaCapacitance(med.capacitores.capacitancia_nominal_uf);
          teoricoLabel = `${capacitanciaTeorica.toFixed(2)} µF (Δ) @ ${tensaoNominal}V`;

          if (capacitanciaTeorica > 0) {
            desvio = ((med.capacitancia_medida_uf - capacitanciaTeorica) / capacitanciaTeorica) * 100;
            status = classifyDeviation(desvio);
          }
        }
      }

      return {
        ...med,
        desvio_percentual: desvio,
        status_validacao: status,
        corrente_teorica_a: correnteTeorica,
        capacitancia_teorica_uf: capacitanciaTeorica,
        teoricoLabel,
        tensaoNominal: tensaoExibicao,
      };
    });
  }

  function agruparPorCapacitor(medicoes: any[]) {
    const grupos: Record<string, any[]> = {};

    medicoes.forEach((med) => {
      const key = med.capacitores?.id;
      if (!key) return;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(med);
    });

    Object.values(grupos).forEach((grupo) => {
      grupo.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    });

    return grupos;
  }

  async function generatePreview() {
    if (!selectedCliente) return;

    setLoading(true);
    try {
      const reportMode = selectedBanco === 'resumo_cliente'
        ? 'cliente'
        : selectedBanco === 'todos' ? 'todos' : 'banco';
      const { data: cliente, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', selectedCliente)
        .single();
      if (error) throw error;

      const [bankAssets, medicoesCorrigidas] = await Promise.all([
        fetchBankAssets(selectedCliente),
        fetchAndRecalculateMedicoes(selectedCliente),
      ]);
      const medicoesReconciliadas = reconcileMeasurementsToBanks(
        bankAssets,
        medicoesCorrigidas,
      );
      const medicoesDoEscopo = reportMode === 'banco'
        ? medicoesReconciliadas.filter((medicao) => medicao.banco_id === selectedBanco)
        : medicoesReconciliadas;

      const tendenciasCalculadas = reportMode === 'cliente'
        ? []
        : Object.values(agruparPorCapacitor(medicoesDoEscopo))
          .map((meds) => calculateCapacitorTrend(meds))
          .filter((tendencia) => tendencia !== null);
      const bankSummaries = buildBankReportSummaries(
        bankAssets,
        medicoesDoEscopo,
        tendenciasCalculadas,
      );
      const stats = bankSummaries.reduce(
        (totals, bank) => ({
          aprovado: totals.aprovado + bank.stats.aprovado,
          atencao: totals.atencao + bank.stats.atencao,
          reprovado: totals.reprovado + bank.stats.reprovado,
        }),
        { aprovado: 0, atencao: 0, reprovado: 0 },
      );

      setTendencias(tendenciasCalculadas);
      setReportData({
        cliente,
        medicoes: reportMode === 'cliente' ? [] : medicoesDoEscopo,
        bancos: bankSummaries,
        stats,
        reportMode,
        reportDetail: reportMode === 'cliente' ? 'gerencial' : reportDetail,
        scope: reportMode === 'cliente'
          ? 'Resumo geral do cliente'
          : reportMode === 'todos' ? 'Todos os bancos — detalhado' : bankSummaries[0]?.nomeBanco,
        date: new Date().toLocaleDateString('pt-BR'),
        time: new Date().toLocaleTimeString('pt-BR'),
      });
    } catch (error) {
      console.warn('[Relatórios] Não foi possível gerar a prévia.', error);
      const { default: Swal } = await import('sweetalert2');
      await Swal.fire('Erro', 'Não foi possível gerar o relatório.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function downloadPDF() {
    if (!reportRef.current || !reportData) return;

    const [{ default: jsPDF }, { toPng }, { default: Swal }] = await Promise.all([
      import('jspdf'),
      import('html-to-image'),
      import('sweetalert2'),
    ]);

    try {
      Swal.fire({
        title: 'Gerando PDF...',
        text: 'Preparando as páginas do relatório.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      if (document.fonts?.ready) await document.fonts.ready;

      const pages = Array.from(
        reportRef.current.querySelectorAll<HTMLElement>('[data-pdf-page]'),
      );
      if (!pages.length) throw new Error('Nenhuma página foi encontrada para exportação.');

      const pdf = new jsPDF('p', 'mm', 'a4');

      for (let index = 0; index < pages.length; index++) {
        Swal.update({
          text: `Processando página ${index + 1} de ${pages.length}.`,
        });

        const dataUrl = await toPng(pages[index], {
          backgroundColor: '#ffffff',
          cacheBust: true,
          pixelRatio: 2,
          width: PDF_PAGE_WIDTH_PX,
          height: PDF_PAGE_HEIGHT_PX,
        });

        if (index > 0) pdf.addPage('a4', 'p');
        pdf.addImage(dataUrl, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      }

      const clientName = reportData.cliente.nome.replace(/\s+/g, '_');
      const filename = reportData.reportMode === 'cliente'
        ? `Relatorio_Geral_${clientName}.pdf`
        : reportData.reportMode === 'banco'
          ? `Relatorio_Banco_${String(reportData.scope).replace(/\s+/g, '_')}_${clientName}.pdf`
          : `Relatorio_Tecnico_${clientName}.pdf`;
      pdf.save(filename);
      Swal.close();
      await Swal.fire('Sucesso', 'Relatório exportado em páginas A4 completas.', 'success');
    } catch (error) {
      console.warn('[Relatórios] Falha ao gerar o PDF.', error);
      Swal.close();
      await Swal.fire('Erro', 'Falha ao gerar o PDF. Tente novamente.', 'error');
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-800">Relatórios Técnicos</h1>
        <p className="text-slate-500">Visão consolidada da instalação e detalhamento operacional por banco</p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Selecione o cliente</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-slate-400"
              value={selectedCliente}
              onChange={(event) => setSelectedCliente(event.target.value)}
            >
              <option value="">Selecione um cliente...</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Escopo por banco</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-slate-400 disabled:bg-slate-50"
              value={selectedBanco}
              disabled={!selectedCliente}
              onChange={(event) => {
                setSelectedBanco(event.target.value);
                setReportData(null);
              }}
            >
              <option value="resumo_cliente">Geral do cliente — resumo executivo</option>
              <option value="todos">Todos os bancos — detalhado</option>
              {bancos.map((banco) => (
                <option key={banco.id} value={banco.id}>
                  {banco.nome_banco}{banco.localizacao ? ` — ${banco.localizacao}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nível de detalhamento</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-slate-400"
              value={selectedBanco === 'resumo_cliente' ? 'gerencial' : reportDetail}
              disabled={selectedBanco === 'resumo_cliente'}
              onChange={(event) => {
                setReportDetail(event.target.value as 'gerencial' | 'completo');
                setReportData(null);
              }}
            >
              <option value="gerencial">Gerencial — última condição (recomendado)</option>
              <option value="completo">Completo — inclui histórico de medições</option>
            </select>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:col-span-3 lg:justify-end">
            <button
              type="button"
              onClick={generatePreview}
              disabled={!selectedCliente || loading}
              className="flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-6 py-2 text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              <Search size={20} />
              {loading ? 'Gerando...' : 'Gerar prévia'}
            </button>

            {reportData && (
              <button
                type="button"
                onClick={downloadPDF}
                className="flex items-center justify-center gap-2 rounded-lg bg-slate-600 px-6 py-2 font-bold text-white transition-colors hover:bg-slate-500"
              >
                <Download size={20} />
                Exportar PDF
              </button>
            )}
          </div>
        </div>
      </div>

      {reportData ? (
        <div className="overflow-x-auto pb-8">
          <div ref={reportRef} className="mx-auto w-max">
            <TechnicalReportDocument reportData={reportData} trends={tendencias} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl bg-white py-24 text-slate-400 shadow-sm">
          <FileText size={64} className="mb-4 opacity-10" />
          <p className="text-lg">Selecione um cliente para gerar o relatório</p>
        </div>
      )}
    </div>
  );
}
