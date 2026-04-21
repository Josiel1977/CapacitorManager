'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Calendar, Zap, Activity, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, XCircle, FileText, Download } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

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

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    aprovado: { icon: CheckCircle2, color: 'bg-green-50 text-green-700', label: '✅ Aprovado' },
    atencao: { icon: AlertTriangle, color: 'bg-amber-50 text-amber-700', label: '⚠️ Atenção' },
    reprovado: { icon: XCircle, color: 'bg-red-50 text-red-700', label: '❌ Reprovado' },
  };

  const config = configs[status?.toLowerCase()] || configs.atencao;
  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", config.color)}>
      <Icon size={12} />
      {config.label}
    </span>
  );
}

// Componente que usa useSearchParams
function MedicoesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const capacitorId = searchParams.get('capacitor_id');
  
  const [capacitor, setCapacitor] = useState<any>(null);
  const [medicoes, setMedicoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculando, setRecalculando] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (capacitorId) {
      fetchData();
    }
  }, [capacitorId]);

  async function fetchData() {
    setLoading(true);
    try {
      // Buscar dados do capacitor
      const { data: capData } = await supabase
        .from('capacitores')
        .select(`
          *,
          bancos_capacitores (
            id,
            nome_banco,
            cliente_id,
            clientes (id, nome)
          )
        `)
        .eq('id', capacitorId)
        .single();

      if (capData) {
        setCapacitor(capData);
      }

      // Buscar medições do capacitor
      const { data: medData } = await supabase
        .from('medicoes')
        .select('*')
        .eq('capacitor_id', capacitorId)
        .order('created_at', { ascending: false });

      // Recalcular desvios
      const processedMedicoes = (medData || []).map(med => {
        let desvio = med.desvio_percentual;
        let status = med.status_validacao;
        let teoricoLabel = '---';
        
        if (capData) {
          const tensaoNominal = capData.tensao_nominal_v;
          
          if (med.tipo_teste === 'corrente' && med.corrente_medida_a) {
            const correnteTeorica = calcularCorrenteTeorica(capData.potencia_kvar, tensaoNominal);
            teoricoLabel = `${correnteTeorica.toFixed(2)} A @ ${tensaoNominal}V`;
            
            if (correnteTeorica > 0) {
              desvio = ((med.corrente_medida_a - correnteTeorica) / correnteTeorica) * 100;
              status = getStatusValidacao(desvio);
            }
          } else if (med.tipo_teste === 'capacitancia' && med.capacitancia_medida_uf) {
            const capacitanciaTeorica = calcularCapacitanciaTeoricaDelta(capData.capacitancia_nominal_uf);
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
          teoricoLabel
        };
      });

      setMedicoes(processedMedicoes);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      Swal.fire('Erro', 'Não foi possível carregar os dados', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function recalcularTodasMedicoes() {
    setRecalculando(true);
    try {
      for (const med of medicoes) {
        let desvio = med.desvio_percentual;
        let status = med.status_validacao;
        
        if (capacitor) {
          if (med.tipo_teste === 'corrente' && med.corrente_medida_a) {
            const correnteTeorica = calcularCorrenteTeorica(capacitor.potencia_kvar, capacitor.tensao_nominal_v);
            if (correnteTeorica > 0) {
              desvio = ((med.corrente_medida_a - correnteTeorica) / correnteTeorica) * 100;
              status = getStatusValidacao(desvio);
            }
          } else if (med.tipo_teste === 'capacitancia' && med.capacitancia_medida_uf) {
            const capacitanciaTeorica = calcularCapacitanciaTeoricaDelta(capacitor.capacitancia_nominal_uf);
            if (capacitanciaTeorica > 0) {
              desvio = ((med.capacitancia_medida_uf - capacitanciaTeorica) / capacitanciaTeorica) * 100;
              status = getStatusValidacao(desvio);
            }
          }
        }
        
        await supabase
          .from('medicoes')
          .update({
            desvio_percentual: desvio,
            status_validacao: status
          })
          .eq('id', med.id);
      }
      
      Swal.fire('Sucesso', 'Todas as medições foram recalculadas!', 'success');
      fetchData();
    } catch (error) {
      Swal.fire('Erro', 'Erro ao recalcular medições', 'error');
    } finally {
      setRecalculando(false);
    }
  }

  async function downloadPDF() {
    if (!reportRef.current) return;

    try {
      Swal.fire({
        title: 'Gerando PDF...',
        text: 'Por favor, aguarde.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      const dataUrl = await toPng(reportRef.current, {
        quality: 1.0,
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(dataUrl);
      const contentHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, contentHeight);
      pdf.save(`Medicoes_${capacitor?.codigo_identificacao || 'capacitor'}.pdf`);
      
      Swal.close();
      Swal.fire('Sucesso', 'PDF gerado com sucesso!', 'success');
    } catch (error) {
      console.error('PDF Error:', error);
      Swal.close();
      Swal.fire('Erro', 'Falha ao gerar o PDF.', 'error');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!capacitor) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Capacitor não encontrado</p>
        <button onClick={() => router.back()} className="mt-4 text-primary hover:underline">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-primary hover:underline"
        >
          <ArrowLeft size={20} />
          Voltar
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-primary">Histórico de Medições</h1>
          <p className="text-slate-500">
            Capacitor: {capacitor.codigo_identificacao} - {capacitor.bancos_capacitores?.nome_banco}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={recalcularTodasMedicoes}
            disabled={recalculando}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <Activity size={16} className={recalculando ? 'animate-spin' : ''} />
            Recalcular
          </button>
          {medicoes.length > 0 && (
            <button
              onClick={downloadPDF}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90"
            >
              <Download size={16} />
              Exportar PDF
            </button>
          )}
        </div>
      </div>

      {/* Informações do Capacitor */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-6 border border-primary/20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-xs text-slate-500">Potência</p>
            <p className="text-xl font-bold text-primary">{capacitor.potencia_kvar} kVAr</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Tensão</p>
            <p className="text-xl font-bold text-primary">{capacitor.tensao_nominal_v} V</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Capacitância</p>
            <p className="text-xl font-bold text-primary">{capacitor.capacitancia_nominal_uf || '-'} µF</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Total de Medições</p>
            <p className="text-xl font-bold text-primary">{medicoes.length}</p>
          </div>
        </div>
      </div>

      {/* Container para PDF */}
      <div ref={reportRef} className="bg-white p-8 rounded-2xl shadow-sm">
        {/* Cabeçalho do PDF */}
        <div className="text-center mb-8 pb-4 border-b">
          <h2 className="text-2xl font-bold text-primary">Relatório de Medições</h2>
          <p className="text-slate-500">Capacitor: {capacitor.codigo_identificacao}</p>
          <p className="text-slate-500">Banco: {capacitor.bancos_capacitores?.nome_banco}</p>
          <p className="text-slate-500">Cliente: {capacitor.bancos_capacitores?.clientes?.nome}</p>
          <p className="text-xs text-slate-400 mt-2">Gerado em: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>

        {/* Tabela de Medições */}
        {medicoes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-sm font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Valor Teórico</th>
                  <th className="px-4 py-3">Valor Medido</th>
                  <th className="px-4 py-3">Desvio</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {medicoes.map((med) => (
                  <tr key={med.id} className="text-sm hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(med.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {med.tipo_teste === 'corrente' ? 'Corrente' : 'Capacitância'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {med.teoricoLabel}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {med.tipo_teste === 'corrente' 
                        ? `${med.corrente_medida_a?.toFixed(2)} A` 
                        : `${med.capacitancia_medida_uf?.toFixed(2)} µF`}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "font-bold",
                        med.desvio_percentual > 0 ? "text-red-500" : "text-green-500"
                      )}>
                        {med.desvio_percentual > 0 ? '+' : ''}{med.desvio_percentual?.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={med.status_validacao} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            <Calendar size={48} className="mx-auto mb-3 opacity-30" />
            <p>Nenhuma medição encontrada para este capacitor</p>
            <button
              onClick={() => router.push(`/testes?capacitor_id=${capacitor.id}`)}
              className="mt-4 text-primary hover:underline"
            >
              Realizar primeira medição →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente principal com Suspense
export default function MedicoesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MedicoesContent />
    </Suspense>
  );
}
