'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { FileText, Download, Search, Zap, CheckCircle2, AlertTriangle, XCircle, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

// Funções de cálculo
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

// Função para calcular tendência de degradação
function calcularTendenciaCapacitor(medicoes: any[]) {
    if (medicoes.length < 2) return null;
    
    const primeira = medicoes[medicoes.length - 1];
    const ultima = medicoes[0];
    
    const variacao = ultima.desvio_percentual - primeira.desvio_percentual;
    const dias = (new Date(ultima.created_at).getTime() - new Date(primeira.created_at).getTime()) / (1000 * 3600 * 24);
    const degradacaoPorMes = dias > 0 ? (variacao / dias) * 30 : 0;
    
    let previsao = null;
    if (degradacaoPorMes > 0 && ultima.desvio_percentual < 15) {
        const mesesRestantes = (15 - ultima.desvio_percentual) / degradacaoPorMes;
        previsao = {
            meses: mesesRestantes.toFixed(1),
            data: new Date(Date.now() + mesesRestantes * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')
        };
    }
    
    return {
        nome: primeira.capacitores?.codigo_identificacao,
        banco: primeira.bancos_capacitores?.nome_banco,
        variacao: variacao.toFixed(2),
        degradacaoPorMes: degradacaoPorMes.toFixed(2),
        tendencia: variacao > 0 ? 'piorando' : variacao < 0 ? 'melhorando' : 'estavel',
        primeiraData: new Date(primeira.created_at).toLocaleDateString('pt-BR'),
        ultimaData: new Date(ultima.created_at).toLocaleDateString('pt-BR'),
        primeiraDesvio: primeira.desvio_percentual?.toFixed(2) || '0',
        ultimaDesvio: ultima.desvio_percentual?.toFixed(2) || '0',
        previsao
    };
}

export default function RelatoriosPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [selectedCliente, setSelectedCliente] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tendencias, setTendencias] = useState<any[]>([]);
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

  // Agrupar medições por capacitor para análise de tendência
  function agruparPorCapacitor(medicoes: any[]) {
    const grupos: any = {};
    medicoes.forEach(med => {
      const key = med.capacitores?.id;
      if (!key) return;
      if (!grupos[key]) {
        grupos[key] = [];
      }
      grupos[key].push(med);
    });
    
    Object.keys(grupos).forEach(key => {
      grupos[key].sort((a: any, b: any) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
    
    return grupos;
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

      const grupos = agruparPorCapacitor(medicoesCorrigidas);
      const tendenciasCalculadas = Object.values(grupos)
        .map((meds: any) => calcularTendenciaCapacitor(meds))
        .filter(t => t !== null);
      
      setTendencias(tendenciasCalculadas);

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
        backgroundColor: '#ffffff',
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          const modernColorRegex = /(?:oklch|oklab|hwb|display-p3|color)\((?:[^()]+|\([^()]*\))+\)/gi;
          
          // 1. Process all style tags
          const styleTags = Array.from(clonedDoc.getElementsByTagName('style'));
          styleTags.forEach(style => {
            try {
              let css = style.textContent || '';
              if (css.includes('oklch') || css.includes('oklab') || css.includes('@import') || css.includes('/*')) {
                css = css.replace(/\/\*[\s\S]*?\*\//g, '');
                css = css.replace(/@import\s+url\([^)]+\);/gi, '');
                css = css.replace(/@import\s+['"][^'"]+['"];/gi, '');
                css = css.replace(/@import\s+[^;]+;/gi, '');
                css = css.replace(modernColorRegex, '#1e293b');
                style.textContent = css;
              }
            } catch (e) {}
          });

          // 2. Process all link tags (external stylesheets)
          // html2canvas fails when it tries to parse external sheets containing oklch
          const linkTags = Array.from(clonedDoc.getElementsByTagName('link'));
          linkTags.forEach(link => {
            if (link.rel === 'stylesheet') {
              // In production, Next.js styles are in <link> tags.
              // We remove them to prevent html2canvas from crashing on oklch.
              // We rely on inline styles and sanitized <style> tags for the PDF layout.
              link.remove();
            }
          });

          // 3. Process all elements for inline styles
          const allElements = clonedDoc.getElementsByTagName('*');
          for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i] as HTMLElement;
            try {
              if (el.style && el.style.cssText && (
                el.style.cssText.includes('oklch') || 
                el.style.cssText.includes('oklab') || 
                el.style.cssText.includes('@import')
              )) {
                let inlineCss = el.style.cssText;
                inlineCss = inlineCss.replace(/@import[^;]+;/gi, '');
                inlineCss = inlineCss.replace(modernColorRegex, '#1e293b');
                el.style.cssText = inlineCss;
              }
            } catch (e) {}
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const contentHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = contentHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, contentHeight);
      heightLeft -= pdfHeight;

      // Add subsequent pages if content is longer than one page
      while (heightLeft >= 0) {
        position = heightLeft - contentHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, contentHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`Relatorio_Tecnico_${reportData.cliente.nome.replace(/\s+/g, '_')}.pdf`);
      
      Swal.close();
      Swal.fire('Sucesso', 'Relatório exportado com sucesso!', 'success');
    } catch (error) {
      console.error('PDF Error:', error);
      Swal.close();
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

  function getTendenciaIcon(tendencia: string) {
    if (tendencia === 'piorando') return <TrendingUp size={14} className="text-red-600" />;
    if (tendencia === 'melhorando') return <TrendingDown size={14} className="text-green-600" />;
    return <Activity size={14} className="text-slate-400" />;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-800">Relatórios Técnicos</h1>
        <p className="text-slate-500">Gere relatórios profissionais com análise de tendência</p>
      </header>

      <div className="rounded-xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Selecione o Cliente</label>
            <select 
              className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-slate-400"
              value={selectedCliente}
              onChange={(e) => setSelectedCliente(e.target.value)}
            >
              <option value="">Selecione um cliente...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={generatePreview}
              disabled={!selectedCliente || loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-800 px-6 py-2 text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <Search size={20} />
              Gerar Prévia
            </button>
            {reportData && (
              <button 
                onClick={downloadPDF}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-600 px-6 py-2 font-bold text-white hover:bg-slate-500 transition-colors"
              >
                <Download size={20} />
                Exportar PDF
              </button>
            )}
          </div>
        </div>
      </div>

      {reportData ? (
        <div className="flex justify-center overflow-x-auto pb-8">
          <div 
            ref={reportRef}
            className="w-full max-w-[800px] bg-white p-12 shadow-2xl"
            style={{ minHeight: '1122px' }}
          >
            {/* Header - Dark & Yellow Theme */}
            <div className="mb-12 flex flex-row items-center justify-between border-b-4 pb-8 gap-4" style={{ borderColor: '#EAB308', backgroundColor: '#0f172a', margin: '-48px -48px 48px -48px', padding: '48px' }}>
              <div className="flex items-center gap-4">
                <div className="rounded-2xl p-3 text-primary" style={{ backgroundColor: '#EAB308' }}>
                  <Zap size={40} className="text-slate-900" />
                </div>
                <div>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase" style={{ color: '#ffffff' }}>
                    CAPACITOR<span style={{ color: '#EAB308' }}>MANAGER</span>
                  </h2>
                  <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-400">Relatório Técnico de Manutenção Especializada</p>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[10px] sm:text-sm font-bold text-slate-500">DATA DE EMISSÃO</p>
                <p className="text-base sm:text-lg font-bold text-white">{reportData.date}</p>
                <p className="text-[10px] sm:text-xs text-[#EAB308]">{reportData.time}</p>
              </div>
            </div>

            {/* Client Info - Cores mais profissionais */}
            <div className="mb-8 sm:mb-12 grid grid-cols-1 md:grid-cols-2 gap-8 rounded-xl p-4 sm:p-8" style={{ backgroundColor: '#f8fafc' }}>
              <div>
                <h3 className="mb-4 text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400">DADOS DO CLIENTE</h3>
                <p className="text-lg sm:text-xl font-bold" style={{ color: '#1e293b' }}>{reportData.cliente.nome}</p>
                <p className="text-sm text-slate-600">{reportData.cliente.cnpj_cpf || 'CNPJ não informado'}</p>
                <p className="text-sm text-slate-600">{reportData.cliente.contato_responsavel || ''}</p>
                <p className="text-sm text-slate-600">{reportData.cliente.telefone || ''}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="text-center">
                  <p className="text-[8px] sm:text-[10px] font-bold text-slate-400">APROVADOS</p>
                  <p className="text-xl sm:text-2xl font-black" style={{ color: '#059669' }}>{reportData.stats.aprovado}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] sm:text-[10px] font-bold text-slate-400">ATENÇÃO</p>
                  <p className="text-xl sm:text-2xl font-black" style={{ color: '#d97706' }}>{reportData.stats.atencao}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] sm:text-[10px] font-bold text-slate-400">REPROVADOS</p>
                  <p className="text-xl sm:text-2xl font-black" style={{ color: '#dc2626' }}>{reportData.stats.reprovado}</p>
                </div>
              </div>
            </div>

            {/* Análise de Tendência por Capacitor */}
            {tendencias.length > 0 && (
              <div className="mb-8 sm:mb-12">
                <h3 className="mb-6 text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400">📊 ANÁLISE DE TENDÊNCIA POR CAPACITOR</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[600px]">
                    <thead>
                      <tr className="border-b-2 border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <th className="pb-4">CAPACITOR</th>
                        <th className="pb-4">BANCO</th>
                        <th className="pb-4">1ª MEDIÇÃO</th>
                        <th className="pb-4">ÚLTIMA</th>
                        <th className="pb-4">VARIAÇÃO</th>
                        <th className="pb-4">TENDÊNCIA</th>
                        <th className="pb-4">PREVISÃO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tendencias.map((t, idx) => (
                        <tr key={idx} className="text-[10px] sm:text-xs">
                          <td className="py-4 font-bold text-slate-800">{t.nome}</td>
                          <td className="py-4 text-slate-600">{t.banco}</td>
                          <td className="py-4 text-slate-500">{t.primeiraDesvio}%<br/><span className="text-slate-400">{t.primeiraData}</span></td>
                          <td className="py-4 text-slate-500">{t.ultimaDesvio}%<br/><span className="text-slate-400">{t.ultimaData}</span></td>
                          <td className="py-4 font-bold" style={{ color: parseFloat(t.variacao) > 0 ? '#dc2626' : parseFloat(t.variacao) < 0 ? '#10b981' : '#64748b' }}>
                            {parseFloat(t.variacao) > 0 ? '+' : ''}{t.variacao}%
                          </td>
                          <td className="py-4">
                            <div className="flex items-center gap-1">
                              {getTendenciaIcon(t.tendencia)}
                              <span className={t.tendencia === 'piorando' ? 'text-red-600' : t.tendencia === 'melhorando' ? 'text-green-600' : 'text-slate-500'}>
                                {t.tendencia === 'piorando' ? 'Degradando' : t.tendencia === 'melhorando' ? 'Melhorando' : 'Estável'}
                              </span>
                            </div>
                          </td>
                          <td className="py-4">
                            {t.previsao ? (
                              <span className="text-amber-600 font-medium">
                                ~{t.previsao.meses} meses<br/>
                                <span className="text-slate-400 text-[8px]">{t.previsao.data}</span>
                              </span>
                            ) : (
                              <span className="text-green-600">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Measurements Table */}
            <div className="mb-8 sm:mb-12">
              <h3 className="mb-6 text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400">DETALHAMENTO DAS MEDIÇÕES</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[700px]">
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
                      <tr key={med.id} className="text-[10px] sm:text-xs">
                        <td className="py-4 text-slate-600">{new Date(med.created_at).toLocaleDateString()}</td>
                        <td className="py-4 font-bold text-slate-700">{med.bancos_capacitores?.nome_banco || '-'}</td>
                        <td className="py-4 font-medium text-slate-700">{med.capacitores?.codigo_identificacao || '-'}</td>
                        <td className="py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${med.tensaoNominal === 220 ? 'bg-blue-50 text-blue-700' : med.tensaoNominal === 380 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            ⚡ {med.tensaoNominal}V
                          </span>
                        </td>
                        <td className="py-4 capitalize text-slate-600">{med.tipo_teste === 'corrente' ? 'Corrente' : 'Capacitância'}</td>
                        <td className="py-4 text-slate-500">{getValorTeorico(med)}</td>
                        <td className="py-4 font-medium text-slate-700">{getValorMedido(med)}</td>
                        <td className="py-4 font-bold" style={{ color: med.desvio_percentual > 0 ? '#dc2626' : med.desvio_percentual < 0 ? '#d97706' : '#64748b' }}>
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
            </div>

            {/* Summary - Cores mais profissionais */}
            <div className="mb-8 rounded-lg bg-slate-50 p-4 sm:p-6">
              <h3 className="mb-4 text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400">RESUMO EXECUTIVO</h3>
              <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm mb-4">
                <div>
                  <p className="text-slate-500">Total de Medições:</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-800">{reportData.medicoes.length}</p>
                </div>
                <div>
                  <p className="text-slate-500">Taxa de Aprovação:</p>
                  <p className="text-xl sm:text-2xl font-bold text-emerald-600">
                    {reportData.medicoes.length > 0 
                      ? ((reportData.stats.aprovado / reportData.medicoes.length) * 100).toFixed(1) 
                      : 0}%
                  </p>
                </div>
              </div>
              
              {/* Capacitores Críticos */}
              {tendencias.filter(t => t.tendencia === 'piorando' && parseFloat(t.variacao) > 5).length > 0 && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-xs font-bold text-red-700 mb-2">⚠️ CAPACITORES QUE NECESSITAM ATENÇÃO:</p>
                  <ul className="text-xs text-red-600 space-y-1">
                    {tendencias.filter(t => t.tendencia === 'piorando' && parseFloat(t.variacao) > 5).map((t, idx) => (
                      <li key={idx}>• {t.nome} - Variação de {t.variacao}% (previsão de substituição em {t.previsao?.meses || 'breve'} meses)</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer - Highlighted */}
            <div className="mt-auto border-t-4 pt-12 text-center" style={{ borderColor: '#EAB308', backgroundColor: '#f8fafc', margin: '64px -48px -48px -48px', padding: '48px' }}>
              <div className="grid grid-cols-2 gap-12 mb-12">
                <div className="text-center">
                  <div className="mx-auto h-px w-48 bg-slate-400 mb-2"></div>
                  <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Responsável Técnico</p>
                  <p className="text-[8px] text-slate-500">Assinatura / Carimbo</p>
                </div>
                <div className="text-center">
                  <div className="mx-auto h-px w-48 bg-slate-400 mb-2"></div>
                  <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Cliente / Recebedor</p>
                  <p className="text-[8px] text-slate-500">Assinatura / Data</p>
                </div>
              </div>
              
              <div className="pt-8 border-t border-slate-200">
                <p className="text-xs font-bold text-slate-700">Este relatório é um documento técnico oficial gerado pelo sistema CapacitorManager.</p>
                <p className="text-[10px] text-slate-600 mt-4 font-medium">JM ELETRO SERVICE | contato@jmeletroservice.com.br | (91) 98231-9448</p>
                <div className="mt-4 flex justify-center gap-2">
                  <div className="h-1 w-12 bg-[#EAB308]"></div>
                  <div className="h-1 w-12 bg-slate-900"></div>
                  <div className="h-1 w-12 bg-[#EAB308]"></div>
                </div>
              </div>
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
    aprovado: { 
      icon: CheckCircle2, 
      color: '#059669', // emerald-600
      bg: '#ecfdf5',    // emerald-50
      label: 'APROVADO' 
    },
    atencao: { 
      icon: AlertTriangle, 
      color: '#d97706', // amber-600
      bg: '#fffbeb',    // amber-50
      label: 'ATENÇÃO' 
    },
    reprovado: { 
      icon: XCircle, 
      color: '#dc2626', // red-600
      bg: '#fef2f2',    // red-50
      label: 'REPROVADO' 
    },
  };

  const config = configs[status] || configs.atencao;
  const Icon = config.icon;

  return (
    <span 
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      <Icon size={12} />
      {config.label}
    </span>
  );
}
