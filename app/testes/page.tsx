'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ClipboardCheck, Zap, Save, Calculator, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import { calculateCorrenteTeorica, calculateCapacitanciaTeoricaDelta, getStatusValidacao, cn, parseNumber } from '@/lib/utils';

export default function RealizarTestePage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [bancos, setBancos] = useState<any[]>([]);
  const [capacitores, setCapacitores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<any>(null);

  const [selection, setSelection] = useState({
    cliente_id: '',
    banco_id: '',
    capacitor_id: '',
    tipo_teste: 'corrente' as 'corrente' | 'capacitancia'
  });

  const [medicao, setMedicao] = useState({
    tensao_medida_v: '',
    corrente_medida_a: '',
    capacitancia_medida_uf: '',
  });

  const [resultado, setResultado] = useState<any>(null);

  useEffect(() => {
    setResultado(null);
  }, [selection, medicao]);

  const fetchClientes = React.useCallback(async () => {
    const { data } = await supabase.from('clientes').select('id, nome').eq('ativo', true).order('nome');
    setClientes(data || []);
  }, []);

  const fetchBancos = React.useCallback(async (clienteId: string) => {
    const { data } = await supabase.from('bancos_capacitores').select('id, nome_banco').eq('cliente_id', clienteId).eq('ativo', true).order('nome_banco');
    setBancos(data || []);
  }, []);

  const fetchCapacitores = React.useCallback(async (bancoId: string) => {
    const { data } = await supabase.from('capacitores').select('*').eq('banco_id', bancoId).eq('ativo', true).order('codigo_identificacao');
    setCapacitores(data || []);
  }, []);

  const fetchConfig = React.useCallback(async () => {
    try {
      const { data, error } = await supabase.from('configuracoes').select('*').eq('id', 'global').single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar configurações:', error.message);
      }

      if (data) {
        setConfig(data);
      } else {
        setConfig({
          tolerancia_min_aprovado: -5,
          tolerancia_max_aprovado: 10,
          tolerancia_min_atencao: -10,
          tolerancia_max_atencao: 15
        });
      }
    } catch (err) {
      console.error('Erro inesperado ao carregar configurações:', err);
      setConfig({
        tolerancia_min_aprovado: -5,
        tolerancia_max_aprovado: 10,
        tolerancia_min_atencao: -10,
        tolerancia_max_atencao: 15
      });
    }
  }, []);

  useEffect(() => {
    fetchClientes();
    fetchConfig();
  }, [fetchClientes, fetchConfig]);

  useEffect(() => {
    if (selection.cliente_id) fetchBancos(selection.cliente_id);
    else {
      setBancos([]);
      setSelection(s => ({ ...s, banco_id: '', capacitor_id: '' }));
    }
  }, [selection.cliente_id, fetchBancos]);

  useEffect(() => {
    if (selection.banco_id) fetchCapacitores(selection.banco_id);
    else {
      setCapacitores([]);
      setSelection(s => ({ ...s, capacitor_id: '' }));
    }
  }, [selection.banco_id, fetchCapacitores]);

  function handleCalcular() {
    if (!selection.capacitor_id) {
      Swal.fire('Atenção', 'Selecione um capacitor primeiro', 'warning');
      return;
    }

    const cap = capacitores.find(c => c.id === selection.capacitor_id);
    if (!cap) {
      Swal.fire('Erro', 'Capacitor não encontrado', 'error');
      return;
    }

    if (selection.tipo_teste === 'corrente') {
      const vMedida = parseNumber(medicao.tensao_medida_v);
      const iMedida = parseNumber(medicao.corrente_medida_a);
      
      if (vMedida === 0) {
        Swal.fire('Erro', 'Preencha o valor da tensão medida', 'error');
        return;
      }
      if (iMedida === 0) {
        Swal.fire('Erro', 'Preencha o valor da corrente medida', 'error');
        return;
      }

      const correnteTeorica = calculateCorrenteTeorica(cap.potencia_kvar, vMedida);
      const correnteNominal = calculateCorrenteTeorica(cap.potencia_kvar, cap.tensao_nominal_v);
      const desvio = ((iMedida - correnteTeorica) / correnteTeorica) * 100;
      const status = getStatusValidacao(desvio, config);
      const desvioExibicao = Math.round(desvio * 100) / 100;
      
      console.log('🔍 Cálculo Corrente:', {
        potencia: cap.potencia_kvar,
        tensao: vMedida,
        correnteMedida: iMedida,
        correnteTeorica: correnteTeorica.toFixed(4),
        desvioOriginal: desvio,
        desvioExibicao,
        status
      });
      
      setResultado({
        tipo: 'corrente',
        correnteTeorica,
        correnteNominal,
        tensaoMedida: vMedida,
        correnteMedida: iMedida,
        desvio: desvioExibicao,
        desvioOriginal: desvio,
        status
      });
      
    } else {
      const cMedida = parseNumber(medicao.capacitancia_medida_uf);
      
      if (cMedida === 0) {
        Swal.fire('Erro', 'Preencha o valor da capacitância medida', 'error');
        return;
      }

      const capacitanciaTeorica = calculateCapacitanciaTeoricaDelta(cap.capacitancia_nominal_uf);
      const desvio = ((cMedida - capacitanciaTeorica) / capacitanciaTeorica) * 100;
      const status = getStatusValidacao(desvio, config);
      const desvioExibicao = Math.round(desvio * 100) / 100;
      
      console.log('🔍 Cálculo Capacitância:', {
        nominalFase: cap.capacitancia_nominal_uf,
        teoricaEntreFases: capacitanciaTeorica,
        medida: cMedida,
        desvioOriginal: desvio,
        desvioExibicao,
        status
      });
      
      setResultado({
        tipo: 'capacitancia',
        capacitanciaTeorica,
        capacitanciaNominal: cap.capacitancia_nominal_uf,
        capacitanciaMedida: cMedida,
        desvio: desvioExibicao,
        desvioOriginal: desvio,
        status
      });
    }
  }

  // ============================================
  // 🔧 FUNÇÃO handleSalvar CORRIGIDA com LOGS
  // ============================================
  async function handleSalvar() {
    if (!resultado) {
      Swal.fire('Atenção', 'Calcule o resultado antes de salvar', 'warning');
      return;
    }

    try {
      setLoading(true);
      
      const vMedida = parseNumber(medicao.tensao_medida_v);
      const iMedida = parseNumber(medicao.corrente_medida_a);
      const cMedida = parseNumber(medicao.capacitancia_medida_uf);

      const payload: any = {
        capacitor_id: selection.capacitor_id,
        cliente_id: selection.cliente_id,
        banco_id: selection.banco_id,
        tipo_teste: selection.tipo_teste,
        desvio_percentual: resultado.desvioOriginal || resultado.desvio,
        status_validacao: resultado.status,
        created_at: new Date().toISOString()
      };

      if (selection.tipo_teste === 'corrente') {
        payload.tensao_medida_v = vMedida || null;
        payload.corrente_medida_a = iMedida || null;
        payload.corrente_teorica_a = resultado.correnteTeorica;
      } else {
        payload.capacitancia_medida_uf = cMedida || null;
        payload.capacitancia_teorica_uf = resultado.capacitanciaTeorica;
      }

      // 🔍 LOG EXTREMAMENTE DETALHADO
      console.log('========== DEBUG SALVAMENTO ==========');
      console.log('1. Status calculado:', resultado.status);
      console.log('2. Desvio calculado:', resultado.desvioOriginal || resultado.desvio);
      console.log('3. Corrente medida:', iMedida);
      console.log('4. Corrente teórica:', resultado.correnteTeorica);
      console.log('5. Payload completo:', JSON.stringify(payload, null, 2));
      console.log('======================================');

      const { data, error } = await supabase
        .from('medicoes')
        .insert([payload])
        .select();

      if (error) throw error;
      
      console.log('✅ MEDIÇÃO SALVA COM SUCESSO:', data);

      Swal.fire({
        title: 'Sucesso!',
        text: `Medição salva como ${resultado.status.toUpperCase()}`,
        icon: 'success'
      });
      
      setResultado(null);
      setMedicao({ tensao_medida_v: '', corrente_medida_a: '', capacitancia_medida_uf: '' });
      
    } catch (error: any) {
      console.error('❌ Erro CRÍTICO:', error);
      Swal.fire('Erro', error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function getRecomendacao(status: string): string {
    switch (status) {
      case 'aprovado':
        return '✅ O capacitor está operando dentro das tolerâncias normais. Manutenção preventiva regular.';
      case 'atencao':
        return '⚠️ O capacitor apresenta desvio moderado. Recomenda-se monitoramento quinzenal e nova medição em 30 dias.';
      case 'reprovado':
        return '❌ O capacitor está fora das especificações. Recomenda-se a substituição imediata para evitar danos ao sistema.';
      default:
        return 'Realize uma nova medição para avaliação.';
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-primary">Realizar Teste</h1>
        <p className="text-slate-500">Execute testes de validação em campo ou bancada</p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Selection Form */}
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-primary">
              <Zap className="text-secondary" size={20} />
              Identificação
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Capacitor</label>
                <select 
                  disabled={!selection.banco_id}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary disabled:bg-slate-50"
                  value={selection.capacitor_id}
                  onChange={(e) => setSelection({...selection, capacitor_id: e.target.value})}
                >
                  <option value="">Selecione...</option>
                  {capacitores.map(c => <option key={c.id} value={c.id}>{c.codigo_identificacao} ({c.potencia_kvar} kVAr - {c.tensao_nominal_v}V)</option>)}
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-primary">
              <ClipboardCheck className="text-secondary" size={20} />
              Medições
            </h2>
            
            <div className="mb-6 flex gap-4">
              <button 
                onClick={() => setSelection({...selection, tipo_teste: 'corrente'})}
                className={cn(
                  "flex-1 rounded-lg border py-3 text-sm font-medium transition-all",
                  selection.tipo_teste === 'corrente' ? "border-primary bg-primary text-white" : "border-slate-200 text-slate-600 hover:border-primary/50"
                )}
              >
                🔁 Teste por Corrente (Campo)
              </button>
              <button 
                onClick={() => setSelection({...selection, tipo_teste: 'capacitancia'})}
                className={cn(
                  "flex-1 rounded-lg border py-3 text-sm font-medium transition-all",
                  selection.tipo_teste === 'capacitancia' ? "border-primary bg-primary text-white" : "border-slate-200 text-slate-600 hover:border-primary/50"
                )}
              >
                📏 Teste por Capacitância (Bancada)
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {selection.tipo_teste === 'corrente' ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Tensão Medida (V)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="Ex: 220"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                      value={medicao.tensao_medida_v}
                      onChange={(e) => setMedicao({...medicao, tensao_medida_v: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Corrente Medida (A)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="Ex: 6.56"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                      value={medicao.corrente_medida_a}
                      onChange={(e) => setMedicao({...medicao, corrente_medida_a: e.target.value})}
                    />
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Capacitância Medida entre Fases (µF)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="Ex: 68.55"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                    value={medicao.capacitancia_medida_uf}
                    onChange={(e) => setMedicao({...medicao, capacitancia_medida_uf: e.target.value})}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    ⚠️ Para ligação delta, o valor teórico é Cfase × 1.5
                  </p>
                </div>
              )}
            </div>

            <button 
              onClick={handleCalcular}
              disabled={!selection.capacitor_id}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-secondary py-3 font-bold text-primary transition-all hover:bg-secondary/90 disabled:opacity-50"
            >
              <Calculator size={20} />
              Calcular Resultados
            </button>

            {config && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-[10px] text-slate-500">
                <p className="mb-1 font-bold uppercase tracking-wider">Tolerâncias IEC 60831-1:</p>
                <div className="flex justify-between">
                  <span>✅ Aprovado: {config.tolerancia_min_aprovado}% a {config.tolerancia_max_aprovado}%</span>
                  <span>⚠️ Atenção: {config.tolerancia_min_atencao}% a {config.tolerancia_max_atencao}%</span>
                  <span>❌ Reprovado: {'<'} {config.tolerancia_min_atencao}% ou {'>'} {config.tolerancia_max_atencao}%</span>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Results Panel */}
        <div className="space-y-6">
          <section className="rounded-xl bg-white p-6 shadow-sm min-h-[400px] flex flex-col">
            <h2 className="mb-6 text-lg font-semibold text-primary">Resultado da Análise</h2>
            
            {resultado ? (
              <div className="flex flex-1 flex-col justify-between">
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-sm text-slate-500">Desvio Encontrado</p>
                    <p className={cn(
                      "text-4xl font-black",
                      resultado.status === 'aprovado' ? "text-green-600" : 
                      resultado.status === 'atencao' ? "text-amber-600" : "text-red-600"
                    )}>
                      {resultado.desvio > 0 ? '+' : ''}{resultado.desvio.toFixed(2)}%
                    </p>
                  </div>

                  <div className="space-y-3 rounded-lg bg-slate-50 p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status:</span>
                      <span className={cn(
                        "font-bold uppercase",
                        resultado.status === 'aprovado' ? "text-green-600" : 
                        resultado.status === 'atencao' ? "text-amber-600" : "text-red-600"
                      )}>
                        {resultado.status === 'aprovado' ? '✅ APROVADO' : 
                         resultado.status === 'atencao' ? '⚠️ ATENÇÃO' : '❌ REPROVADO'}
                      </span>
                    </div>
                    
                    {resultado.tipo === 'corrente' ? (
                      <>
                        <div className="flex justify-between border-t border-slate-200 pt-2">
                          <span className="text-slate-500">Corrente Nominal ({capacitores.find(c => c.id === selection.capacitor_id)?.tensao_nominal_v}V):</span>
                          <span className="font-medium text-primary">{resultado.correnteNominal?.toFixed(2)} A</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Corrente Teórica ({resultado.tensaoMedida}V):</span>
                          <span className="font-medium text-primary">{resultado.correnteTeorica?.toFixed(2)} A</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Corrente Medida:</span>
                          <span className="font-medium text-primary">{resultado.correnteMedida?.toFixed(2)} A</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between border-t border-slate-200 pt-2">
                          <span className="text-slate-500">Capacitância Nominal (por fase):</span>
                          <span className="font-medium text-primary">{resultado.capacitanciaNominal?.toFixed(2)} µF</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Capacitância Teórica (entre fases):</span>
                          <span className="font-medium text-primary">{resultado.capacitanciaTeorica?.toFixed(2)} µF</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Capacitância Medida:</span>
                          <span className="font-medium text-primary">{resultado.capacitanciaMedida?.toFixed(2)} µF</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-100 p-4">
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                      <AlertCircle size={14} />
                      Recomendação
                    </h4>
                    <p className="text-xs text-slate-600">
                      {getRecomendacao(resultado.status)}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={handleSalvar}
                  disabled={loading}
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-50"
                >
                  <Save size={20} />
                  {loading ? 'Salvando...' : 'Salvar Medição'}
                </button>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-slate-400">
                <Calculator size={48} className="mb-4 opacity-20" />
                <p>Preencha os dados e clique em "Calcular" para ver o resultado.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}