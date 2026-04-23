'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import Swal from 'sweetalert2';
import { ArrowLeft, Activity, CheckCircle2, Zap } from 'lucide-react';

// ============================================================================
// FUNÇÕES DE CÁLCULO
// ============================================================================

/**
 * Calcula a corrente teórica do capacitor
 * @param potenciaKvar - Potência do capacitor em kVAr
 * @param tensaoNominal - Tensão nominal do capacitor (V)
 * @returns Corrente teórica em Amperes
 */
function calcularCorrenteTeorica(potenciaKvar: number, tensaoNominal: number): number {
  if (!tensaoNominal || tensaoNominal === 0) return 0;
  return (potenciaKvar * 1000) / (Math.sqrt(3) * tensaoNominal);
}

/**
 * Calcula a capacitância teórica com base na ligação
 * @param capacitanciaNominalFase - Capacitância nominal por fase em µF
 * @param ligacao - Tipo de ligação: 'delta' ou 'estrela'
 * @returns Capacitância teórica total em µF
 */
function calcularCapacitanciaTeorica(
  capacitanciaNominalFase: number,
  ligacao: 'delta' | 'estrela' = 'delta'
): number {
  if (!capacitanciaNominalFase || capacitanciaNominalFase === 0) return 0;
  
  if (ligacao === 'delta') {
    return capacitanciaNominalFase * 1.5; // Δ (Triângulo)
  } else {
    return capacitanciaNominalFase * 0.5; // Y (Estrela)
  }
}

/**
 * Determina o status de validação baseado no desvio
 */
function getStatusValidacao(desvio: number): string {
  if (desvio >= -5 && desvio <= 10) return 'aprovado';
  if (desvio >= -10 && desvio < -5) return 'atencao';
  if (desvio > 10 && desvio <= 15) return 'atencao';
  return 'reprovado';
}

/**
 * Obtém o rótulo da ligação
 */
