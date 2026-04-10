'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Edit2, Trash2, X, Save, Zap } from 'lucide-react';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'motion/react';
import { parseNumber } from '@/lib/utils';

export default function CapacitoresPage() {
  const [capacitores, setCapacitores] = useState<any[]>([]);
  const [bancos, setBancos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCapacitor, setEditingCapacitor] = useState<any>(null);
  const [formData, setFormData] = useState({
    banco_id: '',
    codigo_identificacao: '',
    potencia_kvar: '',
    capacitancia_nominal_uf: '',
    tensao_nominal_v: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const { data: capData, error: capError } = await supabase
        .from('capacitores')
        .select('*, bancos_capacitores(nome_banco, clientes(nome))')
        .eq('ativo', true)
        .order('codigo_identificacao');
      
      const { data: bancosData, error: bancosError } = await supabase
        .from('bancos_capacitores')
        .select('id, nome_banco, clientes(nome)')
        .eq('ativo', true)
        .order('nome_banco');

      if (capError) throw capError;
      if (bancosError) throw bancosError;

      setCapacitores(capData || []);
      setBancos(bancosData || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredCapacitores = capacitores.filter(c => 
    c.codigo_identificacao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.bancos_capacitores?.nome_banco.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.bancos_capacitores?.clientes?.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function handleOpenModal(capacitor: any = null) {
    if (capacitor) {
      setEditingCapacitor(capacitor);
      setFormData({
        banco_id: capacitor.banco_id,
        codigo_identificacao: capacitor.codigo_identificacao,
        potencia_kvar: capacitor.potencia_kvar.toString(),
        capacitancia_nominal_uf: capacitor.capacitancia_nominal_uf.toString(),
        tensao_nominal_v: capacitor.tensao_nominal_v.toString(),
      });
    } else {
      setEditingCapacitor(null);
      setFormData({
        banco_id: '',
        codigo_identificacao: '',
        potencia_kvar: '',
        capacitancia_nominal_uf: '',
        tensao_nominal_v: '',
      });
    }
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        potencia_kvar: parseNumber(formData.potencia_kvar),
        capacitancia_nominal_uf: parseNumber(formData.capacitancia_nominal_uf),
        tensao_nominal_v: parseNumber(formData.tensao_nominal_v),
      };

      if (editingCapacitor) {
        const { error } = await supabase
          .from('capacitores')
          .update(data)
          .eq('id', editingCapacitor.id);
        if (error) throw error;
        Swal.fire('Sucesso', 'Capacitor atualizado com sucesso!', 'success');
      } else {
        const { error } = await supabase
          .from('capacitores')
          .insert([data]);
        if (error) throw error;
        Swal.fire('Sucesso', 'Capacitor cadastrado com sucesso!', 'success');
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
      text: "O capacitor será desativado do sistema.",
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
          .from('capacitores')
          .update({ ativo: false })
          .eq('id', id);
        if (error) throw error;
        Swal.fire('Excluído!', 'Capacitor removido com sucesso.', 'success');
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
          <h1 className="text-3xl font-bold text-primary">Capacitores</h1>
          <p className="text-slate-500">Gerencie as unidades individuais de capacitores</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-primary/90"
        >
          <Plus size={20} />
          Novo Capacitor
        </button>
      </header>

      <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-sm">
        <Search className="text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Buscar por código, banco ou cliente..." 
          className="w-full bg-transparent outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-sm font-medium text-slate-500">
              <tr>
                <th className="px-6 py-4">Código</th>
                <th className="px-6 py-4">Banco / Cliente</th>
                <th className="px-6 py-4">Potência (kVAr)</th>
                <th className="px-6 py-4">Cap. Nominal (µF)</th>
                <th className="px-6 py-4">Tensão (V)</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCapacitores.map((cap) => (
                <tr key={cap.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Zap className="text-secondary" size={16} />
                      <span className="font-bold text-primary">{cap.codigo_identificacao}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-primary">{cap.bancos_capacitores?.nome_banco}</div>
                    <div className="text-xs text-slate-500">{cap.bancos_capacitores?.clientes?.nome}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{cap.potencia_kvar}</td>
                  <td className="px-6 py-4 text-slate-600">{cap.capacitancia_nominal_uf}</td>
                  <td className="px-6 py-4 text-slate-600">{cap.tensao_nominal_v}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleOpenModal(cap)}
                        className="rounded p-1.5 text-blue-600 hover:bg-blue-50"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(cap.id)}
                        className="rounded p-1.5 text-error hover:bg-error/10"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCapacitores.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">Nenhum capacitor encontrado</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                  {editingCapacitor ? 'Editar Capacitor' : 'Novo Capacitor'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Banco de Capacitores *</label>
                  <select 
                    required
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                    value={formData.banco_id}
                    onChange={(e) => setFormData({...formData, banco_id: e.target.value})}
                  >
                    <option value="">Selecione um banco</option>
                    {bancos.map(b => (
                      <option key={b.id} value={b.id}>{b.nome_banco} ({b.clientes?.nome})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Código de Identificação *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Ex: C1"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                    value={formData.codigo_identificacao}
                    onChange={(e) => setFormData({...formData, codigo_identificacao: e.target.value})}
                  />
                </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Potência (kVAr) *</label>
                      <input 
                        required
                        type="text" 
                        className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                        value={formData.potencia_kvar}
                        onChange={(e) => setFormData({...formData, potencia_kvar: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Cap. Nominal (µF) *</label>
                      <input 
                        required
                        type="text" 
                        className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                        value={formData.capacitancia_nominal_uf}
                        onChange={(e) => setFormData({...formData, capacitancia_nominal_uf: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Tensão Nominal (V) *</label>
                      <input 
                        required
                        type="text" 
                        className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                        value={formData.tensao_nominal_v}
                        onChange={(e) => setFormData({...formData, tensao_nominal_v: e.target.value})}
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
