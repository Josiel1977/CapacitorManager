'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart3, TrendingUp, AlertCircle, Zap } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { cn } from '@/lib/utils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function GraficosPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [bancos, setBancos] = useState<any[]>([]);
  const [capacitores, setCapacitores] = useState<any[]>([]);
  const [selectedCapacitor, setSelectedCapacitor] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
        const { data } = await supabase.from('capacitores').select('id, codigo_identificacao').eq('banco_id', selection.banco_id).eq('ativo', true).order('codigo_identificacao');
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
        const { data } = await supabase
          .from('medicoes')
          .select('*')
          .eq('capacitor_id', selectedCapacitor)
          .order('created_at', { ascending: true });
        setHistory(data || []);
        setLoading(false);
      } else {
        setHistory([]);
      }
    };
    loadHistory();
  }, [selectedCapacitor]);

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
          h.status_validacao === 'aprovado' ? '#2ecc71' : 
          h.status_validacao === 'atencao' ? '#f39c12' : '#e74c3c'
        ),
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => `Desvio: ${context.parsed.y.toFixed(2)}%`
        }
      }
    },
    scales: {
      y: {
        grid: { color: '#f1f5f9' },
        ticks: { callback: (value: any) => `${value}%` }
      },
      x: { grid: { display: false } }
    }
  };

  // Análise de tendência
  const firstMed = history[0];
  const lastMed = history[history.length - 1];
  const degradation = lastMed && firstMed ? lastMed.desvio_percentual - firstMed.desvio_percentual : 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-primary">Análise Gráfica</h1>
        <p className="text-slate-500">Acompanhe a evolução e tendência dos seus capacitores</p>
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
              {capacitores.map(c => <option key={c.id} value={c.id}>{c.codigo_identificacao}</option>)}
            </select>
          </div>
        </div>
      </div>

      {selectedCapacitor ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main Chart */}
          <div className="lg:col-span-2 rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-primary">Evolução do Desvio</h2>
              <BarChart3 className="text-slate-400" />
            </div>
            <div className="h-[400px]">
              {history.length > 0 ? (
                <Line data={chartData} options={chartOptions} />
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
                      degradation > 10 ? "text-error" : degradation > 5 ? "text-secondary" : "text-success"
                    )}>
                      {degradation?.toFixed(2)}%
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Comparação entre a 1ª e a última medição</p>
                  </div>

                  {degradation > 10 && (
                    <div className="flex gap-3 rounded-lg border border-error/20 bg-error/5 p-4 text-error">
                      <AlertCircle className="shrink-0" size={20} />
                      <div>
                        <p className="text-sm font-bold">Alerta de Degradação!</p>
                        <p className="text-xs">A degradação ultrapassou 10%. Recomenda-se substituição preventiva.</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
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
                <p>Mantenha os testes em dia para garantir a eficiência energética do banco.</p>
                <p>Desvios negativos indicam perda de capacitância e redução da potência reativa fornecida.</p>
              </div>
            </section>
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
