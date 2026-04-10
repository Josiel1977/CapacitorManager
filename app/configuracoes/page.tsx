'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Database, Copy, Check, AlertCircle, RefreshCw, Trash2, RotateCcw } from 'lucide-react';
import Swal from 'sweetalert2';
import { motion } from 'motion/react';
import { cn, parseNumber } from '@/lib/utils';

export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState<'conexao' | 'lixeira' | 'tolerancias'>('tolerancias');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [tolerancias, setTolerancias] = useState({
    id: 'global',
    tolerancia_min_aprovado: -5,
    tolerancia_max_aprovado: 10,
    tolerancia_min_atencao: -10,
    tolerancia_max_atencao: 15,
    norma_referencia: 'IEC 60831-1/2'
  });
  const [savingTolerancias, setSavingTolerancias] = useState(false);
  const [trashItems, setTrashItems] = useState<{
    clientes: any[],
    bancos: any[],
    capacitores: any[]
  }>({ clientes: [], bancos: [], capacitores: [] });

  useEffect(() => {
    if (activeTab === 'lixeira') {
      fetchTrash();
    }
    if (activeTab === 'tolerancias') {
      fetchTolerancias();
    }
  }, [activeTab]);

  async function fetchTolerancias() {
    try {
      const { data, error } = await supabase.from('configuracoes').select('*').eq('id', 'global').single();
      if (data) setTolerancias(data);
    } catch (error) {
      console.error('Erro ao buscar tolerâncias:', error);
    }
  }

  async function saveTolerancias() {
    setSavingTolerancias(true);
    try {
      const { error } = await supabase.from('configuracoes').upsert(tolerancias);
      if (error) throw error;
      Swal.fire('Sucesso', 'Configurações de tolerância salvas!', 'success');
    } catch (error: any) {
      if (error.code === '42P01') {
        Swal.fire('Erro', 'A tabela "configuracoes" não existe no seu banco de dados Supabase. Por favor, execute o SQL de criação.', 'error');
      } else {
        Swal.fire('Erro', error.message, 'error');
      }
    } finally {
      setSavingTolerancias(false);
    }
  }

  function resetTolerancias() {
    setTolerancias({
      id: 'global',
      tolerancia_min_aprovado: -5,
      tolerancia_max_aprovado: 10,
      tolerancia_min_atencao: -10,
      tolerancia_max_atencao: 15,
      norma_referencia: 'IEC 60831-1/2'
    });
  }

  async function testConnection() {
    setConnectionStatus('testing');
    try {
      const { data, error } = await supabase.from('clientes').select('id').limit(1);
      if (error) throw error;
      setConnectionStatus('success');
      Swal.fire('Sucesso', 'Conexão com Supabase estabelecida com sucesso!', 'success');
    } catch (error: any) {
      setConnectionStatus('error');
      Swal.fire('Erro', 'Falha ao conectar com Supabase: ' + error.message, 'error');
    }
  }

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
      Swal.fire('Restaurado', 'Item restaurado com sucesso!', 'success');
      fetchTrash();
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    }
  }

  async function permanentDelete(table: string, id: string) {
    const result = await Swal.fire({
      title: 'Excluir permanentemente?',
      text: "Esta ação não pode ser desfeita!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e74c3c',
      confirmButtonText: 'Sim, excluir para sempre'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
        Swal.fire('Excluído', 'Item removido permanentemente.', 'success');
        fetchTrash();
      } catch (error: any) {
        Swal.fire('Erro', error.message, 'error');
      }
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-primary">Configurações</h1>
        <p className="text-sm md:text-base text-slate-500">Gerencie o sistema e restaure itens excluídos</p>
      </header>

      <div className="flex gap-4 border-b border-slate-200 overflow-x-auto no-scrollbar whitespace-nowrap">
        <button 
          onClick={() => setActiveTab('tolerancias')}
          className={cn(
            "pb-4 text-sm font-bold transition-all px-2",
            activeTab === 'tolerancias' ? "border-b-2 border-primary text-primary" : "text-slate-400 hover:text-slate-600"
          )}
        >
          Normas e Tolerâncias
        </button>
        <button 
          onClick={() => setActiveTab('conexao')}
          className={cn(
            "pb-4 text-sm font-bold transition-all px-2",
            activeTab === 'conexao' ? "border-b-2 border-primary text-primary" : "text-slate-400 hover:text-slate-600"
          )}
        >
          Status da Conexão
        </button>
        <button 
          onClick={() => setActiveTab('lixeira')}
          className={cn(
            "pb-4 text-sm font-bold transition-all px-2",
            activeTab === 'lixeira' ? "border-b-2 border-primary text-primary" : "text-slate-400 hover:text-slate-600"
          )}
        >
          Lixeira (Soft Delete)
        </button>
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'tolerancias' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 md:space-y-8"
          >
            <div className="rounded-xl bg-white p-4 md:p-8 shadow-sm border border-slate-100">
              <div className="mb-6 md:mb-8 flex items-center gap-3 text-primary">
                <AlertCircle className="text-secondary shrink-0" />
                <h2 className="text-lg md:text-xl font-bold">Configuração de Normas Técnicas</h2>
              </div>

              <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-xs md:text-sm font-black uppercase tracking-widest text-slate-400">Tolerâncias de Aprovação (%)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-[10px] md:text-xs font-medium text-slate-500">Mínimo (Aprovado)</label>
                      <input 
                        type="text" 
                        className="w-full rounded-lg border border-slate-200 px-3 md:px-4 py-2 text-sm outline-none focus:border-primary"
                        value={tolerancias.tolerancia_min_aprovado}
                        onChange={(e) => setTolerancias({...tolerancias, tolerancia_min_aprovado: parseNumber(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] md:text-xs font-medium text-slate-500">Máximo (Aprovado)</label>
                      <input 
                        type="text" 
                        className="w-full rounded-lg border border-slate-200 px-3 md:px-4 py-2 text-sm outline-none focus:border-primary"
                        value={tolerancias.tolerancia_max_aprovado}
                        onChange={(e) => setTolerancias({...tolerancias, tolerancia_max_aprovado: parseNumber(e.target.value)})}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] md:text-xs text-slate-400 italic">Padrão sugerido (IEC): -5% a +10%</p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs md:text-sm font-black uppercase tracking-widest text-slate-400">Tolerâncias de Atenção (%)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-[10px] md:text-xs font-medium text-slate-500">Mínimo (Atenção)</label>
                      <input 
                        type="text" 
                        className="w-full rounded-lg border border-slate-200 px-3 md:px-4 py-2 text-sm outline-none focus:border-primary"
                        value={tolerancias.tolerancia_min_atencao}
                        onChange={(e) => setTolerancias({...tolerancias, tolerancia_min_atencao: parseNumber(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] md:text-xs font-medium text-slate-500">Máximo (Atenção)</label>
                      <input 
                        type="text" 
                        className="w-full rounded-lg border border-slate-200 px-3 md:px-4 py-2 text-sm outline-none focus:border-primary"
                        value={tolerancias.tolerancia_max_atencao}
                        onChange={(e) => setTolerancias({...tolerancias, tolerancia_max_atencao: parseNumber(e.target.value)})}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] md:text-xs text-slate-400 italic">Valores fora deste intervalo serão marcados como Reprovado.</p>
                </div>

                <div className="lg:col-span-2">
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Norma de Referência</label>
                  <input 
                    type="text" 
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm outline-none focus:border-primary"
                    placeholder="Ex: IEC 60831-1/2"
                    value={tolerancias.norma_referencia}
                    onChange={(e) => setTolerancias({...tolerancias, norma_referencia: e.target.value})}
                  />
                </div>
              </div>

              <div className="mt-8 flex flex-col md:flex-row justify-end gap-4">
                <button 
                  onClick={resetTolerancias}
                  className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-8 py-3 font-bold text-slate-600 transition-all hover:bg-slate-50"
                >
                  <RotateCcw size={20} />
                  Resetar Padrões
                </button>
                <button 
                  onClick={saveTolerancias}
                  disabled={savingTolerancias}
                  className="flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3 font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-50"
                >
                  {savingTolerancias ? <RefreshCw className="animate-spin" size={20} /> : <Check size={20} />}
                  Salvar Configurações
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 md:p-6 border border-slate-200">
              <h3 className="mb-4 font-bold text-primary">Sobre as Normas de Validação</h3>
              <div className="space-y-4 text-sm text-slate-600">
                <p>
                  De acordo com a norma <strong>IEC 60831-1/2</strong>, as tolerâncias de capacitância permitidas são geralmente:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>-5% a +10%:</strong> Faixa padrão para unidades capacitivas.</li>
                  <li><strong>Desvios Negativos:</strong> Indicam perda de material dielétrico ou falha interna.</li>
                  <li><strong>Desvios Positivos:</strong> Podem indicar erros de medição ou ressonância harmônica.</li>
                </ul>
                <p className="mt-4 text-[10px] md:text-xs font-medium text-slate-400">
                  * As tolerâncias configuradas aqui serão aplicadas automaticamente em todos os novos testes realizados no sistema.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'conexao' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <div className={cn(
              "mb-8 rounded-full p-8 transition-all duration-500",
              connectionStatus === 'success' ? "bg-success/10 text-success" : 
              connectionStatus === 'error' ? "bg-error/10 text-error" : "bg-slate-100 text-slate-400"
            )}>
              <Database size={64} className={cn(connectionStatus === 'testing' && "animate-pulse")} />
            </div>
            
            <h2 className="text-2xl font-bold text-primary">
              {connectionStatus === 'idle' && "Verificar Conexão"}
              {connectionStatus === 'testing' && "Testando Conexão..."}
              {connectionStatus === 'success' && "Conectado com Sucesso!"}
              {connectionStatus === 'error' && "Erro na Conexão"}
            </h2>
            
            <p className="mt-2 text-slate-500 text-center max-w-md">
              {connectionStatus === 'idle' && "Clique no botão abaixo para verificar se as chaves do Supabase estão configuradas corretamente."}
              {connectionStatus === 'success' && "O sistema está pronto para realizar operações de CRUD no banco de dados."}
              {connectionStatus === 'error' && "Verifique as variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."}
            </p>

            <button 
              onClick={testConnection}
              disabled={connectionStatus === 'testing'}
              className="mt-8 flex items-center gap-2 rounded-lg bg-primary px-8 py-3 font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              <RefreshCw size={20} className={cn(connectionStatus === 'testing' && "animate-spin")} />
              Testar Agora
            </button>
          </motion.div>
        )}

        {activeTab === 'lixeira' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Clientes Trash */}
            <TrashSection 
              title="Clientes Excluídos" 
              items={trashItems.clientes} 
              onRestore={(id: string) => restoreItem('clientes', id)}
              onDelete={(id: string) => permanentDelete('clientes', id)}
              renderItem={(item: any) => (
                <div className="flex-1">
                  <p className="font-bold text-primary">{item.nome}</p>
                  <p className="text-xs text-slate-500">{item.cnpj_cpf || 'Sem documento'}</p>
                </div>
              )}
            />

            {/* Bancos Trash */}
            <TrashSection 
              title="Bancos Excluídos" 
              items={trashItems.bancos} 
              onRestore={(id: string) => restoreItem('bancos_capacitores', id)}
              onDelete={(id: string) => permanentDelete('bancos_capacitores', id)}
              renderItem={(item: any) => (
                <div className="flex-1">
                  <p className="font-bold text-primary">{item.nome_banco}</p>
                  <p className="text-xs text-slate-500">Cliente: {item.clientes?.nome}</p>
                </div>
              )}
            />

            {/* Capacitores Trash */}
            <TrashSection 
              title="Capacitores Excluídos" 
              items={trashItems.capacitores} 
              onRestore={(id: string) => restoreItem('capacitores', id)}
              onDelete={(id: string) => permanentDelete('capacitores', id)}
              renderItem={(item: any) => (
                <div className="flex-1">
                  <p className="font-bold text-primary">{item.codigo_identificacao}</p>
                  <p className="text-xs text-slate-500">Banco: {item.bancos_capacitores?.nome_banco}</p>
                </div>
              )}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}

function TrashSection({ title, items, onRestore, onDelete, renderItem }: any) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">{title} ({items.length})</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item: any) => (
          <div key={item.id} className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm border border-slate-100">
            {renderItem(item)}
            <div className="flex gap-1">
              <button 
                onClick={() => onRestore(item.id)}
                className="rounded p-1.5 text-success hover:bg-success/10"
                title="Restaurar"
              >
                <RotateCcw size={18} />
              </button>
              <button 
                onClick={() => onDelete(item.id)}
                className="rounded p-1.5 text-error hover:bg-error/10"
                title="Excluir Permanentemente"
              >
                <Trash2 size={18} />
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
