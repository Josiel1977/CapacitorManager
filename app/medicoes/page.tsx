'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient'; // seu cliente Supabase para o front
import { useAuth } from '@/lib/AuthContext';
import {
  ClipboardCheck,
  Zap,
  Save,
  Calculator,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

// ============================================================================
// FUNÇÕES DE CÁLCULO
// ============================================================================
function calcularCorrenteTeorica(potenciaKvar: number, tensao: number): number {
  if (!tensao || tensao === 0) return 0;
  return (potenciaKvar * 1000) / (Math.sqrt(3) * tensao);
}

function calcularCapacitanciaTeoricaDelta(capacitanciaNominalFase: number): number {
  if (!capacitanciaNominalFase) return 0;
  return capacitanciaNominalFase * 1.5;
}

function calcularDesvio(valorMedido: number, valorTeorico: number): number {
  if (!valorTeorico || valorTeorico === 0) return 0;
  return ((valorMedido - valorTeorico) / valorTeorico) * 100;
}

function getStatusValidacao(
  desvio: number,
  config: {
    tolerancia_min_aprovado: number;
    tolerancia_max_aprovado: number;
    tolerancia_min_atencao: number;
    tolerancia_max_atencao: number;
  },
): string {
  if (
    desvio >= config.tolerancia_min_aprovado &&
    desvio <= config.tolerancia_max_aprovado
  )
    return 'aprovado';
  if (
    desvio >= config.tolerancia_min_atencao &&
    desvio <= config.tolerancia_max_atencao
  )
    return 'atencao';
  return 'reprovado';
}

function parseNumber(value: string): number {
  if (!value) return 0;
  const str = value.replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
function ValidarCapacitoresContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const capacitorIdParam = searchParams.get('capacitor_id');

  // Obtém usuário e estado de loading do contexto
  const { user, isLoading: authLoading } = useAuth();

  const [clientes, setClientes] = useState<any[]>([]);
  const [bancos, setBancos] = useState<any[]>([]);
  const [capacitores, setCapacitores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userTenantId, setUserTenantId] = useState<string | null>(null);

  const [config, setConfig] = useState<any>({
    tolerancia_min_aprovado: -5,
    tolerancia_max_aprovado: 10,
    tolerancia_min_atencao: -10,
    tolerancia_max_atencao: 15,
  });

  const [selection, setSelection] = useState({
    cliente_id: '',
    banco_id: '',
    capacitor_id: '',
    tipo_teste: 'corrente' as 'corrente' | 'capacitancia',
  });

  const [medicao, setMedicao] = useState({
    tensao_medida_v: '',
    corrente_medida_a: '',
    capacitancia_medida_uf: '',
  });

  const [resultado, setResultado] = useState<any>(null);

  // Carrega configurações gerais
  useEffect(() => {
    async function fetchConfig() {
      try {
        const { data, error } = await supabase
          .from('configuracoes')
          .select('*')
          .eq('id', 'global')
          .single();
        if (data) setConfig(data);
      } catch (err) {
        console.error('Erro ao carregar config:', err);
      }
    }
    fetchConfig();
  }, []);

  // Quando o usuário é carregado, define se é admin e busca o tenant_id
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Se não há usuário, redireciona para login
      router.push('/login');
      return;
    }

    const adminEmails = [
      'suporte@capacitormanager.com.br',
      'eng.eletrica1977@gmail.com',
    ];
    const isUserAdmin = adminEmails.includes(user.email || '');
    setIsAdmin(isUserAdmin);

    if (!isUserAdmin) {
      // Usuário comum: tenta obter tenant_id dos metadados ou do perfil
      let tenant = user.user_metadata?.tenant_id;
      if (!tenant) {
        supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            setUserTenantId(data?.tenant_id || null);
          });
      } else {
        setUserTenantId(tenant);
      }
    } else {
      setUserTenantId(null); // admin não precisa de tenant fixo
    }
  }, [user, authLoading, router]);

  // Carrega clientes quando o tenant_id estiver definido (ou se for admin)
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    if (!isAdmin && !userTenantId) return; // aguarda o tenant_id do usuário comum

    async function fetchClientes() {
      let query = supabase.from('clientes').select('id, nome').eq('ativo', true);
      if (!isAdmin && userTenantId) {
        query = query.eq('tenant_id', userTenantId);
      }
      const { data } = await query.order('nome');
      setClientes(data || []);
    }
    fetchClientes();
  }, [isAdmin, userTenantId, user, authLoading]);

  // Funções para buscar bancos e capacitores
  async function fetchBancos(clienteId: string) {
    const { data } = await supabase
      .from('bancos_capacitores')
      .select('id, nome_banco')
      .eq('cliente_id', clienteId)
      .eq('ativo', true)
      .order('nome_banco');
    setBancos(data || []);
  }

  async function fetchCapacitores(bancoId: string) {
    const { data } = await supabase
      .from('capacitores')
      .select('*')
      .eq('banco_id', bancoId)
      .eq('ativo', true)
      .order('codigo_identificacao');
    setCapacitores(data || []);
  }

  async function buscarEPreSelecionarCapacitor(capacitorId: string) {
    try {
      const { data: cap, error } = await supabase
        .from('capacitores')
        .select('*, bancos_capacitores(cliente_id)')
        .eq('id', capacitorId)
        .single();

      if (error || !cap) throw new Error('Capacitor não encontrado');

      const clienteId = cap.bancos_capacitores?.cliente_id;
      const bancoId = cap.banco_id;

      if (clienteId) {
        await fetchBancos(clienteId);
        setSelection((prev) => ({
          ...prev,
          cliente_id: clienteId,
          banco_id: bancoId,
          capacitor_id: capacitorId,
        }));
        if (bancoId) await fetchCapacitores(bancoId);
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Aviso', 'Capacitor não encontrado ou inativo', 'warning');
    }
  }

  // Pré-seleciona capacitor via parâmetro URL
  useEffect(() => {
    if (capacitorIdParam && !authLoading && user) {
      buscarEPreSelecionarCapacitor(capacitorIdParam);
    }
  }, [capacitorIdParam, authLoading, user]);

  // Efeitos para carregar bancos/capacitores quando seleção mudar
  useEffect(() => {
    if (selection.cliente_id) {
      fetchBancos(selection.cliente_id);
    } else {
      setBancos([]);
      setSelection((s) => ({ ...s, banco_id: '', capacitor_id: '' }));
    }
  }, [selection.cliente_id]);

  useEffect(() => {
    if (selection.banco_id) {
      fetchCapacitores(selection.banco_id);
    } else {
      setCapacitores([]);
      setSelection((s) => ({ ...s, capacitor_id: '' }));
    }
  }, [selection.banco_id]);

  // Reset resultado ao mudar seleção ou medição
  useEffect(() => {
    setResultado(null);
  }, [selection, medicao]);

  function handleCalcular() {
    if (!selection.capacitor_id) {
      Swal.fire('Atenção', 'Selecione um capacitor primeiro', 'warning');
      return;
    }

    const cap = capacitores.find((c) => c.id === selection.capacitor_id);
    if (!cap) {
      Swal.fire('Erro', 'Capacitor não encontrado', 'error');
      return;
    }

    if (selection.tipo_teste === 'corrente') {
      const vMedida = parseNumber(medicao.tensao_medida_v);
      const iMedida = parseNumber(medicao.corrente_medida_a);

      if (vMedida === 0) {
        Swal.fire('Erro', 'Preencha a tensão medida', 'error');
        return;
      }
      if (iMedida === 0) {
        Swal.fire('Erro', 'Preencha a corrente medida', 'error');
        return;
      }

      const correnteTeorica = calcularCorrenteTeorica(cap.potencia_kvar, vMedida);
      const correnteNominal = calcularCorrenteTeorica(
        cap.potencia_kvar,
        cap.tensao_nominal_v,
      );
      const desvio = calcularDesvio(iMedida, correnteTeorica);
      const status = getStatusValidacao(desvio, config);

      setResultado({
        tipo: 'corrente',
        correnteTeorica,
        correnteNominal,
        tensaoMedida: vMedida,
        correnteMedida: iMedida,
        desvio: Math.round(desvio * 100) / 100,
        desvioOriginal: desvio,
        status,
      });
    } else {
      const cMedida = parseNumber(medicao.capacitancia_medida_uf);
      if (cMedida === 0) {
        Swal.fire('Erro', 'Preencha a capacitância medida', 'error');
        return;
      }

      const capacitanciaTeorica = calcularCapacitanciaTeoricaDelta(
        cap.capacitancia_nominal_uf,
      );
      const desvio = calcularDesvio(cMedida, capacitanciaTeorica);
      const status = getStatusValidacao(desvio, config);

      setResultado({
        tipo: 'capacitancia',
        capacitanciaTeorica,
        capacitanciaNominal: cap.capacitancia_nominal_uf,
        capacitanciaMedida: cMedida,
        desvio: Math.round(desvio * 100) / 100,
        desvioOriginal: desvio,
        status,
      });
    }
  }

  async function handleSalvar() {
    if (!resultado) {
      Swal.fire('Atenção', 'Calcule o resultado antes de salvar', 'warning');
      return;
    }

    let tenantIdParaSalvar: string | null = null;

    if (isAdmin) {
      if (!selection.cliente_id) {
        Swal.fire('Erro', 'Como administrador, selecione um cliente antes de salvar.', 'error');
        return;
      }
      tenantIdParaSalvar = selection.cliente_id;
    } else {
      if (!userTenantId) {
        Swal.fire('Erro', 'Seu usuário não está associado a um tenant. Contate o administrador.', 'error');
        return;
      }
      if (selection.cliente_id && selection.cliente_id !== userTenantId) {
        Swal.fire('Erro', 'Você só pode salvar medições para o cliente associado à sua conta.', 'error');
        return;
      }
      tenantIdParaSalvar = userTenantId;
    }

    setLoading(true);
    try {
      const vMedida = parseNumber(medicao.tensao_medida_v);
      const iMedida = parseNumber(medicao.corrente_medida_a);
      const cMedida = parseNumber(medicao.capacitancia_medida_uf);

      const payload: any = {
        tenant_id: tenantIdParaSalvar,
        capacitor_id: selection.capacitor_id,
        cliente_id: selection.cliente_id || (isAdmin ? selection.cliente_id : userTenantId),
        banco_id: selection.banco_id,
        tipo_teste: selection.tipo_teste,
        desvio_percentual: resultado.desvioOriginal,
        status_validacao: resultado.status,
        created_at: new Date().toISOString(),
      };

      if (selection.tipo_teste === 'corrente') {
        payload.tensao_medida_v = vMedida;
        payload.corrente_medida_a = iMedida;
        payload.corrente_teorica_a = resultado.correnteTeorica;
      } else {
        payload.capacitancia_medida_uf = cMedida;
        payload.capacitancia_teorica_uf = resultado.capacitanciaTeorica;
      }

      const { error } = await supabase.from('medicoes').insert([payload]);
      if (error) throw error;

      Swal.fire({
        title: 'Sucesso!',
        text: `Medição salva como ${resultado.status.toUpperCase()}`,
        icon: 'success',
      });

      // Limpa o formulário
      setResultado(null);
      setMedicao({
        tensao_medida_v: '',
        corrente_medida_a: '',
        capacitancia_medida_uf: '',
      });
      if (!capacitorIdParam && !isAdmin) {
        setSelection((prev) => ({ ...prev, capacitor_id: '' }));
      }
    } catch (error: any) {
      console.error(error);
      Swal.fire('Erro', error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function getRecomendacao(status: string) {
    switch (status) {
      case 'aprovado':
        return '✅ O capacitor está operando dentro das tolerâncias. Manutenção preventiva regular.';
      case 'atencao':
        return '⚠️ Desvio moderado. Recomenda-se monitoramento quinzenal e nova medição em 30 dias.';
      case 'reprovado':
        return '❌ Fora das especificações. Substituição recomendada para evitar danos ao sistema.';
      default:
        return 'Realize uma nova medição.';
    }
  }

  if (authLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null; // redirecionamento já ocorre no useEffect
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      <div className="flex items-center gap-4">
        {capacitorIdParam && (
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-primary hover:underline"
          >
            <ArrowLeft size={20} />
            Voltar
          </button>
        )}
        <div>
          <h1 className="text-3xl font-bold text-primary">Validar Capacitor</h1>
          <p className="text-slate-500">
            Teste de campo (corrente) ou bancada (capacitância)
          </p>
          {isAdmin && (
            <span className="inline-block mt-1 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              Modo Administrador – você pode salvar para qualquer cliente
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-primary">
              <Zap className="text-secondary" size={20} />
              Identificação do Capacitor
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Cliente
                </label>
                <select
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                  value={selection.cliente_id}
                  onChange={(e) =>
                    setSelection({
                      ...selection,
                      cliente_id: e.target.value,
                      banco_id: '',
                      capacitor_id: '',
                    })
                  }
                >
                  <option value="">Selecione...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                {!isAdmin && userTenantId && (
                  <p className="text-xs text-slate-400 mt-1">
                    Você está vinculado ao cliente ID {userTenantId}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Banco
                </label>
                <select
                  disabled={!selection.cliente_id}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary disabled:bg-slate-50"
                  value={selection.banco_id}
                  onChange={(e) =>
                    setSelection({
                      ...selection,
                      banco_id: e.target.value,
                      capacitor_id: '',
                    })
                  }
                >
                  <option value="">Selecione...</option>
                  {bancos.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nome_banco}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Capacitor
                </label>
                <select
                  disabled={!selection.banco_id}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary disabled:bg-slate-50"
                  value={selection.capacitor_id}
                  onChange={(e) =>
                    setSelection({ ...selection, capacitor_id: e.target.value })
                  }
                >
                  <option value="">Selecione...</option>
                  {capacitores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo_identificacao} ({c.potencia_kvar} kVAr -{' '}
                      {c.tensao_nominal_v}V)
                    </option>
                  ))}
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
                onClick={() =>
                  setSelection({ ...selection, tipo_teste: 'corrente' })
                }
                className={cn(
                  'flex-1 rounded-lg border py-3 text-sm font-medium transition-all',
                  selection.tipo_teste === 'corrente'
                    ? 'border-primary bg-primary text-white'
                    : 'border-slate-200 text-slate-600 hover:border-primary/50',
                )}
              >
                🔌 Corrente (Campo)
              </button>
              <button
                onClick={() =>
                  setSelection({ ...selection, tipo_teste: 'capacitancia' })
                }
                className={cn(
                  'flex-1 rounded-lg border py-3 text-sm font-medium transition-all',
                  selection.tipo_teste === 'capacitancia'
                    ? 'border-primary bg-primary text-white'
                    : 'border-slate-200 text-slate-600 hover:border-primary/50',
                )}
              >
                ⚡ Capacitância (Bancada)
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {selection.tipo_teste === 'corrente' ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Tensão Medida (V)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Ex: 220"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                      value={medicao.tensao_medida_v}
                      onChange={(e) =>
                        setMedicao({
                          ...medicao,
                          tensao_medida_v: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Corrente Medida (A)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Ex: 6.56"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                      value={medicao.corrente_medida_a}
                      onChange={(e) =>
                        setMedicao({
                          ...medicao,
                          corrente_medida_a: e.target.value,
                        })
                      }
                    />
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Capacitância Medida entre Fases (µF)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 68.55"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                    value={medicao.capacitancia_medida_uf}
                    onChange={(e) =>
                      setMedicao({
                        ...medicao,
                        capacitancia_medida_uf: e.target.value,
                      })
                    }
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
                <p className="mb-1 font-bold uppercase tracking-wider">
                  Tolerâncias IEC 60831-1:
                </p>
                <div className="flex justify-between">
                  <span>
                    ✅ Aprovado: {config.tolerancia_min_aprovado}% a{' '}
                    {config.tolerancia_max_aprovado}%
                  </span>
                  <span>
                    ⚠️ Atenção: {config.tolerancia_min_atencao}% a{' '}
                    {config.tolerancia_max_atencao}%
                  </span>
                  <span>
                    ❌ Reprovado: {'<'} {config.tolerancia_min_atencao}% ou{' '}
                    {'>'} {config.tolerancia_max_atencao}%
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="flex min-h-[400px] flex-col rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-lg font-semibold text-primary">
              Resultado da Análise
            </h2>

            {resultado ? (
              <div className="flex flex-1 flex-col justify-between">
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-sm text-slate-500">Desvio Encontrado</p>
                    <p
                      className={cn(
                        'text-4xl font-black',
                        resultado.status === 'aprovado'
                          ? 'text-green-600'
                          : resultado.status === 'atencao'
                            ? 'text-amber-600'
                            : 'text-red-600',
                      )}
                    >
                      {resultado.desvio > 0 ? '+' : ''}
                      {resultado.desvio.toFixed(2)}%
                    </p>
                  </div>

                  <div className="space-y-3 rounded-lg bg-slate-50 p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status:</span>
                      <span
                        className={cn(
                          'font-bold uppercase',
                          resultado.status === 'aprovado'
                            ? 'text-green-600'
                            : resultado.status === 'atencao'
                              ? 'text-amber-600'
                              : 'text-red-600',
                        )}
                      >
                        {resultado.status === 'aprovado'
                          ? '✅ APROVADO'
                          : resultado.status === 'atencao'
                            ? '⚠️ ATENÇÃO'
                            : '❌ REPROVADO'}
                      </span>
                    </div>

                    {resultado.tipo === 'corrente' ? (
                      <>
                        <div className="flex justify-between border-t border-slate-200 pt-2">
                          <span className="text-slate-500">
                            Corrente Nominal (
                            {capacitores.find((c) => c.id === selection.capacitor_id)
                              ?.tensao_nominal_v || '?'}
                            V):
                          </span>
                          <span className="font-medium text-primary">
                            {resultado.correnteNominal?.toFixed(2)} A
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">
                            Corrente Teórica ({resultado.tensaoMedida}V):
                          </span>
                          <span className="font-medium text-primary">
                            {resultado.correnteTeorica?.toFixed(2)} A
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">
                            Corrente Medida:
                          </span>
                          <span className="font-medium text-primary">
                            {resultado.correnteMedida?.toFixed(2)} A
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between border-t border-slate-200 pt-2">
                          <span className="text-slate-500">
                            Capacitância Nominal (por fase):
                          </span>
                          <span className="font-medium text-primary">
                            {resultado.capacitanciaNominal?.toFixed(2)} µF
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">
                            Capacitância Teórica (entre fases):
                          </span>
                          <span className="font-medium text-primary">
                            {resultado.capacitanciaTeorica?.toFixed(2)} µF
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">
                            Capacitância Medida:
                          </span>
                          <span className="font-medium text-primary">
                            {resultado.capacitanciaMedida?.toFixed(2)} µF
                          </span>
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
                <p>
                  Preencha os dados e clique em &quot;Calcular&quot; para ver o
                  resultado.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default function ValidarCapacitoresPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <ValidarCapacitoresContent />
    </Suspense>
  );
}
