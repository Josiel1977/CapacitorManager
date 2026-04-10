'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { FileText, Download, Search, Zap, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

// Funções de cálculo locais (independentes do utils)
function calcularCorrenteTeorica(potenciaKvar: number, tensaoNominal: number): number {
    if (!tensaoNominal || tensaoNominal === 0) return 0;
    return (potenciaKvar * 1000) / (Math.sqrt(3) * tensaoNominal);
}

function calcularCapacitanciaTeoricaDelta(capacitanciaNominalFase: number): number {
    return capacitanciaNominalFase * 1.5;
}

function getStatusValidacao(desvio: number): string {
    if (desvio >= -5 && desvio <= 10) return 'aprovado';
    if (desvio >= -10 && desvio < -5) return 'atencao';
    if (desvio > 10 && desvio <= 15) return 'atencao';
    return 'reprovado';
}

export default function RelatoriosPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [selectedCliente, setSelectedCliente] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchClientes();
  }, []);

  async function fetchClientes() {
    const { data } = await supabase.from('clientes').select('id, nome').eq('ativo', true).order('nome');
    setClientes(data || []);
  }

  async function fetchAndRecalculateMedicoes(clienteId: string) {
    const { data: medicoes } = await supabase
      .from('medicoes')
      .select(`
        *,
        bancos_capacitores(id, nome_banco),
        capacitores(id, codigo_identificacao, potencia_kvar, capacitancia_nominal_uf, tensao_nominal_v)
      `)
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false });

    if (!medicoes) return [];

    const correctedMedicoes = medicoes.map(med => {
      let desvio = med.desvio_percentual;
      let status = med.status_validacao;
      let correnteTeorica = med.corrente_teorica_a;
      let capacitanciaTeorica = med.capacitancia_teorica_uf;
      let teoricoLabel = '---';
      let tensaoExibicao = null;

      if (med.capacitores) {
        const tensaoNominal = med.capacitores.tensao_nominal_v;
        tensaoExibicao = tensaoNominal;

        if (med.tipo_teste === 'corrente' && med.corrente_medida_a) {
          // Usar a tensão nominal do capacitor
          correnteTeorica = calcularCorrenteTeorica(med.capacitores.potencia_kvar, tensaoNominal);
          teoricoLabel = `${correnteTeorica.toFixed(2)} A @ ${tensaoNominal}V`;
          
          if (correnteTeorica > 0) {
            desvio = ((med.corrente_medida_a - correnteTeorica) / correnteTeorica) * 100;
            status = getStatusValidacao(desvio);
          }
        } else if (med.tipo_teste === 'capacitancia' && med.capacitancia_medida_uf) {
          capacitanciaTeorica = calcularCapacitanciaTeoricaDelta(med.capacitores.capacitancia_nominal_uf);
          teoricoLabel = `${capacitanciaTeorica.toFixed(2)} µF (Δ) @ ${tensaoNominal}V`;
          
          if (capacitanciaTeorica > 0) {
            desvio = ((med.capacitancia_medida_uf - capacitanciaTeorica) / capacitanciaTeorica) * 100;
            status = getStatusValidacao(desvio);
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
        tensaoNominal: tensaoExibicao
      };
    });

    return correctedMedicoes;
  }

  async function generatePreview() {
    if (!selectedCliente) return;
    
    setLoading(true);
    try {
      const { data: cliente } = await supabase.from('clientes').select('*').eq('id', selectedCliente).single();
      const medicoesCorrigidas = await fetchAndRecalculateMedicoes(selectedCliente);

      const stats = (medicoesCorrigidas || []).reduce((acc: any, curr: any) => {
        acc[curr.status_validacao] = (acc[curr.status_validacao] || 0) + 1;
        return acc;
      }, { aprovado: 0, atencao: 0, reprovado: 0 });

      setReportData({
        cliente,
        medicoes: medicoesCorrigidas || [],
        stats,
        date: new Date().toLocaleDateString('pt-BR'),
        time: new Date().toLocaleTimeString('pt-BR')
      });
    } catch (error) {
      console.error('Error:', error);
      Swal.fire('Erro', 'Não foi possível gerar o relatório', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function downloadPDF() {
    if (!reportRef.current) return;

    try {
      Swal.fire({
        title: 'Gerando PDF...',
        text: 'Por favor, aguarde.',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Relatorio_Tecnico_${reportData.cliente.nome.replace(/\s+/g, '_')}.pdf`);
      
      Swal.close();
      Swal.fire('Sucesso', 'Relatório exportado com sucesso!', 'success');
    } catch (error) {
      console.error('PDF Error:', error);
      Swal.fire('Erro', 'Falha ao gerar o PDF.', 'error');
    }
  }

  function formatDesvio(desvio: number): string {
    if (desvio === null || desvio === undefined) return '---';
    return `${desvio > 0 ? '+' : ''}${desvio.toFixed(2)}%`;
  }

  function getValorTeorico(med: any): string {
    if (med.tipo_teste === 'corrente') {
      return med.corrente_teorica_a ? `${med.corrente_teorica_a.toFixed(2)} A` : '---';
    } else {
      return med.capacitancia_teorica_uf ? `${med.capacitancia_teorica_uf.toFixed(2)} µF` : '---';
    }
  }

  function getValorMedido(med: any): string {
    if (med.tipo_teste === 'corrente') {
      return med.corrente_medida_a ? `${med.corrente_medida_a.toFixed(2)} A` : '---';
    } else {
      return med.capacitancia_medida_uf ? `${med.capacitancia_medida_uf.toFixed(2)} µF` : '---';
    }
  }

  function getTensaoBadge(tensao: number): string {
    if (!tensao) return '';
    return tensao === 220 ? '🔵 220V' : tensao === 380 ? '🟢 380V' : `⚡ ${tensao}V`;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-primary">Relatórios Técnicos</h1>
        <p className="text-slate-500">Gere relatórios profissionais em PDF para seus clientes</p>
      </header>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Selecione o Cliente</label>
            <select 
              className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
              value={selectedCliente}
              onChange={(e) => setSelectedCliente(e.target.value)}
            >
              <option value="">Selecione um cliente...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <button 
            onClick={generatePreview}
            disabled={!selectedCliente || loading}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
          >
            <Search size={20} />
            Gerar Prévia
          </button>
          {reportData && (
            <button 
              onClick={downloadPDF}
              className="flex items-center justify-center gap-2 rounded-lg bg-secondary px-6 py-2 font-bold text-primary hover:bg-secondary/90"
            >
              <Download size={20} />
              Exportar PDF
            </button>
          )}
        </div>
      </div>

      {reportData ? (
        <div className="flex justify-center">
          <div 
            ref={reportRef}
            className="w-full max-w-[800px] bg-white p-12 shadow-2xl"
            style={{ minHeight: '1122px' }}
          >
            {/* Header */}
            <div className="mb-12 flex items-center justify-between border-b-4 border-primary pb-8">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary p-3 text-white">
                  <Zap size={40} />
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tighter text-primary">CAPACITOR<span className="text-secondary">MANAGER</span></h2>
                  <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Relatório Técnico de Manutenção</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-400">DATA DE EMISSÃO</p>
                <p className="text-lg font-bold text-primary">{reportData.date}</p>
                <p className="text-xs text-slate-400">{reportData.time}</p>
              </div>
            </div>

            {/* Client Info */}
            <div className="mb-12 grid grid-cols-2 gap-8 rounded-xl bg-slate-50 p-8">
              <div>
                <h3 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">DADOS DO CLIENTE</h3>
                <p className="text-xl font-bold text-primary">{reportData.cliente.nome}</p>
                <p className="text-slate-600">{reportData.cliente.cnpj_cpf || 'CNPJ não informado'}</p>
                <p className="text-slate-600">{reportData.cliente.contato_responsavel || ''}</p>
                <p className="text-slate-600">{reportData.cliente.telefone || ''}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400">✅ APROVADOS</p>
                  <p className="text-2xl font-black text-green-600">{reportData.stats.aprovado}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400">⚠️ ATENÇÃO</p>
                  <p className="text-2xl font-black text-amber-600">{reportData.stats.atencao}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400">❌ REPROVADOS</p>
                  <p className="text-2xl font-black text-red-600">{reportData.stats.reprovado}</p>
                </div>
              </div>
            </div>

            {/* Measurements Table */}
            <div className="mb-12">
              <h3 className="mb-6 text-xs font-black uppercase tracking-widest text-slate-400">DETALHAMENTO DAS MEDIÇÕES</h3>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="pb-4">DATA</th>
                    <th className="pb-4">BANCO</th>
                    <th className="pb-4">CAPACITOR</th>
                    <th className="pb-4">TENSÃO</th>
                    <th className="pb-4">TIPO</th>
                    <th className="pb-4">TEÓRICO</th>
                    <th className="pb-4">MEDIDO</th>
                    <th className="pb-4">DESVIO</th>
                    <th className="pb-4">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.medicoes.map((med: any) => (
                    <tr key={med.id} className="text-xs">
                      <td className="py-4 text-slate-600">{new Date(med.created_at).toLocaleDateString()}</td>
                      <td className="py-4 font-bold text-primary">{med.bancos_capacitores?.nome_banco || '-'}</td>
                      <td className="py-4 font-medium text-slate-700">{med.capacitores?.codigo_identificacao || '-'}</td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${med.tensaoNominal === 220 ? 'bg-blue-100 text-blue-700' : med.tensaoNominal === 380 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {getTensaoBadge(med.tensaoNominal)}
                        </span>
                      </td>
                      <td className="py-4 capitalize text-slate-600">{med.tipo_teste === 'corrente' ? '🔁 Corrente' : '📏 Capacitância'}</td>
                      <td className="py-4 text-slate-500">{getValorTeorico(med)}</td>
                      <td className="py-4 font-medium text-slate-700">{getValorMedido(med)}</td>
                      <td className="py-4 font-bold" style={{ color: med.desvio_percentual > 0 ? '#e74c3c' : med.desvio_percentual < 0 ? '#f39c12' : '#666' }}>
                        {formatDesvio(med.desvio_percentual)}
                      </td>
                      <td className="py-4">
                        <StatusBadge status={med.status_validacao} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="mb-8 rounded-lg bg-slate-50 p-6">
              <h3 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">RESUMO EXECUTIVO</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Total de Medições:</p>
                  <p className="text-2xl font-bold text-primary">{reportData.medicoes.length}</p>
                </div>
                <div>
                  <p className="text-slate-500">Taxa de Aprovação:</p>
                  <p className="text-2xl font-bold text-green-600">
                    {reportData.medicoes.length > 0 
                      ? ((reportData.stats.aprovado / reportData.medicoes.length) * 100).toFixed(1) 
                      : 0}%
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-auto border-t border-slate-100 pt-12 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Responsabilidade Técnica</p>
              <div className="mx-auto h-px w-48 bg-slate-200 mb-4"></div>
              <p className="text-xs text-slate-500">Este relatório é um documento técnico gerado pelo sistema CapacitorManager.</p>
              <p className="text-[8px] text-slate-300 mt-8">JM ELETRO SERVICE | contato@jmeletroservice.com.br | (91)98231-9448</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl bg-white py-24 shadow-sm text-slate-400">
          <FileText size={64} className="mb-4 opacity-10" />
          <p className="text-lg">Selecione um cliente para gerar o relatório</p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    aprovado: { icon: CheckCircle2, color: 'bg-green-100 text-green-700', label: '✅ APROVADO' },
    atencao: { icon: AlertTriangle, color: 'bg-amber-100 text-amber-700', label: '⚠️ ATENÇÃO' },
    reprovado: { icon: XCircle, color: 'bg-red-100 text-red-700', label: '❌ REPROVADO' },
  };

  const config = configs[status] || configs.atencao;
  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold", config.color)}>
      <Icon size={12} />
      {config.label}
    </span>
  );
}