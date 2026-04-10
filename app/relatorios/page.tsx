'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { FileText, Download, Search, Zap, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

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

  async function generatePreview() {
    if (!selectedCliente) return;
    
    setLoading(true);
    try {
      const { data: cliente } = await supabase.from('clientes').select('*').eq('id', selectedCliente).single();
      const { data: medicoes } = await supabase
        .from('medicoes')
        .select('*, bancos_capacitores(nome_banco), capacitores(codigo_identificacao, potencia_kvar)')
        .eq('cliente_id', selectedCliente)
        .order('created_at', { ascending: false });

      const stats = (medicoes || []).reduce((acc: any, curr: any) => {
        acc[curr.status_validacao] = (acc[curr.status_validacao] || 0) + 1;
        return acc;
      }, { aprovado: 0, atencao: 0, reprovado: 0 });

      setReportData({
        cliente,
        medicoes: medicoes || [],
        stats,
        date: new Date().toLocaleDateString('pt-BR')
      });
    } catch (error) {
      console.error('Error:', error);
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
        logging: false
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
          {/* Report Template (A4 Aspect Ratio) */}
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
              </div>
            </div>

            {/* Client Info */}
            <div className="mb-12 grid grid-cols-2 gap-8 rounded-xl bg-slate-50 p-8">
              <div>
                <h3 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">DADOS DO CLIENTE</h3>
                <p className="text-xl font-bold text-primary">{reportData.cliente.nome}</p>
                <p className="text-slate-600">{reportData.cliente.cnpj_cpf || 'CNPJ não informado'}</p>
                <p className="text-slate-600">{reportData.cliente.email || ''}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400">APROVADOS</p>
                  <p className="text-2xl font-black text-success">{reportData.stats.aprovado}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400">ATENÇÃO</p>
                  <p className="text-2xl font-black text-secondary">{reportData.stats.atencao}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400">REPROVADOS</p>
                  <p className="text-2xl font-black text-error">{reportData.stats.reprovado}</p>
                </div>
              </div>
            </div>

            {/* Measurements Table */}
            <div className="mb-12">
              <h3 className="mb-6 text-xs font-black uppercase tracking-widest text-slate-400">DETALHAMENTO DAS ÚLTIMAS MEDIÇÕES</h3>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="pb-4">DATA</th>
                    <th className="pb-4">BANCO</th>
                    <th className="pb-4">CAPACITOR</th>
                    <th className="pb-4">TIPO</th>
                    <th className="pb-4">DESVIO</th>
                    <th className="pb-4">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.medicoes.map((med: any) => (
                    <tr key={med.id} className="text-xs">
                      <td className="py-4 text-slate-600">{new Date(med.created_at).toLocaleDateString()}</td>
                      <td className="py-4 font-bold text-primary">{med.bancos_capacitores?.nome_banco}</td>
                      <td className="py-4 font-medium text-slate-700">{med.capacitores?.codigo_identificacao}</td>
                      <td className="py-4 capitalize text-slate-600">{med.tipo_teste}</td>
                      <td className="py-4 font-bold text-primary">{med.desvio_percentual?.toFixed(2)}%</td>
                      <td className="py-4">
                        <StatusBadge status={med.status_validacao} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="mt-auto border-t border-slate-100 pt-12 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Responsabilidade Técnica</p>
              <div className="mx-auto h-px w-48 bg-slate-200 mb-4"></div>
              <p className="text-xs text-slate-500">Este relatório é um documento técnico gerado pelo sistema CapacitorManager.</p>
              <p className="text-[8px] text-slate-300 mt-8">ID do Relatório: {crypto.randomUUID()}</p>
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
    aprovado: { icon: CheckCircle2, color: 'text-success', label: 'APROVADO' },
    atencao: { icon: AlertTriangle, color: 'text-secondary', label: 'ATENÇÃO' },
    reprovado: { icon: XCircle, color: 'text-error', label: 'REPROVADO' },
  };

  const config = configs[status] || configs.atencao;
  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center gap-1 font-bold", config.color)}>
      <Icon size={10} />
      {config.label}
    </span>
  );
}
