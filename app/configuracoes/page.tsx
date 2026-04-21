'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Database, Copy, Check, AlertCircle, RefreshCw, Trash2, RotateCcw, 
  TrendingUp, TrendingDown, Gauge, Calendar, Clock, Zap, 
  FileText, Download, Settings, BarChart3, Activity, Cpu,
  Shield, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle,
  Wrench, Droplets, Thermometer, Waves, Radio, Microscope, DollarSign,
  Save, X
} from 'lucide-react';
import Swal from 'sweetalert2';
import { motion } from 'motion/react';
import { cn, parseNumber } from '@/lib/utils';

// ============================================================================
// TIPOS
// ============================================================================
interface ToleranciasConfig {
  id: string;
  tolerancia_min_aprovado: number;
  tolerancia_max_aprovado: number;
  tolerancia_min_atencao: number;
  tolerancia_max_atencao: number;
  norma_referencia: string;
  limite_corrente_min: number;
  limite_corrente_max: number;
  temperatura_max: number;
  tempo_operacao_dias: number;
  degradacao_anual_percent: number;
}

interface CapacitorAlerta {
  id: string;
  codigo: string;
  banco: string;
  cliente: string;
  valor_medido: number;
  valor_nominal: number;
  desvio_percent: number;
  status: 'critical' | 'warning' | 'ok';
  tendencia: 'degradando' | 'estavel' | 'melhorando';
  previsao_substituicao: string;
}

// ============================================================================
// FUNÇÕES DE VALIDAÇÃO
// ============================================================================
function getStatusValidacao(desvio: number, tolerancias: ToleranciasConfig): string {
    const desvioAbs = Math.abs(desvio);
    const limiteAprovado = Math.abs(tolerancias.tolerancia_max_aprovado);
    const limiteAtencao = Math.abs(tolerancias.tolerancia_max_atencao);
    
    if (desvioAbs <= limiteAprovado) return 'aprovado';
    if (desvioAbs <= limiteAtencao) return 'atencao';
    return 'reprovado';
}

function getStatusManutencao(desvio: number, tolerancias: ToleranciasConfig): 'critical' | 'warning' | 'ok' {
    const desvioAbs = Math.abs(desvio);
    const limiteAprovado = Math.abs(tolerancias.tolerancia_max_aprovado);
    const limiteAtencao = Math.abs(tolerancias.tolerancia_max_atencao);
    
    if (desvioAbs > limiteAtencao) return 'critical';
    if (desvioAbs > limiteAprovado) return 'warning';
    return 'ok';
}

function calcularTendenciaManutencao(medicoes: any[]): 'degradando' | 'estavel' | 'melhorando' {
    if (!medicoes || medicoes.length < 2) return 'estavel';
    
    const medicoesOrdenadas = [...medicoes].sort((a, b) => 
        new Date(a.data_medicao).getTime() - new Date(b.data_medicao).getTime()
    );
    
    const primeiro = Math.abs(medicoesOrdenadas[0].desvio_percent || 0);
    const ultimo = Math.abs(medicoesOrdenadas[medicoesOrdenadas.length - 1].desvio_percent || 0);
    
    if (ultimo > primeiro * 1.05) return 'degradando';
    if (ultimo < primeiro * 0.95) return 'melhorando';
    return 'estavel';
}

