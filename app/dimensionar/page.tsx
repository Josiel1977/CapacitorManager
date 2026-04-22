'use client';

import React, { useState, useRef } from 'react';
import { 
  Calculator, Zap, TrendingUp, DollarSign, CheckCircle2, 
  Upload, FileText, X, Loader2, AlertTriangle, Plus,
  Trash2, Download, Printer, Package, Layers, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

// ============================================
// TIPOS
// ============================================
interface FaturaData {
  id: string;
  mes: string;
  consumoAtivoPonta: number;
  consumoAtivoForaPonta: number;
  demandaPonta: number;
  energiaReativaPonta: number;
  energiaReativaForaPonta: number;
  totalPagar: number;
  arquivoNome?: string;
}

interface TransformadorConfig {
  potencia: number;
  quantidade: number;
}

interface ResultadoDimensionamento {
  totalKvar: number;
  kvarPorTrafo: number[];
  economiaMensal: number;
  investimentoTotal: number;
  paybackMeses: number;
  fpAtual: number;
  fpProjetado: number;
  reducaoCorrentePercentual: number;
  distribuicao: { potencia: number; quantidade: number }[];
  faturasUtilizadas: number;
}

// ============================================
// FUNÇÃO PARA EXTRAIR DADOS DO PDF (SIMULADA)
// ============================================
async function extrairDadosPDF(file: File): Promise<Partial<FaturaData>> {
  // Em produção, aqui você usaria uma API de OCR/PDF parsing
  // Ex: pdf.js, AWS Textract, Google Document AI, etc.
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      // SIMULAÇÃO - Em produção, extraia os dados reais do PDF
      // Por enquanto, vamos gerar dados aleatórios realistas
      const dados = {
        consumoAtivoPonta: Math.floor(Math.random() * (3000 - 2000) + 2000),
        consumoAtivoForaPonta: Math.floor(Math.random() * (45000 - 35000) + 35000),
        demandaPonta: Math.floor(Math.random() * (350 - 250) + 250),
        energiaReativaPonta: Math.floor(Math.random() * (900 - 600) + 600),
        energiaReativaForaPonta: Math.floor(Math.random() * (6000 - 4000) + 4000),
        totalPagar: Math.floor(Math.random() * (40000 - 30000) + 30000)
      };
      resolve(dados);
    };
    reader.readAsDataURL(file);
  });
}

