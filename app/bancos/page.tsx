'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Edit2, Trash2, X, Save, Database } from 'lucide-react';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'motion/react';
import { parseNumber } from '@/lib/utils';

export default function BancosPage() {
  const [bancos, setBancos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanco, setEditingBanco] = useState<any>(null);
  const [formData, setFormData] = useState({
    cliente_id: '',
    nome_banco: '',
    localizacao: '',
    tensao_nominal: '',
    potencia_total_kvar: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const { data: bancosData, error: bancosError } = await supabase
        .from('bancos_capacitores')
        .select('*, clientes(nome)')
        .eq('ativo', true)
        .order('nome_banco');
      
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');

      if (bancosError) throw bancosError;
      if (clientesError) throw clientesError;

      setBancos(bancosData || []);
      setClientes(clientesData || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredBancos = bancos.filter(b => 
    b.nome_banco.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.clientes?.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function handleOpenModal(banco: any = null) {
    if (banco) {
      setEditingBanco(banco);
      setFormData({
        cliente_id: banco.cliente_id,
        nome_banco: banco.nome_banco,
        localizacao: banco.localizacao || '',
        tensao_nominal: banco.tensao_nominal || '',
        potencia_total_kvar: banco.potencia_total_kvar || '',
      });
    } else {
      setEditingBanco(null);
      setFormData({
        cliente_id: '',
        nome_banco: '',
        localizacao: '',
        tensao_nominal: '',
        potencia_total_kvar: '',
      });
    }
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        tensao_nominal: formData.tensao_nominal ? parseNumber(formData.tensao_nominal) : null,
        potencia_total_kvar: formData.potencia_total_kvar ? parseNumber(formData.potencia_total_kvar) : null,
      };

      if (editingBanco) {
        const { error } = await supabase
          .from('bancos_capacitores')
          .update(data)
          .eq('id', editingBanco.id);
        if (error) throw error;
        Swal.fire('Sucesso', 'Banco atualizado com sucesso!', 'success');
      } else {
        const { error } = await supabase
          .from('bancos_capacitores')
          .insert([data]);
        if (error) throw error;
        Swal.fire('Sucesso', 'Banco cadastrado com sucesso!', 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    }
  }

  async function handleDelete(id: string) {
    const result = await Swal.fire({
      title: 'Tem certeza?',
      text: "O banco será desativado do sistema.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0a2b3c',
      cancelButtonColor: '#e74c3c',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from('bancos_capacitores')
          .update({ ativo: false })
          .eq('id', id);
        if (error) throw error;
        Swal.fire('Excluído!', 'Banco removido com sucesso.', 'success');
        fetchData();
      } catch (error: any) {
        Swal.fire('Erro', error.message, 'error');
      }
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary">Bancos de Capacitores</h1>
          <p className="text-slate-500">Gerencie os bancos vinculados aos seus clientes</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-primary/90"
        >
          <Plus size={20} />
          Novo Banco
        </button>
      </header>

      <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-sm">
        <Search className="text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Buscar por nome do banco ou cliente..." 
          className="w-full bg-transparent outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredBancos.map((banco) => (
          <motion.div 
            key={banco.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative rounded-xl bg-white p-6 shadow-sm transition-all hover:shadow-md"
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Database size={24} />
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => handleOpenModal(banco)}
                  className="rounded p-1.5 text-blue-600 hover:bg-blue-50"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => handleDelete(banco.id)}
                  className="rounded p-1.5 text-error hover:bg-error/10"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <h3 className="text-lg font-bold text-primary">{banco.nome_banco}</h3>
            <p className="mb-4 text-sm font-medium text-secondary">{banco.clientes?.nome}</p>
            
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Localização:</span>
                <span className="font-medium">{banco.localizacao || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span>Tensão Nominal:</span>
                <span className="font-medium">{banco.tensao_nominal}V</span>
              </div>
              <div className="flex justify-between">
                <span>Potência Total:</span>
                <span className="font-medium">{banco.potencia_total_kvar} kVAr</span>
              </div>
            </div>
          </motion.div>
        ))}
        {filteredBancos.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center text-slate-400">Nenhum banco encontrado</div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-primary">
                  {editingBanco ? 'Editar Banco' : 'Novo Banco'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Cliente *</label>
                  <select 
                    required
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                    value={formData.cliente_id}
                    onChange={(e) => setFormData({...formData, cliente_id: e.target.value})}
                  >
                    <option value="">Selecione um cliente</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Nome do Banco *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Ex: Banco Principal"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                    value={formData.nome_banco}
                    onChange={(e) => setFormData({...formData, nome_banco: e.target.value})}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Localização</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Subestação 01"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                    value={formData.localizacao}
                    onChange={(e) => setFormData({...formData, localizacao: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Tensão Nominal (V)</label>
                    <input 
                      type="text" 
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                      value={formData.tensao_nominal}
                      onChange={(e) => setFormData({...formData, tensao_nominal: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Potência Total (kVAr)</label>
                    <input 
                      type="text" 
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                      value={formData.potencia_total_kvar}
                      onChange={(e) => setFormData({...formData, potencia_total_kvar: e.target.value})}
                    />
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-lg px-6 py-2 text-slate-600 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-white hover:bg-primary/90"
                  >
                    <Save size={18} />
                    Salvar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