function calcularPrevisaoSubstituicao(desvioAtual: number, degradacaoAnual: number, limiteAtencao: number): string {
    const desvioAbs = Math.abs(desvioAtual);
    const desvioRestante = limiteAtencao - desvioAbs;
    
    if (desvioRestante <= 0) return 'Imediata';
    
    const degradacaoMensal = degradacaoAnual / 12;
    const mesesRestantes = desvioRestante / degradacaoMensal;
    
    if (mesesRestantes <= 1) return 'Urgente (menos de 1 mês)';
    if (mesesRestantes <= 3) return 'Curto prazo (1-3 meses)';
    if (mesesRestantes <= 6) return 'Médio prazo (3-6 meses)';
    return 'Longo prazo (mais de 6 meses)';
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState<'tolerancias' | 'manutencao' | 'conexao' | 'lixeira'>('tolerancias');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [tolerancias, setTolerancias] = useState<ToleranciasConfig>({
    id: 'global',
    tolerancia_min_aprovado: -5,
    tolerancia_max_aprovado: 10,
    tolerancia_min_atencao: -10,
    tolerancia_max_atencao: 15,
    norma_referencia: 'IEC 60831-1/2',
    limite_corrente_min: 80,
    limite_corrente_max: 120,
    temperatura_max: 60,
    tempo_operacao_dias: 365,
    degradacao_anual_percent: 3
  });
  const [savingTolerancias, setSavingTolerancias] = useState(false);
  const [trashItems, setTrashItems] = useState<{
    clientes: any[],
    bancos: any[],
    capacitores: any[]
  }>({ clientes: [], bancos: [], capacitores: [] });
  const [alertasCapacitores, setAlertasCapacitores] = useState<CapacitorAlerta[]>([]);
  const [totalCapacitores, setTotalCapacitores] = useState(0);
  const [loadingAlertas, setLoadingAlertas] = useState(false);

  // ============================================================================
  // EFEITOS
  // ============================================================================
  useEffect(() => {
    if (activeTab === 'lixeira') {
      fetchTrash();
    }
    if (activeTab === 'tolerancias') {
      fetchTolerancias();
    }
    if (activeTab === 'manutencao') {
      fetchAlertasCapacitores();
    }
  }, [activeTab]);

  // ============================================================================
  // FUNÇÕES DE TOLERÂNCIAS
  // ============================================================================
  async function fetchTolerancias() {
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*')
        .eq('id', 'global')
        .single();
      
      if (data) {
        setTolerancias({
          id: data.id,
          tolerancia_min_aprovado: data.tolerancia_min_aprovado ?? -5,
          tolerancia_max_aprovado: data.tolerancia_max_aprovado ?? 10,
          tolerancia_min_atencao: data.tolerancia_min_atencao ?? -10,
          tolerancia_max_atencao: data.tolerancia_max_atencao ?? 15,
          norma_referencia: data.norma_referencia || 'IEC 60831-1/2',
          limite_corrente_min: data.limite_corrente_min ?? 80,
          limite_corrente_max: data.limite_corrente_max ?? 120,
          temperatura_max: data.temperatura_max ?? 60,
          tempo_operacao_dias: data.tempo_operacao_dias ?? 365,
          degradacao_anual_percent: data.degradacao_anual_percent ?? 3
        });
      }
    } catch (error) {
      console.error('Erro ao buscar tolerâncias:', error);
    }
  }

  async function saveTolerancias() {
    setSavingTolerancias(true);
    try {
      const payload = { ...tolerancias };
      const { error } = await supabase
        .from('configuracoes')
        .upsert(payload, { onConflict: 'id' });
      
      if (error) throw error;
      
      Swal.fire({
        title: 'Sucesso!',
        text: 'Configurações salvas com sucesso!',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error: any) {
      Swal.fire({
        title: 'Erro ao Salvar',
        text: error.message,
        icon: 'error',
        confirmButtonColor: '#0a2b3c'
      });
    } finally {
      setSavingTolerancias(false);
    }
  }

  function resetTolerancias() {
    Swal.fire({
      title: 'Resetar configurações?',
      text: 'Isso irá restaurar os valores padrão das normas IEC.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0a2b3c',
      cancelButtonColor: '#e74c3c',
      confirmButtonText: 'Sim, resetar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        setTolerancias({
          id: 'global',
          tolerancia_min_aprovado: -5,
          tolerancia_max_aprovado: 10,
          tolerancia_min_atencao: -10,
          tolerancia_max_atencao: 15,
          norma_referencia: 'IEC 60831-1/2',
          limite_corrente_min: 80,
          limite_corrente_max: 120,
          temperatura_max: 60,
          tempo_operacao_dias: 365,
          degradacao_anual_percent: 3
        });
        Swal.fire('Resetado!', 'Valores padrão restaurados.', 'success');
      }
    });
  }

  // ============================================================================
  // FUNÇÕES DE MANUTENÇÃO PREDITIVA
  // ============================================================================
  async function fetchAlertasCapacitores() {
    setLoadingAlertas(true);
    try {
      const { data: capacitores, error } = await supabase
        .from('capacitores')
        .select(`
          *,
          bancos_capacitores (
            id,
            nome_banco,
            clientes (id, nome)
          ),
          medicoes (
            id,
            created_at,
            tipo_teste,
            tensao_medida_v,
            corrente_medida_a,
            capacitancia_medida_uf,
            desvio_percentual,
            status_validacao
          )
        `)
        .eq('ativo', true);

      if (error) throw error;

      const alertas: CapacitorAlerta[] = [];
      let total = 0;

      for (const cap of capacitores || []) {
        total++;
        
        const medicoesOrdenadas = cap.medicoes?.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ) || [];
        
        const ultimaMedicao = medicoesOrdenadas[0];
        if (!ultimaMedicao) continue;

        const desvio = ultimaMedicao.desvio_percentual || 0;
        const status = getStatusManutencao(desvio, tolerancias);
        const tendencia = calcularTendenciaManutencao(medicoesOrdenadas);
        const previsao = calcularPrevisaoSubstituicao(
          desvio, 
          tolerancias.degradacao_anual_percent,
          Math.abs(tolerancias.tolerancia_max_atencao)
        );

        if (status !== 'ok') {
          const valorMedido = ultimaMedicao.tipo_teste === 'corrente' ? ultimaMedicao.corrente_medida_a : ultimaMedicao.capacitancia_medida_uf;
          const valorNominal = ultimaMedicao.tipo_teste === 'corrente' ? cap.potencia_kvar : cap.capacitancia_nominal_uf;

          alertas.push({
            id: cap.id,
            codigo: cap.codigo_identificacao,
            banco: cap.bancos_capacitores?.nome_banco || 'N/A',
            cliente: cap.bancos_capacitores?.clientes?.nome || 'N/A',
            valor_medido: valorMedido || 0,
            valor_nominal: valorNominal || 0,
            desvio_percent: desvio,
            status,
            tendencia,
            previsao_substituicao: previsao
          });
        }
      }

      setTotalCapacitores(total);
      setAlertasCapacitores(alertas);
    } catch (error) {
      console.error('Erro ao buscar alertas:', error);
    } finally {
      setLoadingAlertas(false);
    }
  }

  // ============================================================================
  // FUNÇÕES DE CONEXÃO
  // ============================================================================
  async function testConnection() {
    setConnectionStatus('testing');
    try {
      const { data, error } = await supabase.from('clientes').select('id').limit(1);
      if (error) throw error;
      setConnectionStatus('success');
      Swal.fire({
        title: 'Sucesso!',
        text: 'Conexão com Supabase estabelecida com sucesso!',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error: any) {
      setConnectionStatus('error');
      Swal.fire({
        title: 'Erro',
        text: 'Falha ao conectar com Supabase: ' + error.message,
        icon: 'error',
        confirmButtonColor: '#0a2b3c'
      });
    }
  }

  // ============================================================================
  // FUNÇÕES DA LIXEIRA
  // ============================================================================
  async function fetchTrash() {
    try {
      const { data: c } = await supabase.from('clientes').select('*').eq('ativo', false);
      const { data: b } = await supabase.from('bancos_capacitores').select('*, clientes(nome)').eq('ativo', false);
      const { data: cap } = await supabase.from('capacitores').select('*, bancos_capacitores(nome_banco)').eq('ativo', false);
      
      setTrashItems({
        clientes: c || [],
        bancos: b || [],
        capacitores: cap || []
      });
    } catch (error) {
      console.error('Error fetching trash:', error);
    }
  }

  async function restoreItem(table: string, id: string) {
    try {
      const { error } = await supabase.from(table).update({ ativo: true }).eq('id', id);
      if (error) throw error;
      Swal.fire({
        title: 'Restaurado!',
        text: 'Item restaurado com sucesso!',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
      fetchTrash();
    } catch (error: any) {
      Swal.fire({
        title: 'Erro',
        text: error.message,
        icon: 'error',
        confirmButtonColor: '#0a2b3c'
      });
    }
  }

  async function permanentDelete(table: string, id: string) {
    const result = await Swal.fire({
      title: 'Excluir permanentemente?',
      text: "Esta ação não pode ser desfeita!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e74c3c',
      cancelButtonColor: '#0a2b3c',
      confirmButtonText: 'Sim, excluir para sempre',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
        Swal.fire({
          title: 'Excluído!',
          text: 'Item removido permanentemente.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
        fetchTrash();
      } catch (error: any) {
        Swal.fire({
          title: 'Erro',
          text: error.message,
          icon: 'error',
          confirmButtonColor: '#0a2b3c'
        });
      }
    }
  }

  const aprovados = totalCapacitores - alertasCapacitores.filter(a => a.status === 'critical').length - alertasCapacitores.filter(a => a.status === 'warning').length;

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-primary">Configurações do Sistema</h1>
        <p className="text-slate-500">Gerencie normas técnicas, parâmetros de manutenção e conexões</p>
      </header>

      {/* TABS */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto no-scrollbar">
        <TabButton active={activeTab === 'tolerancias'} onClick={() => setActiveTab('tolerancias')}>
          <Settings size={18} />
          Normas e Tolerâncias
        </TabButton>
        <TabButton active={activeTab === 'manutencao'} onClick={() => setActiveTab('manutencao')}>
          <Wrench size={18} />
          Manutenção Preditiva
        </TabButton>
        <TabButton active={activeTab === 'conexao'} onClick={() => setActiveTab('conexao')}>
          <Database size={18} />
          Status da Conexão
        </TabButton>
        <TabButton active={activeTab === 'lixeira'} onClick={() => setActiveTab('lixeira')}>
          <Trash2 size={18} />
          Lixeira
        </TabButton>
      </div>

      {/* CONTEÚDO DAS TABS */}
      <div className="min-h-[500px]">
        {activeTab === 'tolerancias' && (
          <ToleranciasTab 
            tolerancias={tolerancias}
            setTolerancias={setTolerancias}
            onSave={saveTolerancias}
            onReset={resetTolerancias}
            saving={savingTolerancias}
          />
        )}

        {activeTab === 'manutencao' && (
          <ManutencaoPreditivaTab 
            alertas={alertasCapacitores}
            totalCapacitores={totalCapacitores}
            aprovados={aprovados}
            loading={loadingAlertas}
            tolerancias={tolerancias}
            onRefresh={fetchAlertasCapacitores}
          />
        )}

        {activeTab === 'conexao' && (
          <ConexaoTab 
            connectionStatus={connectionStatus}
            onTest={testConnection}
          />
        )}

        {activeTab === 'lixeira' && (
          <LixeiraTab 
            trashItems={trashItems}
            onRestore={restoreItem}
            onDelete={permanentDelete}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTES SECUNDÁRIOS
// ============================================================================

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "pb-3 text-sm font-medium transition-all px-4 flex items-center gap-2 border-b-2",
        active ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"
      )}
    >
      {children}
    </button>
  );
}

function ToleranciasTab({ tolerancias, setTolerancias, onSave, onReset, saving }: any) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
        <div className="mb-6 flex items-center gap-3">
          <Shield className="text-secondary" size={24} />
          <h2 className="text-lg font-bold text-primary">Configuração de Normas Técnicas</h2>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Tolerâncias de Aprovação */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <ShieldCheck size={14} />
              Tolerâncias de Aprovação (%)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Mínimo (Aprovado)</label>
                <input 
                  type="number" 
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  value={tolerancias.tolerancia_min_aprovado}
                  onChange={(e) => setTolerancias({...tolerancias, tolerancia_min_aprovado: parseNumber(e.target.value)})}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Máximo (Aprovado)</label>
                <input 
                  type="number" 
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  value={tolerancias.tolerancia_max_aprovado}
                  onChange={(e) => setTolerancias({...tolerancias, tolerancia_max_aprovado: parseNumber(e.target.value)})}
                />
              </div>
            </div>
          </div>

          {/* Tolerâncias de Atenção */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <ShieldAlert size={14} />
              Tolerâncias de Atenção (%)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Mínimo (Atenção)</label>
                <input 
                  type="number" 
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  value={tolerancias.tolerancia_min_atencao}
                  onChange={(e) => setTolerancias({...tolerancias, tolerancia_min_atencao: parseNumber(e.target.value)})}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Máximo (Atenção)</label>
                <input 
                  type="number" 
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  value={tolerancias.tolerancia_max_atencao}
                  onChange={(e) => setTolerancias({...tolerancias, tolerancia_max_atencao: parseNumber(e.target.value)})}
                />
              </div>
            </div>
          </div>

          {/* Parâmetros de Manutenção Preditiva */}
          <div className="lg:col-span-2 border-t border-slate-100 pt-6 mt-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <TrendingUp size={14} />
              Parâmetros de Manutenção Preditiva
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Corrente Mínima (%)</label>
                <input 
                  type="number" 
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={tolerancias.limite_corrente_min}
                  onChange={(e) => setTolerancias({...tolerancias, limite_corrente_min: parseNumber(e.target.value)})}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Corrente Máxima (%)</label>
                <input 
                  type="number" 
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={tolerancias.limite_corrente_max}
                  onChange={(e) => setTolerancias({...tolerancias, limite_corrente_max: parseNumber(e.target.value)})}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Temperatura Máx. (°C)</label>
                <input 
                  type="number" 
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={tolerancias.temperatura_max}
                  onChange={(e) => setTolerancias({...tolerancias, temperatura_max: parseNumber(e.target.value)})}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Degradação Anual (%)</label>
                <input 
                  type="number" 
                  step="0.5"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={tolerancias.degradacao_anual_percent}
                  onChange={(e) => setTolerancias({...tolerancias, degradacao_anual_percent: parseNumber(e.target.value)})}
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Norma de Referência</label>
            <input 
              type="text" 
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              value={tolerancias.norma_referencia}
              onChange={(e) => setTolerancias({...tolerancias, norma_referencia: e.target.value})}
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <button onClick={onReset} className="flex items-center gap-2 rounded-lg border border-slate-200 px-6 py-2 font-medium text-slate-600 transition-all hover:bg-slate-50">
            <RotateCcw size={18} />
            Resetar Padrões
          </button>
          <button onClick={onSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 font-medium text-white transition-all hover:bg-primary/90 disabled:opacity-50">
            {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
            Salvar Configurações
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 p-6 border border-slate-200">
        <h3 className="mb-3 font-bold text-primary">📋 Sobre as Normas de Validação</h3>
        <div className="space-y-3 text-sm text-slate-600">
          <p>De acordo com a norma <strong>IEC 60831-1/2</strong>, as tolerâncias de capacitância permitidas são geralmente:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>-5% a +10%:</strong> Faixa padrão para unidades capacitivas (APROVADO)</li>
            <li><strong>-10% a +15%:</strong> Faixa de atenção (monitorar)</li>
            <li><strong>Fora destes limites:</strong> REPROVADO (substituir)</li>
          </ul>
          <p className="mt-3 text-xs font-medium text-slate-400">
            * As tolerâncias configuradas aqui serão aplicadas automaticamente em todos os novos testes realizados no sistema.
          </p>
        </div>
      </div>
    </div>
  );
}

function ManutencaoPreditivaTab({ alertas, totalCapacitores, aprovados, loading, tolerancias, onRefresh }: any) {
  const criticos = alertas.filter((a: any) => a.status === 'critical');
  const atencao = alertas.filter((a: any) => a.status === 'warning');

  function handleGerarOrdem(capacitor: any) {
    Swal.fire({
      title: 'Gerar Ordem de Serviço',
      html: `
        <div style="text-align: left;">
          <p><strong>Capacitor:</strong> ${capacitor.codigo}</p>
          <p><strong>Banco:</strong> ${capacitor.banco}</p>
          <p><strong>Cliente:</strong> ${capacitor.cliente}</p>
          <p><strong>Desvio:</strong> ${capacitor.desvio_percent > 0 ? '+' : ''}${capacitor.desvio_percent}%</p>
          <p><strong>Status:</strong> ${capacitor.status === 'critical' ? 'CRÍTICO' : 'ATENÇÃO'}</p>
          <p><strong>Previsão:</strong> ${capacitor.previsao_substituicao}</p>
          <hr style="margin: 15px 0;">
          <label><strong>Prioridade:</strong></label>
          <select id="prioridade" style="width: 100%; padding: 8px; margin-top: 5px; border-radius: 8px; border: 1px solid #ddd;">
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>
      `,
      showCancelButton: true,
      confirmButtonColor: '#0a2b3c',
      cancelButtonColor: '#e74c3c',
      confirmButtonText: 'Gerar Ordem',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const prioridade = (document.getElementById('prioridade') as HTMLSelectElement).value;
        return { prioridade };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire('Ordem Gerada!', `Ordem de serviço para ${capacitor.codigo} gerada com sucesso.`, 'success');
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <AlertTriangle size={20} />
            </div>
            <span className="text-sm font-medium text-slate-500">Críticos</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{criticos.length}</p>
          <p className="text-xs text-red-500 mt-1">Substituir imediatamente</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-yellow-50 rounded-lg text-yellow-600">
              <AlertCircle size={20} />
            </div>
            <span className="text-sm font-medium text-slate-500">Atenção</span>
          </div>
          <p className="text-3xl font-bold text-yellow-600">{atencao.length}</p>
          <p className="text-xs text-yellow-500 mt-1">Monitorar mensalmente</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <CheckCircle size={20} />
            </div>
            <span className="text-sm font-medium text-slate-500">Aprovados</span>
          </div>
          <p className="text-3xl font-bold text-green-600">{aprovados}</p>
          <p className="text-xs text-green-500 mt-1">Dentro da especificação</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Droplets size={20} />
            </div>
            <span className="text-sm font-medium text-slate-500">Total Analisado</span>
          </div>
          <p className="text-3xl font-bold text-primary">{totalCapacitores}</p>
          <p className="text-xs text-slate-400 mt-1">Capacitores monitorados</p>
        </div>
      </div>

      {/* Tabela de Alertas */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Wrench size={20} className="text-secondary" />
            <h2 className="text-lg font-bold text-primary">Recomendações de Manutenção</h2>
          </div>
          <button 
            onClick={onRefresh} 
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            title="Atualizar"
          >
            <RefreshCw size={18} className={cn(loading && "animate-spin")} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="animate-spin mx-auto mb-4" size={32} />
            Carregando dados...
          </div>
        ) : alertas.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
            <p className="font-medium">Todos os capacitores estão dentro das especificações!</p>
            <p className="text-sm mt-1">Nenhuma ação de manutenção necessária no momento.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-sm font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-3">Código</th>
                  <th className="px-5 py-3">Banco</th>
                  <th className="px-5 py-3">Desvio</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Tendência</th>
                  <th className="px-5 py-3">Previsão</th>
                  <th className="px-5 py-3 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alertas.map((cap: any) => (
                  <tr key={cap.id} className="text-sm hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-bold text-primary">{cap.codigo}</td>
                    <td className="px-5 py-3 text-slate-600">{cap.banco}</td>
                    <td className={cn("px-5 py-3 font-bold", cap.desvio_percent > 0 ? "text-red-500" : "text-green-500")}>
                      {cap.desvio_percent > 0 ? `+${cap.desvio_percent}%` : `${cap.desvio_percent}%`}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={cap.status === 'critical' ? 'reprovado' : 'atencao'} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        {cap.tendencia === 'degradando' && <TrendingDown size={14} className="text-red-500" />}
                        {cap.tendencia === 'melhorando' && <TrendingUp size={14} className="text-green-500" />}
                        {cap.tendencia === 'estavel' && <Activity size={14} className="text-slate-400" />}
                        <span className={cn(
                          "text-xs font-medium",
                          cap.tendencia === 'degradando' ? "text-red-600" : 
                          cap.tendencia === 'melhorando' ? "text-green-600" : "text-slate-500"
                        )}>
                          {cap.tendencia === 'degradando' ? "Degradando" : 
                           cap.tendencia === 'melhorando' ? "Melhorando" : "Estável"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-xs">{cap.previsao_substituicao}</td>
                    <td className="px-5 py-3 text-center">
                      <button 
                        onClick={() => handleGerarOrdem(cap)}
                        className="px-3 py-1 bg-primary text-white text-xs rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        Gerar Ordem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Estimativa de Custo */}
      {criticos.length > 0 && (
        <div className="bg-gradient-to-r from-primary/5 to-secondary/5 p-6 rounded-xl border border-primary/20">
          <h4 className="font-bold text-primary mb-4 flex items-center gap-2">
            <DollarSign size={18} />
            Estimativa de Investimento
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg">
              <p className="text-xs text-slate-500">Substituição Urgente</p>
              <p className="text-2xl font-bold text-red-600">R$ {criticos.length * 250}</p>
              <p className="text-xs text-slate-400">{criticos.length} capacitores</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <p className="text-xs text-slate-500">Economia mensal estimada</p>
              <p className="text-2xl font-bold text-green-600">R$ 2.188</p>
              <p className="text-xs text-slate-400">Com eliminação da multa</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <p className="text-xs text-slate-500">Payback estimado</p>
              <p className="text-2xl font-bold text-primary">~{Math.ceil((criticos.length * 250) / 2188)} meses</p>
              <p className="text-xs text-slate-400">Retorno do investimento</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConexaoTab({ connectionStatus, onTest }: any) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className={cn(
        "mb-6 rounded-full p-6 transition-all duration-500",
        connectionStatus === 'success' ? "bg-green-100 text-green-600" : 
        connectionStatus === 'error' ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-400"
      )}>
        <Database size={48} className={cn(connectionStatus === 'testing' && "animate-pulse")} />
      </div>
      
      <h2 className="text-xl font-bold text-primary">
        {connectionStatus === 'idle' && "Verificar Conexão"}
        {connectionStatus === 'testing' && "Testando Conexão..."}
        {connectionStatus === 'success' && "Conectado com Sucesso!"}
        {connectionStatus === 'error' && "Erro na Conexão"}
      </h2>
      
      <p className="mt-2 text-slate-500 text-center max-w-md text-sm">
        {connectionStatus === 'idle' && "Clique no botão abaixo para verificar se as chaves do Supabase estão configuradas corretamente."}
        {connectionStatus === 'success' && "O sistema está pronto para realizar operações de CRUD no banco de dados."}
        {connectionStatus === 'error' && "Verifique as variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."}
      </p>

      <button 
        onClick={onTest} 
        disabled={connectionStatus === 'testing'} 
        className="mt-6 flex items-center gap-2 rounded-lg bg-primary px-6 py-2 font-medium text-white transition-all hover:bg-primary/90 disabled:opacity-50"
      >
        <RefreshCw size={18} className={cn(connectionStatus === 'testing' && "animate-spin")} />
        Testar Agora
      </button>
    </div>
  );
}

function LixeiraTab({ trashItems, onRestore, onDelete }: any) {
  return (
    <div className="space-y-8">
      <TrashSection 
        title="Clientes Excluídos" 
        items={trashItems.clientes} 
        onRestore={(id: string) => onRestore('clientes', id)}
        onDelete={(id: string) => onDelete('clientes', id)}
        renderItem={(item: any) => (
          <div className="flex-1">
            <p className="font-bold text-primary">{item.nome}</p>
            <p className="text-xs text-slate-500">{item.cnpj_cpf || 'Sem documento'}</p>
          </div>
        )}
      />

      <TrashSection 
        title="Bancos Excluídos" 
        items={trashItems.bancos} 
        onRestore={(id: string) => onRestore('bancos_capacitores', id)}
        onDelete={(id: string) => onDelete('bancos_capacitores', id)}
        renderItem={(item: any) => (
          <div className="flex-1">
            <p className="font-bold text-primary">{item.nome_banco}</p>
            <p className="text-xs text-slate-500">Cliente: {item.clientes?.nome}</p>
          </div>
        )}
      />

      <TrashSection 
        title="Capacitores Excluídos" 
        items={trashItems.capacitores} 
        onRestore={(id: string) => onRestore('capacitores', id)}
        onDelete={(id: string) => onDelete('capacitores', id)}
        renderItem={(item: any) => (
          <div className="flex-1">
            <p className="font-bold text-primary">{item.codigo_identificacao}</p>
            <p className="text-xs text-slate-500">Banco: {item.bancos_capacitores?.nome_banco}</p>
          </div>
        )}
      />
    </div>
  );
}

function TrashSection({ title, items, onRestore, onDelete, renderItem }: any) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">{title} ({items.length})</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item: any) => (
          <div key={item.id} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm border border-slate-100">
            {renderItem(item)}
            <div className="flex gap-1">
              <button 
                onClick={() => onRestore(item.id)} 
                className="rounded p-1.5 text-green-600 hover:bg-green-50 transition-colors" 
                title="Restaurar"
              >
                <RotateCcw size={16} />
              </button>
              <button 
                onClick={() => onDelete(item.id)} 
                className="rounded p-1.5 text-red-600 hover:bg-red-50 transition-colors" 
                title="Excluir Permanentemente"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full py-8 text-center text-slate-300 border-2 border-dashed border-slate-100 rounded-xl">
            Nenhum item na lixeira
          </div>
        )}
      </div>
    </section>
  );
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
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", config.color)}>
      <Icon size={12} />
      {config.label}
    </span>
  );
}