function getLigacaoLabel(ligacao: string): string {
  if (ligacao === 'delta') return 'Δ (Triângulo)';
  if (ligacao === 'estrela') return 'Y (Estrela)';
  return '-';
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

function TestesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const capacitorId = searchParams.get('capacitor_id');
  
  const [capacitor, setCapacitor] = useState<any>(null);
  const [tipoTeste, setTipoTeste] = useState<'corrente' | 'capacitancia'>('corrente');
  const [valorMedido, setValorMedido] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (capacitorId) {
      carregarCapacitor();
    }
  }, [capacitorId]);

  async function carregarCapacitor() {
    const { data } = await supabase
      .from('capacitores')
      .select('*, bancos_capacitores(nome_banco)')
      .eq('id', capacitorId)
      .single();
    
    setCapacitor(data);
    setLoading(false);
  }

  async function handleSalvar() {
    if (!valorMedido || parseFloat(valorMedido) <= 0) {
      Swal.fire('Atenção', 'Informe um valor válido', 'warning');
      return;
    }

    setSalvando(true);

    try {
      let desvio = 0;
      let status = '';
      let teorico = 0;

      if (tipoTeste === 'corrente') {
        // ✅ CORRETO: usa a tensão NOMINAL do capacitor (IGNORA tensão medida)
        teorico = calcularCorrenteTeorica(
          capacitor.potencia_kvar, 
          capacitor.tensao_nominal_v
        );
        desvio = ((parseFloat(valorMedido) - teorico) / teorico) * 100;
        status = getStatusValidacao(desvio);
      } else {
        // ✅ CORRETO: usa a capacitância nominal e ligação
        teorico = calcularCapacitanciaTeorica(
          capacitor.capacitancia_nominal_uf,
          capacitor.ligacao || 'delta'
        );
        desvio = ((parseFloat(valorMedido) - teorico) / teorico) * 100;
        status = getStatusValidacao(desvio);
      }

      // Salvar (NÃO inclui tensao_medida_v)
      await supabase.from('medicoes').insert({
        capacitor_id: capacitor.id,
        tipo_teste: tipoTeste,
        corrente_medida_a: tipoTeste === 'corrente' ? parseFloat(valorMedido) : null,
        capacitancia_medida_uf: tipoTeste === 'capacitancia' ? parseFloat(valorMedido) : null,
        desvio_percentual: desvio,
        status_validacao: status
      });

      Swal.fire('Sucesso', 'Medição salva com sucesso!', 'success');
      router.push(`/medicoes?capacitor_id=${capacitor.id}`);
    } catch (error) {
      console.error(error);
      Swal.fire('Erro', 'Erro ao salvar medição', 'error');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
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
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-primary hover:underline"
        >
          <ArrowLeft size={20} />
          Voltar
        </button>
        <div>
          <h1 className="text-2xl font-bold text-primary">Nova Medição</h1>
          <p className="text-slate-500">
            {capacitor.codigo_identificacao} - {capacitor.bancos_capacitores?.nome_banco}
          </p>
        </div>
      </div>

      {/* Card do Capacitor */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-6 border border-primary/20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-xs text-slate-500">Potência</p>
            <p className="text-xl font-bold text-primary">{capacitor.potencia_kvar} kVAr</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Tensão Nominal</p>
            <p className="text-xl font-bold text-primary">{capacitor.tensao_nominal_v} V</p>
            <p className="text-[10px] text-blue-600">✅ Usada na validação</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Ligação</p>
            <p className="text-xl font-bold text-primary">
              {getLigacaoLabel(capacitor.ligacao || 'delta')}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Capacitância</p>
            <p className="text-xl font-bold text-primary">
              {capacitor.capacitancia_nominal_uf || '-'} µF/fase
            </p>
          </div>
        </div>
      </div>

      {/* Formulário de Medição */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        {/* Tipo de Teste */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Tipo de Teste
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => {
                setTipoTeste('corrente');
                setValorMedido('');
              }}
              className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                tipoTeste === 'corrente' 
                  ? 'bg-primary text-white' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <Zap size={18} />
              Corrente (A)
            </button>
            <button
              onClick={() => {
                setTipoTeste('capacitancia');
                setValorMedido('');
              }}
              className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                tipoTeste === 'capacitancia' 
                  ? 'bg-primary text-white' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <Zap size={18} />
              Capacitância (µF)
            </button>
          </div>
        </div>

        {/* Valor Medido */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Valor Medido ({tipoTeste === 'corrente' ? 'Amperes (A)' : 'Microfarads (µF)'})
          </label>
          <input
            type="number"
            step={tipoTeste === 'corrente' ? '0.01' : '0.1'}
            placeholder={tipoTeste === 'corrente' ? 'Ex: 13.1' : 'Ex: 205.5'}
            value={valorMedido}
            onChange={(e) => setValorMedido(e.target.value)}
            className="w-full rounded-xl border border-slate-200 p-3 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          
          {/* Informação sobre o cálculo */}
          {tipoTeste === 'corrente' && (
            <div className="mt-2 text-xs text-blue-600 bg-blue-50 p-2 rounded-lg">
              <p>🔍 <strong>Validação por Corrente:</strong></p>
              <p>I teórica = {capacitor.potencia_kvar} kVAr × 1000 / (√3 × {capacitor.tensao_nominal_v}V)</p>
              <p>I teórica = {(capacitor.potencia_kvar * 1000 / (Math.sqrt(3) * capacitor.tensao_nominal_v)).toFixed(2)} A</p>
              <p className="mt-1 text-blue-700">✅ <strong>Não é necessário medir a tensão!</strong> A validação usa a tensão nominal do capacitor.</p>
            </div>
          )}
          
          {tipoTeste === 'capacitancia' && (
            <div className="mt-2 text-xs text-purple-600 bg-purple-50 p-2 rounded-lg">
              <p>🔍 <strong>Validação por Capacitância:</strong></p>
              <p>C teórica = {capacitor.capacitancia_nominal_uf} µF × {capacitor.ligacao === 'delta' ? '1,5 (Δ)' : '0,5 (Y)'}</p>
              <p>C teórica = {(capacitor.capacitancia_nominal_uf * (capacitor.ligacao === 'delta' ? 1.5 : 0.5)).toFixed(2)} µF</p>
            </div>
          )}
        </div>

        {/* Botão Salvar */}
        <button
          onClick={handleSalvar}
          disabled={salvando}
          className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {salvando ? <Activity className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
          Salvar Medição
        </button>
      </div>

      {/* Informação Adicional */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-bold mb-1">📌 Atenção:</p>
        <p>
          A validação do capacitor é feita pela <strong>Tensão Nominal</strong> (etiqueta do equipamento),
          não sendo necessário medir a tensão da rede no momento do teste.
        </p>
        <p className="mt-1 text-xs">
          Exemplo: Um capacitor 10 kVAr / 440V mesmo sendo testado em 220V, continuará sendo validado como 10 kVAr.
        </p>
      </div>
    </div>
  );
}

// Componente principal com Suspense
export default function TestesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-64">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <TestesContent />
    </Suspense>
  );
}