'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart3, TrendingUp, AlertCircle, Zap, Download, Calendar, TrendingDown, Activity, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  BarElement
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Funções de cálculo
function calcularCapacitanciaTeoricaDelta(capacitanciaNominalFase: number): number {
    return capacitanciaNominalFase * 1.5;
}

function calcularCorrenteTeorica(potenciaKvar: number, tensaoNominal: number): number {
    if (!tensaoNominal || tensaoNominal === 0) return 0;
    return (potenciaKvar * 1000) / (Math.sqrt(3) * tensaoNominal);
}

export default function GraficosPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [bancos, setBancos] = useState<any[]>([]);
  const [capacitores, setCapacitores] = useState<any[]>([]);
  const [selectedCapacitor, setSelectedCapacitor] = useState('');
  const [selectedCapacitorData, setSelectedCapacitorData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [comparacaoCapacitores, setComparacaoCapacitores] = useState<any[]>([]);
  const chartRef = useRef<any>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const [selection, setSelection] = useState({
    cliente_id: '',
    banco_id: '',
  });

  useEffect(() => {
    const loadClientes = async () => {
      const { data } = await supabase.from('clientes').select('id, nome').eq('ativo', true).order('nome');
      setClientes(data || []);
    };
    loadClientes();
  }, []);

  useEffect(() => {
    const loadBancos = async () => {
      if (selection.cliente_id) {
        const { data } = await supabase.from('bancos_capacitores').select('id, nome_banco').eq('cliente_id', selection.cliente_id).eq('ativo', true).order('nome_banco');
        setBancos(data || []);
      } else {
        setBancos([]);
        setSelection(s => ({ ...s, banco_id: '' }));
        setSelectedCapacitor('');
      }
    };
    loadBancos();
  }, [selection.cliente_id]);

  useEffect(() => {
    const loadCapacitores = async () => {
      if (selection.banco_id) {
        const { data } = await supabase.from('capacitores').select('*, bancos_capacitores(nome_banco, cliente_id)').eq('banco_id', selection.banco_id).eq('ativo', true).order('codigo_identificacao');
        setCapacitores(data || []);
      } else {
        setCapacitores([]);
        setSelectedCapacitor('');
      }
    };
    loadCapacitores();
  }, [selection.banco_id]);

  useEffect(() => {
    const loadHistory = async () => {
      if (selectedCapacitor) {
        setLoading(true);
        
        // Buscar dados do capacitor
        const { data: capData } = await supabase
          .from('capacitores')
          .select('*, bancos_capacitores(nome_banco, cliente_id)')
          .eq('id', selectedCapacitor)
          .single();
        setSelectedCapacitorData(capData);
        
        // Buscar medições
        const { data } = await supabase
          .from('medicoes')
          .select('*')
          .eq('capacitor_id', selectedCapacitor)
          .order('created_at', { ascending: true });
        
        // Recalcular desvios com base na tensão nominal
        const processedData = data?.map(med => {
          let desvio = med.desvio_percentual;
          
          if (capData && med.tipo_teste === 'capacitancia' && med.capacitancia_medida_uf) {
            const teorico = calcularCapacitanciaTeoricaDelta(capData.capacitancia_nominal_uf);
            desvio = ((med.capacitancia_medida_uf - teorico) / teorico) * 100;
          } else if (capData && med.tipo_teste === 'corrente' && med.corrente_medida_a) {
            const tensao = capData.tensao_nominal_v;
            const teorico = calcularCorrenteTeorica(capData.potencia_kvar, tensao);
            desvio = ((med.corrente_medida_a - teorico) / teorico) * 100;
          }
          
          return { ...med, desvio_percentual: desvio };
        });
        
        setHistory(processedData || []);
        
        // Carregar comparação com outros capacitores do mesmo banco
        if (capData && selection.banco_id) {
          const { data: outrosCapacitores } = await supabase
            .from('capacitores')
            .select('id, codigo_identificacao, potencia_kvar, capacitancia_nominal_uf, tensao_nominal_v')
            .eq('banco_id', selection.banco_id)
            .eq('ativo', true);
          
          const comparacao = await Promise.all(
            (outrosCapacitores || []).map(async (cap) => {
              const { data: ultimaMed } = await supabase
                .from('medicoes')
                .select('desvio_percentual, created_at')
                .eq('capacitor_id', cap.id)
                .order('created_at', { ascending: false })
                .limit(1);
              
              let desvioFinal = ultimaMed?.[0]?.desvio_percentual;
              if (desvioFinal === null || desvioFinal === undefined) {
                if (cap.capacitancia_nominal_uf) {
                  const teorico = calcularCapacitanciaTeoricaDelta(cap.capacitancia_nominal_uf);
                  // Simular se não tiver medição
                  desvioFinal = 0;
                }
              }
              
              return {
                ...cap,
                ultimoDesvio: desvioFinal || 0,
                ultimaData: ultimaMed?.[0]?.created_at
              };
            })
          );
          
          setComparacaoCapacitores(comparacao);
        }
        
        setLoading(false);
      } else {
        setHistory([]);
        setSelectedCapacitorData(null);
        setComparacaoCapacitores([]);
      }
    };
    loadHistory();
  }, [selectedCapacitor, selection.banco_id]);

  // Previsão linear simples
  const getPrevisao = () => {
    if (history.length < 3) return null;
    
    const valores = history.map(h => h.desvio_percentual);
    const indices = valores.map((_, i) => i);
    const n = valores.length;
    
    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = valores.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((a, b, i) => a + b * valores[i], 0);
    const sumX2 = indices.reduce((a, b) => a + b * b, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Projetar próximas 3 medições
    const proximos = [];
    for (let i = n; i < n + 3; i++) {
      proximos.push(slope * i + intercept);
    }
    
    const atingir15 = slope > 0 ? (15 - intercept) / slope : null;
    
    return {
      slope,
      intercept,
      proximos,
      atingir15: atingir15 ? Math.round(atingir15 - n + 1) : null,
      tendencia: slope > 0.5 ? 'alta' : slope > 0 ? 'moderada' : 'estavel'
    };
  };
  
  const previsao = getPrevisao();

  // Gráfico de evolução do desvio
  const chartData = {
    labels: history.map(h => new Date(h.created_at).toLocaleDateString('pt-BR')),
    datasets: [
      {
        label: 'Desvio Percentual (%)',
        data: history.map(h => h.desvio_percentual),
        borderColor: '#f39c12',
        backgroundColor: 'rgba(243, 156, 18, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: history.map(h => 
          h.desvio_percentual >= -5 && h.desvio_percentual <= 10 ? '#2ecc71' : 
          h.desvio_percentual < -5 || h.desvio_percentual > 15 ? '#e74c3c' : '#f39c12'
        ),
      },
      {
        label: 'Limite Superior (+10%)',
        data: history.map(() => 10),
        borderColor: '#e74c3c',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
      },
      {
        label: 'Limite Inferior (-5%)',
        data: history.map(() => -5),
        borderColor: '#e74c3c',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  // Previsão futura
  const chartDataPrevisao = previsao && history.length > 0 ? {
    labels: [
      ...history.map(h => new Date(h.created_at).toLocaleDateString('pt-BR')),
      'Próx 1', 'Próx 2', 'Próx 3'
    ],
    datasets: [
      {
        label: 'Histórico',
        data: history.map(h => h.desvio_percentual),
        borderColor: '#f39c12',
        backgroundColor: 'rgba(243, 156, 18, 0.1)',
        tension: 0.4,
        pointRadius: 5,
      },
      {
        label: 'Projeção',
        data: [...history.map(() => null), ...previsao.proximos],
        borderColor: '#3498db',
        borderDash: [5, 5],
        pointRadius: 4,
        pointBackgroundColor: '#3498db',
      },
      {
        label: 'Limite Crítico (15%)',
        data: [...history.map(() => null), 15, 15, 15],
        borderColor: '#e74c3c',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
      },
    ],
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
      tooltip: {
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`
        }
      }
    },
    scales: {
      y: {
        grid: { color: '#f1f5f9' },
        ticks: { callback: (value: any) => `${value}%` },
        title: { display: true, text: 'Desvio (%)' }
      },
      x: { grid: { display: false }, title: { display: true, text: 'Data' } }
    }
  };

  // Gráfico de comparação entre capacitores
  const comparacaoChartData = {
    labels: comparacaoCapacitores.map(c => c.codigo_identificacao),
    datasets: [
      {
        label: 'Último Desvio (%)',
        data: comparacaoCapacitores.map(c => c.ultimoDesvio),
        backgroundColor: comparacaoCapacitores.map(c => 
          c.ultimoDesvio >= -5 && c.ultimoDesvio <= 10 ? '#2ecc71' :
          c.ultimoDesvio < -5 || c.ultimoDesvio > 15 ? '#e74c3c' : '#f39c12'
        ),
        borderRadius: 8,
      },
    ],
  };

  const comparacaoOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (context: any) => `Desvio: ${context.raw.toFixed(2)}%` } }
    },
    scales: { y: { ticks: { callback: (value: any) => `${value}%` }, title: { display: true, text: 'Desvio (%)' } } }
  };

  const firstMed = history[0];
  const lastMed = history[history.length - 1];
  const degradation = lastMed && firstMed ? lastMed.desvio_percentual - firstMed.desvio_percentual : 0;
  const mesesEntre = lastMed && firstMed ? 
    (new Date(lastMed.created_at).getTime() - new Date(firstMed.created_at).getTime()) / (1000 * 3600 * 24 * 30) : 0;
  const degradacaoMensal = mesesEntre > 0 ? degradation / mesesEntre : 0;

  async function exportarGrafico() {
    if (!chartRef.current) return;
    
    try {
      Swal.fire({ title: 'Exportando...', text: 'Aguarde', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      
      // Forçar visibilidade dos elementos do PDF durante a captura
      const header = document.querySelector('.pdf-header') as HTMLElement;
      const footer = document.querySelector('.pdf-footer') as HTMLElement;
      if (header) header.style.display = 'flex';
      if (footer) footer.style.display = 'block';

      const canvas = chartRef.current.toBase64Image();
      
      // Restaurar estado original
      if (header) header.style.display = 'none';
      if (footer) footer.style.display = 'none';

      const link = document.createElement('a');
      link.download = `grafico_${selectedCapacitorData?.codigo_identificacao || 'capacitor'}.png`;
      link.href = canvas;
      link.click();
      
      Swal.close();
      Swal.fire('Sucesso!', 'Gráfico exportado como imagem', 'success');
    } catch (error) {
      Swal.close();
      Swal.fire('Erro', 'Falha ao exportar gráfico', 'error');
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
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('graphics-report-container');
          if (el) {
            el.style.width = '794px';
            el.style.maxWidth = '794px';
            el.style.padding = '48px';
            el.style.margin = '0';
            el.style.boxShadow = 'none';
          }

          const modernColorRegex = /(?:oklch|oklab|hwb|display-p3|color)\((?:[^()]+|\([^()]*\))+\)/gi;
          const styleTags = Array.from(clonedDoc.getElementsByTagName('style'));
          styleTags.forEach(style => {
            try {
              let css = style.textContent || '';
              if (css.includes('oklch') || css.includes('oklab') || css.includes('@import')) {
                css = css.replace(/\/\*[\s\S]*?\*\//g, '');
                css = css.replace(/@import\s+url\([^)]+\);/gi, '');
                css = css.replace(modernColorRegex, '#1e293b');
                style.textContent = css;
              }
            } catch (e) {}
          });

          const linkTags = Array.from(clonedDoc.getElementsByTagName('link'));
          linkTags.forEach(link => {
            if (link.rel === 'stylesheet') {
              link.remove();
            }
          });

          const allElements = clonedDoc.getElementsByTagName('*');
          
          // Tornar elementos do PDF visíveis no clone
          const clonedHeader = clonedDoc.querySelector('.pdf-header') as HTMLElement;
          const clonedFooter = clonedDoc.querySelector('.pdf-footer') as HTMLElement;
          if (clonedHeader) clonedHeader.style.display = 'flex';
          if (clonedFooter) clonedFooter.style.display = 'block';

          for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i] as HTMLElement;
            
            // Forçar cores sólidas para evitar oklch em bordas e textos que o Tailwind v4 aplica
            if (el.classList.contains('text-primary')) el.style.color = '#0a2b3c';
            if (el.classList.contains('bg-primary')) el.style.backgroundColor = '#0a2b3c';
            if (el.classList.contains('border-primary')) el.style.borderColor = '#0a2b3c';
            if (el.classList.contains('text-secondary')) el.style.color = '#f39c12';
            if (el.classList.contains('bg-secondary')) el.style.backgroundColor = '#f39c12';

            try {
              if (el.style && el.style.cssText) {
                if (el.style.cssText.includes('oklch') || el.style.cssText.includes('oklab')) {
                  el.style.cssText = el.style.cssText.replace(modernColorRegex, '#0a2b3c');
                }
              }
              
              const style = window.getComputedStyle(el);
              if (style.color.includes('oklch') || style.color.includes('oklab')) {
                el.style.color = '#0a2b3c';
              }
              if (style.backgroundColor.includes('oklch') || style.backgroundColor.includes('oklab')) {
                if (!el.style.backgroundColor) el.style.backgroundColor = '#ffffff';
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

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, contentHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - contentHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, contentHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`Analise_Grafica_${selectedCapacitorData?.codigo_identificacao || 'capacitor'}.pdf`);
      
      Swal.close();
      Swal.fire('Sucesso', 'Relatório exportado com sucesso!', 'success');
    } catch (error) {
      console.error('PDF Error:', error);
      Swal.close();
      Swal.fire('Erro', 'Falha ao gerar o PDF.', 'error');
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Análise Gráfica</h1>
          <p className="text-slate-500">Acompanhe a evolução, tendência e compare capacitores</p>
        </div>
        {selectedCapacitor && (
          <button 
            onClick={downloadPDF}
            className="flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-2 font-bold text-white hover:bg-slate-700 transition-colors"
          >
            <FileText size={20} />
            Exportar PDF
          </button>
        )}
      </header>

      {/* Selectors */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Cliente</label>
            <select 
              className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
              value={selection.cliente_id}
              onChange={(e) => setSelection({...selection, cliente_id: e.target.value})}
            >
              <option value="">Selecione...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Banco</label>
            <select 
              disabled={!selection.cliente_id}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary disabled:bg-slate-50"
              value={selection.banco_id}
              onChange={(e) => setSelection({...selection, banco_id: e.target.value})}
            >
              <option value="">Selecione...</option>
              {bancos.map(b => <option key={b.id} value={b.id}>{b.nome_banco}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Capacitor</label>
            <select 
              disabled={!selection.banco_id}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary disabled:bg-slate-50"
              value={selectedCapacitor}
              onChange={(e) => setSelectedCapacitor(e.target.value)}
            >
              <option value="">Selecione...</option>
              {capacitores.map(c => <option key={c.id} value={c.id}>{c.codigo_identificacao} ({c.tensao_nominal_v}V - {c.potencia_kvar}kVAr)</option>)}
            </select>
          </div>
        </div>
      </div>

      {selectedCapacitor && selectedCapacitorData ? (
        <div className="flex justify-center overflow-x-auto pb-8">
          <div 
            id="graphics-report-container" 
            ref={reportRef}
            className="bg-white p-12 shadow-2xl space-y-8"
            style={{ width: '794px', minHeight: '1122px' }}
          >
            {/* Header para o PDF (Visível apenas no PDF via onclone ou se quisermos manter no preview) */}
          <div className="hidden pdf-header mb-8 flex flex-row items-center justify-between border-b-4 pb-8 gap-4" style={{ borderColor: '#EAB308', backgroundColor: '#0f172a', margin: '-24px -24px 24px -24px', padding: '24px' }}>
            <div className="flex items-center gap-4">
              <div className="rounded-2xl p-3 text-primary" style={{ backgroundColor: '#EAB308' }}>
                <Zap size={32} className="text-slate-900" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tighter uppercase" style={{ color: '#ffffff' }}>
                  CAPACITOR<span style={{ color: '#EAB308' }}>MANAGER</span>
                </h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Análise Gráfica e Tendência Técnica</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-500">DATA DE EMISSÃO</p>
              <p className="text-sm font-bold text-white">{new Date().toLocaleDateString('pt-BR')}</p>
            </div>
          </div>

          {/* Informações do Capacitor */}
          <div className="rounded-xl bg-gradient-to-r from-primary to-primary-light p-6 text-white shadow-sm">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold">{selectedCapacitorData.codigo_identificacao}</h2>
                <p className="text-white/70">{selectedCapacitorData.bancos_capacitores?.nome_banco}</p>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-xs text-white/50">TENSÃO</p>
                  <p className="text-xl font-bold">{selectedCapacitorData.tensao_nominal_v}V</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-white/50">POTÊNCIA</p>
                  <p className="text-xl font-bold">{selectedCapacitorData.potencia_kvar} kVAr</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-white/50">CAPACITÂNCIA</p>
                  <p className="text-xl font-bold">{selectedCapacitorData.capacitancia_nominal_uf} µF</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Main Chart */}
            <div className="lg:col-span-2 rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold text-primary">Evolução do Desvio</h2>
                  <p className="text-xs text-slate-400">Linhas vermelhas indicam os limites de tolerância (-5% e +10%)</p>
                </div>
                <button 
                  onClick={exportarGrafico}
                  className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200"
                >
                  <Download size={16} />
                  Exportar
                </button>
              </div>
              <div className="h-[400px]">
                {history.length > 0 ? (
                  <Line ref={chartRef} data={chartData} options={chartOptions} />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    Nenhuma medição encontrada para este capacitor
                  </div>
                )}
              </div>
            </div>

            {/* Analysis Sidebar */}
            <div className="space-y-6">
              <section className="rounded-xl bg-white p-6 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-primary">
                  <TrendingUp size={20} className="text-secondary" />
                  Análise de Tendência
                </h3>
                
                {history.length >= 2 ? (
                  <div className="space-y-6">
                    <div className="rounded-lg bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Degradação Total</p>
                      <p className={cn(
                        "text-2xl font-black",
                        degradation > 10 ? "text-red-600" : degradation > 5 ? "text-amber-600" : "text-green-600"
                      )}>
                        {degradation > 0 ? '+' : ''}{degradation?.toFixed(2)}%
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Comparação entre 1ª e última medição</p>
                    </div>

                    <div className="rounded-lg bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Degradação Mensal</p>
                      <p className={cn(
                        "text-xl font-bold",
                        degradacaoMensal > 2 ? "text-red-600" : degradacaoMensal > 1 ? "text-amber-600" : "text-green-600"
                      )}>
                        {degradacaoMensal > 0 ? '+' : ''}{degradacaoMensal?.toFixed(2)}% / mês
                      </p>
                    </div>

                    {previsao && previsao.atingir15 && previsao.atingir15 > 0 && (
                      <div className="rounded-lg bg-amber-50 p-4 border border-amber-200">
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Previsão de Substituição</p>
                        <p className="text-xl font-bold text-amber-700">~{previsao.atingir15} meses</p>
                        <p className="text-xs text-amber-600 mt-1">Baseado na tendência atual de degradação</p>
                      </div>
                    )}

                    {degradation > 10 && (
                      <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-600">
                        <AlertCircle className="shrink-0" size={20} />
                        <div>
                          <p className="text-sm font-bold">Alerta de Degradação!</p>
                          <p className="text-xs">A degradação ultrapassou 10%. Recomenda-se substituição preventiva.</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3 border-t border-slate-100 pt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Primeira Medição:</span>
                        <span className="font-medium">{new Date(firstMed.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Última Medição:</span>
                        <span className="font-medium">{new Date(lastMed.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Total de Testes:</span>
                        <span className="font-medium">{history.length}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-sm text-slate-400 py-8">
                    São necessárias pelo menos 2 medições para análise de tendência.
                  </p>
                )}
              </section>

              <section className="rounded-xl bg-primary p-6 text-white shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Zap className="text-secondary" size={20} />
                  <h3 className="font-bold">Info do Capacitor</h3>
                </div>
                <div className="space-y-2 text-sm text-white/70">
                  <p>• Tensão: {selectedCapacitorData.tensao_nominal_v}V</p>
                  <p>• Potência: {selectedCapacitorData.potencia_kvar} kVAr</p>
                  <p>• Capacitância: {selectedCapacitorData.capacitancia_nominal_uf} µF</p>
                  <p className="mt-3">Mantenha os testes em dia para garantir a eficiência energética do banco.</p>
                </div>
              </section>
            </div>
          </div>

          {/* Previsão Futura */}
          {previsao && history.length >= 3 && (
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-primary">
                <Calendar size={20} className="text-secondary" />
                Projeção Futura
              </h3>
              <div className="h-[300px]">
                <Line data={chartDataPrevisao!} options={chartOptions} />
              </div>
              <p className="mt-4 text-center text-xs text-slate-400">
                * Projeção baseada em regressão linear das últimas {history.length} medições. 
                {previsao.tendencia === 'alta' ? ' Tendência de degradação acelerada detectada.' : ' Tendência de degradação controlada.'}
              </p>
            </div>
          )}

          {/* Comparação com outros capacitores do mesmo banco */}
          {comparacaoCapacitores.length > 1 && (
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-primary">
                <BarChart3 size={20} className="text-secondary" />
                Comparação com outros capacitores do banco
              </h3>
              <div className="h-[300px]">
                <Bar data={comparacaoChartData} options={comparacaoOptions} />
              </div>
              <p className="mt-4 text-center text-xs text-slate-400">
                * Barras verdes: dentro da tolerância | Amarelas: atenção | Vermelhas: reprovado
              </p>
            </div>
          )}

          {/* Footer para o PDF */}
          <div className="hidden pdf-footer mt-auto border-t-4 pt-8 text-center" style={{ borderColor: '#EAB308', backgroundColor: '#f8fafc', margin: '24px -24px -24px -24px', padding: '24px' }}>
            <p className="text-xs font-bold text-slate-700">Este documento é uma análise gráfica técnica oficial gerada pelo sistema CapacitorManager.</p>
            <p className="text-[10px] text-slate-600 mt-2 font-medium">JM ELETRO SERVICE | contato@jmeletroservice.com.br</p>
          </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl bg-white py-24 shadow-sm text-slate-400">
          <BarChart3 size={64} className="mb-4 opacity-10" />
          <p className="text-lg">Selecione um capacitor para visualizar os gráficos</p>
        </div>
      )}
    </div>
  );
}