// ============================================
// COMPONENTE DE UPLOAD DE PDF
// ============================================
function PDFUpload({ onDataExtracted, onRemove, index }: { 
  onDataExtracted: (data: Partial<FaturaData>, file: File, index: number) => void;
  onRemove: (index: number) => void;
  index: number;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setExtracting(true);
      
      try {
        const dados = await extrairDadosPDF(selectedFile);
        const mesNome = `${selectedFile.name.slice(0, 7)}` || `Fatura ${index + 1}`;
        onDataExtracted({ ...dados, mes: mesNome, arquivoNome: selectedFile.name }, selectedFile, index);
        setExtracted(true);
      } catch (error) {
        console.error('Erro ao extrair PDF:', error);
        Swal.fire('Erro', 'Não foi possível ler o arquivo PDF', 'error');
      } finally {
        setExtracting(false);
      }
    } else {
      Swal.fire('Aviso', 'Por favor, selecione um arquivo PDF válido', 'warning');
    }
  };

  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-primary">Fatura {index + 1}</span>
        {!extracted && (
          <button onClick={() => onRemove(index)} className="text-red-400 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      
      {!file ? (
        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-primary transition-all">
          <div className="flex flex-col items-center justify-center pt-3 pb-2">
            <Upload size={20} className="text-slate-400 mb-1" />
            <p className="text-[10px] text-slate-500">Clique para enviar PDF</p>
          </div>
          <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
        </label>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            <span className="text-xs truncate max-w-[150px]">{file.name}</span>
          </div>
          {extracting ? (
            <Loader2 size={16} className="animate-spin text-primary" />
          ) : extracted ? (
            <CheckCircle2 size={16} className="text-green-500" />
          ) : null}
        </div>
      )}
    </div>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function DimensionarPage() {
  const [transformadores, setTransformadores] = useState<TransformadorConfig[]>([
    { potencia: 225, quantidade: 7 },
    { potencia: 75, quantidade: 1 }
  ]);
  
  const [faturas, setFaturas] = useState<FaturaData[]>([]);
  const [targetFP, setTargetFP] = useState<number>(0.92);
  const [resultado, setResultado] = useState<ResultadoDimensionamento | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const reportRef = useRef<HTMLDivElement>(null);

  const potenciaTotalTransformadores = transformadores.reduce((acc, t) => acc + (t.potencia * t.quantidade), 0);

  // Adicionar novo upload de PDF
  const addUploadField = () => {
    setUploadCount(uploadCount + 1);
  };

  // Remover upload
  const removeUpload = (index: number) => {
    setFaturas(faturas.filter((_, i) => i !== index));
    setUploadCount(uploadCount - 1);
  };

  // Processar dados extraídos do PDF
  const handleDataExtracted = (dados: Partial<FaturaData>, file: File, index: number) => {
    const novaFatura: FaturaData = {
      id: Date.now().toString() + index,
      mes: dados.mes || `Fatura ${faturas.length + 1}`,
      consumoAtivoPonta: dados.consumoAtivoPonta || 0,
      consumoAtivoForaPonta: dados.consumoAtivoForaPonta || 0,
      demandaPonta: dados.demandaPonta || 0,
      energiaReativaPonta: dados.energiaReativaPonta || 0,
      energiaReativaForaPonta: dados.energiaReativaForaPonta || 0,
      totalPagar: dados.totalPagar || 0,
      arquivoNome: file.name
    };
    
    setFaturas(prev => [...prev, novaFatura]);
  };

  // Carregar dados de exemplo (sua fatura real)
  const carregarFaturaExemplo = () => {
    const faturaExemplo: FaturaData = {
      id: 'exemplo1',
      mes: 'Fev/2026',
      consumoAtivoPonta: 2610,
      consumoAtivoForaPonta: 40616,
      demandaPonta: 293,
      energiaReativaPonta: 732,
      energiaReativaForaPonta: 5129,
      totalPagar: 34464.69,
      arquivoNome: 'Fatura_Exemplo.pdf'
    };
    setFaturas([faturaExemplo]);
    Swal.fire('Dados carregados!', 'Fatura exemplo adicionada com sucesso.', 'success');
  };

  // Carregar múltiplas faturas exemplo
  const carregarMultiplasFaturas = () => {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const ano = 2025;
    const faturasExemplo: FaturaData[] = meses.map((mes, idx) => ({
      id: `exemplo${idx}`,
      mes: `${mes}/${ano}`,
      consumoAtivoPonta: Math.floor(Math.random() * (3000 - 2000) + 2000),
      consumoAtivoForaPonta: Math.floor(Math.random() * (45000 - 35000) + 35000),
      demandaPonta: Math.floor(Math.random() * (350 - 250) + 250),
      energiaReativaPonta: Math.floor(Math.random() * (900 - 600) + 600),
      energiaReativaForaPonta: Math.floor(Math.random() * (6000 - 4000) + 4000),
      totalPagar: Math.floor(Math.random() * (40000 - 30000) + 30000),
      arquivoNome: `fatura_${mes}_${ano}.pdf`
    }));
    setFaturas(faturasExemplo);
    Swal.fire('Dados carregados!', '12 faturas de exemplo adicionadas.', 'success');
  };

  // Função principal de dimensionamento
  const calcularDimensionamento = () => {
    if (faturas.length === 0) {
      Swal.fire('Atenção', 'Carregue pelo menos uma fatura para dimensionar', 'warning');
      return;
    }

    setCalculando(true);
    
    try {
      // Calcular médias dos 3 piores meses (FP mais baixo)
      const faturasComFP = faturas.map(f => {
        const consumoTotal = f.consumoAtivoPonta + f.consumoAtivoForaPonta;
        const reativoTotal = f.energiaReativaPonta + f.energiaReativaForaPonta;
        const fp = consumoTotal / Math.sqrt(Math.pow(consumoTotal, 2) + Math.pow(reativoTotal, 2));
        const potenciaMedia = consumoTotal / 220; // 220 horas/mês típico
        return { ...f, fp, potenciaMedia };
      });

      // Ordenar por pior FP e pegar os 3 piores (ou todas se menos de 3)
      const numPiores = Math.min(3, faturasComFP.length);
      const pioresFaturas = [...faturasComFP].sort((a, b) => a.fp - b.fp).slice(0, numPiores);
      
      // Calcular médias dos piores meses
      const mediaPotencia = pioresFaturas.reduce((acc, f) => acc + f.potenciaMedia, 0) / pioresFaturas.length;
      const mediaFP = pioresFaturas.reduce((acc, f) => acc + f.fp, 0) / pioresFaturas.length;
      
      // Cálculo do capacitor necessário
      const phi1 = Math.acos(mediaFP);
      const phi2 = Math.acos(targetFP);
      const kvarProcesso = mediaPotencia * (Math.tan(phi1) - Math.tan(phi2));
      
      // Perdas no transformador (2.5% da potência total)
      const kvarTrafo = potenciaTotalTransformadores * 0.025;
      
      // Total de kVAr necessário
      let totalKvar = kvarProcesso + kvarTrafo;
      
      // Ajustar para o padrão de mercado (múltiplos de 5)
      totalKvar = Math.ceil(totalKvar / 5) * 5;
      
      // Distribuir entre os transformadores proporcionalmente
      const kvarPorTrafo: number[] = [];
      const trafosOrdenados = [...transformadores].sort((a, b) => b.potencia - a.potencia);
      for (const trafo of trafosOrdenados) {
        let kvarParaTrafo = Math.floor(totalKvar * (trafo.potencia * trafo.quantidade) / potenciaTotalTransformadores);
        kvarParaTrafo = Math.ceil(kvarParaTrafo / 5) * 5;
        for (let i = 0; i < trafo.quantidade; i++) {
          kvarPorTrafo.push(kvarParaTrafo);
        }
      }
      
      // Criar distribuição final (agrupar por potência)
      const distribuicaoMap = new Map<number, number>();
      for (const kvar of kvarPorTrafo) {
        distribuicaoMap.set(kvar, (distribuicaoMap.get(kvar) || 0) + 1);
      }
      const distribuicao = Array.from(distribuicaoMap.entries()).map(([potencia, quantidade]) => ({ potencia, quantidade }));
      
      // Calcular economia
      const energiaReativaMedia = pioresFaturas.reduce((acc, f) => acc + f.energiaReativaPonta + f.energiaReativaForaPonta, 0) / pioresFaturas.length;
      const economiaMensal = energiaReativaMedia * 0.31;
      const investimentoTotal = totalKvar * 89.9;
      const paybackMeses = economiaMensal > 0 ? Math.ceil(investimentoTotal / economiaMensal) : 0;
      const reducaoCorrentePercentual = ((mediaFP - targetFP) / mediaFP) * 100;
      
      setResultado({
        totalKvar,
        kvarPorTrafo,
        economiaMensal,
        investimentoTotal,
        paybackMeses,
        fpAtual: mediaFP,
        fpProjetado: targetFP,
        reducaoCorrentePercentual,
        distribuicao,
        faturasUtilizadas: faturas.length
      });
      
      Swal.fire({
        title: 'Dimensionamento Concluído!',
        html: `<p>Banco de capacitores recomendado: <strong>${totalKvar} kVAr</strong></p>
               <p>FP atual: ${(mediaFP * 100).toFixed(1)}% → FP projetado: ${(targetFP * 100).toFixed(0)}%</p>
               <p>Economia mensal estimada: <strong>R$ ${economiaMensal.toFixed(2)}</strong></p>
               <p>Baseado em ${faturas.length} fatura(s) - piores ${pioresFaturas.length} mês(es)</p>`,
        icon: 'success',
        confirmButtonColor: '#0a2b3c'
      });
      
    } catch (error) {
      console.error(error);
      Swal.fire('Erro', 'Erro ao calcular dimensionamento', 'error');
    } finally {
      setCalculando(false);
    }
  };

  const exportarPDF = async () => {
    if (!reportRef.current) return;
    try {
      Swal.fire({ title: 'Gerando PDF...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
      const dataUrl = await toPng(reportRef.current, { quality: 1.0, backgroundColor: '#ffffff', pixelRatio: 2 });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });
      const pdfHeight = (img.height * pdfWidth) / img.width;
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Dimensionamento_Capacitores_${new Date().toISOString().slice(0,10)}.pdf`);
      Swal.close();
      Swal.fire('PDF gerado!', 'Memorial exportado com sucesso.', 'success');
    } catch (error) {
      Swal.close();
      Swal.fire('Erro', 'Falha ao gerar PDF', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-primary">Dimensionamento de Banco de Capacitores</h1>
        <p className="text-slate-500 mt-2">Upload de faturas em PDF + Configuração dos transformadores</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Coluna de Entrada */}
        <div className="lg:col-span-5 space-y-6">
          {/* Configuração dos Transformadores */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
              <Package size={20} className="text-secondary" />
              Transformadores
            </h2>
            <div className="space-y-3">
              {transformadores.map((trafo, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="flex-1 flex gap-2">
                    <div className="flex-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase">Potência (kVA)</label>
                      <input type="number" value={trafo.potencia} onChange={(e) => {
                        const novos = [...transformadores];
                        novos[idx].potencia = parseFloat(e.target.value) || 0;
                        setTransformadores(novos);
                      }} className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
                    </div>
                    <div className="w-20">
                      <label className="text-[8px] font-black text-slate-400 uppercase">Quantidade</label>
                      <input type="number" value={trafo.quantidade} onChange={(e) => {
                        const novos = [...transformadores];
                        novos[idx].quantidade = parseInt(e.target.value) || 0;
                        setTransformadores(novos);
                      }} className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-primary/5 rounded-xl">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Potência Total:</span>
                <span className="font-bold text-primary">{potenciaTotalTransformadores} kVA</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-500">Referência:</span>
                <span className="font-bold text-secondary">7 x 225 kVA + 1 x 75 kVA</span>
              </div>
            </div>
          </div>

          {/* Upload de Faturas PDF */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                <FileText size={20} className="text-secondary" />
                Faturas em PDF
              </h2>
              <div className="flex gap-2">
                <button onClick={carregarFaturaExemplo} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-lg hover:bg-primary/20">
                  1 Exemplo
                </button>
                <button onClick={carregarMultiplasFaturas} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-lg hover:bg-primary/20">
                  12 Exemplo
                </button>
              </div>
            </div>
            
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {faturas.map((fatura, idx) => (
                <div key={fatura.id} className="bg-green-50 rounded-xl p-3 border border-green-200">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-green-600" />
                      <span className="text-xs font-medium">{fatura.mes}</span>
                      <span className="text-[10px] text-slate-400">{fatura.arquivoNome}</span>
                    </div>
                    <button onClick={() => removeUpload(idx)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1 mt-2 text-[9px]">
                    <div><span className="text-slate-500">kWh:</span> {fatura.consumoAtivoPonta + fatura.consumoAtivoForaPonta}</div>
                    <div><span className="text-slate-500">kVArh:</span> {fatura.energiaReativaPonta + fatura.energiaReativaForaPonta}</div>
                    <div><span className="text-slate-500">Demanda:</span> {fatura.demandaPonta} kW</div>
                    <div><span className="text-slate-500">R$:</span> {fatura.totalPagar.toFixed(0)}</div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 space-y-2">
              {[...Array(uploadCount)].map((_, idx) => (
                <PDFUpload 
                  key={idx}
                  index={faturas.length + idx}
                  onDataExtracted={handleDataExtracted}
                  onRemove={removeUpload}
                />
              ))}
              <button onClick={addUploadField} className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-bold hover:border-secondary hover:text-secondary transition-all flex items-center justify-center gap-2">
                <Plus size={14} /> Adicionar PDF de Fatura
              </button>
            </div>
            
            <div className="mt-3 text-[10px] text-slate-400 text-center">
              {faturas.length} fatura(s) carregada(s)
            </div>
          </div>

          {/* Meta e Calcular */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-2">Fator de Potência Desejado</label>
            <select 
              value={targetFP} 
              onChange={(e) => setTargetFP(parseFloat(e.target.value))}
              className="w-full rounded-xl border border-slate-200 p-3 mb-6"
            >
              <option value={0.92}>0.92 (mínimo regulamentar)</option>
              <option value={0.95}>0.95 (recomendado)</option>
              <option value={0.98}>0.98 (excelente)</option>
            </select>

            <button 
              onClick={calcularDimensionamento}
              disabled={calculando || faturas.length === 0}
              className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {calculando ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
              Dimensionar Banco de Capacitores
            </button>
            {faturas.length === 0 && (
              <p className="text-xs text-amber-600 mt-2 text-center">⚠️ Carregue pelo menos uma fatura em PDF</p>
            )}
          </div>
        </div>

        {/* Coluna de Resultados */}
        <div className="lg:col-span-7">
          {resultado ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Memorial */}
              <div ref={reportRef} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                <div className="bg-slate-900 p-6 text-white text-center">
                  <Zap size={32} className="mx-auto text-secondary mb-2" />
                  <h2 className="text-2xl font-black">CapacitorManager</h2>
                  <p className="text-slate-400 text-sm">Memorial de Dimensionamento</p>
                </div>
                
                <div className="p-6 space-y-6">
                  <div className="text-center">
                    <p className="text-sm text-slate-500">Potência Total Recomendada</p>
                    <p className="text-5xl font-bold text-primary">{resultado.totalKvar} <span className="text-2xl">kVAr</span></p>
                    <p className="text-xs text-slate-400 mt-1">Baseado em {resultado.faturasUtilizadas} fatura(s)</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-emerald-50 rounded-xl p-3 text-center">
                      <TrendingUp size={20} className="mx-auto text-emerald-600 mb-1" />
                      <p className="text-xs text-slate-500">FP Atual</p>
                      <p className="text-xl font-bold text-emerald-700">{(resultado.fpAtual * 100).toFixed(1)}%</p>
                    </div>
                    <div className="bg-primary/10 rounded-xl p-3 text-center">
                      <CheckCircle2 size={20} className="mx-auto text-primary mb-1" />
                      <p className="text-xs text-slate-500">FP Projetado</p>
                      <p className="text-xl font-bold text-primary">{(resultado.fpProjetado * 100).toFixed(0)}%</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-3 text-center">
                      <Zap size={20} className="mx-auto text-amber-600 mb-1" />
                      <p className="text-xs text-slate-500">Redução Corrente</p>
                      <p className="text-xl font-bold text-amber-700">{Math.abs(resultado.reducaoCorrentePercentual).toFixed(0)}%</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <h3 className="font-bold text-primary mb-3">📦 Distribuição dos Capacitores</h3>
                    <div className="space-y-2">
                      {resultado.distribuicao.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                          <span className="font-medium">{item.quantidade} bancos</span>
                          <span className="font-bold text-primary">{item.potencia} kVAr cada</span>
                          <span className="text-sm text-slate-500">Total: {item.quantidade * item.potencia} kVAr</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 rounded-xl p-4 text-center">
                      <DollarSign size={20} className="mx-auto text-green-600 mb-1" />
                      <p className="text-xs text-slate-500">Economia Mensal</p>
                      <p className="text-xl font-bold text-green-700">R$ {resultado.economiaMensal.toFixed(2)}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-4 text-center">
                      <DollarSign size={20} className="mx-auto text-blue-600 mb-1" />
                      <p className="text-xs text-slate-500">Investimento Estimado</p>
                      <p className="text-xl font-bold text-blue-700">R$ {resultado.investimentoTotal.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="bg-primary/5 rounded-xl p-4 text-center">
                    <p className="text-sm text-slate-500">⏱️ Payback Estimado</p>
                    <p className="text-2xl font-bold text-primary">{resultado.paybackMeses} meses</p>
                    <p className="text-xs text-slate-400">(~{(resultado.paybackMeses / 12).toFixed(1)} anos)</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={exportarPDF} className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50 flex items-center justify-center gap-2">
                  <Printer size={18} /> Exportar PDF
                </button>
                <button onClick={calcularDimensionamento} className="flex-1 bg-primary text-white py-3 rounded-xl font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
                  <Calculator size={18} /> Recalcular
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <Calculator size={64} className="text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-500">Aguardando Dimensionamento</h3>
              <p className="text-sm text-slate-400 mt-2 max-w-md">
                1. Configure os transformadores (7x225 kVA + 1x75 kVA)<br />
                2. Carregue as faturas em PDF<br />
                3. Clique em "Dimensionar"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}