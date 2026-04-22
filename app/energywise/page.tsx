'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sun, 
  Activity,
  Zap,
  Wifi,
  Cable,
  Server,
  Settings,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Calendar,
  DollarSign,
  BatteryCharging,
  Factory,
  MapPin
} from 'lucide-react';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';
import { cn } from '@/lib/utils';

// --- Mock Data ---
const MOCK_CURVA_GERACAO = [
  { hora: '06:00', kw: 0 },
  { hora: '07:00', kw: 2.5 },
  { hora: '08:00', kw: 12.4 },
  { hora: '09:00', kw: 25.8 },
  { hora: '10:00', kw: 38.2 },
  { hora: '11:00', kw: 45.5 },
  { hora: '12:00', kw: 50.2 }, // Pico
  { hora: '13:00', kw: 48.1 },
  { hora: '14:00', kw: 42.0 },
  { hora: '15:00', kw: 30.5 },
  { hora: '16:00', kw: 18.2 },
  { hora: '17:00', kw: 5.4 },
  { hora: '18:00', kw: 0.5 },
  { hora: '19:00', kw: 0 },
];

const MOCK_GERACAO_MENSAL = Array.from({ length: 15 }, (_, i) => ({
  dia: `${i + 1}/04`,
  kwh: Math.floor(Math.random() * 100) + 200 // Entre 200 e 300 kWh por dia
}));

const INITIAL_INVERSORES = [
  { 
    id: 'inv1', 
    modelo: 'WEG SIW500H ST030 M3', 
    sn: '6T2189045432', 
    status: 'Produzindo', 
    potenciaAtual: 25.4, 
    tensaoCA: 380, 
    correnteCA: 38.5, 
    geracaoDia: 112.5,
    temperatura: 45
  },
  { 
    id: 'inv2', 
    modelo: 'WEG SIW500H ST030 M3', 
    sn: '6T2189045433', 
    status: 'Produzindo', 
    potenciaAtual: 24.8, 
    tensaoCA: 381, 
    correnteCA: 37.6, 
    geracaoDia: 110.2,
    temperatura: 46
  }
];

export default function EnergyWisePage() {
  // --- Estados de Conexão ---
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [connectionType, setConnectionType] = useState<'rs485' | 'wifi'>('rs485');
  const [showConfig, setShowConfig] = useState(true);

  // --- Estados do Dashboard ---
  const [potenciaTotal, setPotenciaTotal] = useState(0);
  const [inversores, setInversores] = useState(INITIAL_INVERSORES);

  // --- Simulação de Conexão ---
  const handleConnect = () => {
    setConnectionStatus('connecting');
    setTimeout(() => {
      setConnectionStatus('connected');
      setShowConfig(false);
      // Define potência inicial baseada nos mocks
      setPotenciaTotal(INITIAL_INVERSORES.reduce((acc, inv) => acc + inv.potenciaAtual, 0));
    }, 2000);
  };

  const handleDisconnect = () => {
    setConnectionStatus('disconnected');
    setShowConfig(true);
    setPotenciaTotal(0);
  };

  // --- Simulação de Dados em Tempo Real (Telemetria) ---
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    const interval = setInterval(() => {
      setInversores(prev => prev.map(inv => {
        // Simula uma pequena variação na potência e corrente
        const variacao = (Math.random() * 0.4) - 0.2; // -0.2 a +0.2 kW
        const novaPotencia = Math.max(0, inv.potenciaAtual + variacao);
        const novaCorrente = (novaPotencia * 1000) / (Math.sqrt(3) * inv.tensaoCA);
        
        return {
          ...inv,
          potenciaAtual: Number(novaPotencia.toFixed(1)),
          correnteCA: Number(novaCorrente.toFixed(1))
        };
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, [connectionStatus]);

  // Atualiza a potência total sempre que os inversores atualizam
  useEffect(() => {
    if (connectionStatus === 'connected') {
      setPotenciaTotal(inversores.reduce((acc, inv) => acc + inv.potenciaAtual, 0));
    }
  }, [inversores, connectionStatus]);

  const totalGeracaoDia = inversores.reduce((acc, inv) => acc + inv.geracaoDia, 0);
  const economiaEstimada = totalGeracaoDia * 0.95; // R$ 0,95 por kWh

  return (
    <div className="space-y-8 pb-12 max-w-7xl mx-auto">
      
      {/* Header EnergyWise - Foco em Monitoramento */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800 text-white shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-yellow-500/20 rounded-xl">
            <Sun className="text-yellow-500" size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Monitoramento Solar</h1>
            <div className="flex items-center gap-2 text-slate-400 text-sm mt-1">
              <Factory size={14} />
              <span>Indústria XYZ</span>
              <span className="text-slate-600">•</span>
              <MapPin size={14} />
              <span>Usina Telhado Principal</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border",
            connectionStatus === 'connected' ? "bg-green-500/10 text-green-400 border-green-500/20" :
            connectionStatus === 'connecting' ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
            "bg-slate-800 text-slate-400 border-slate-700"
          )}>
            {connectionStatus === 'connected' && <CheckCircle2 size={16} />}
            {connectionStatus === 'connecting' && <RefreshCw size={16} className="animate-spin" />}
            {connectionStatus === 'disconnected' && <AlertCircle size={16} />}
            {connectionStatus === 'connected' ? 'Recebendo Telemetria' :
             connectionStatus === 'connecting' ? 'Conectando...' : 'Telemetria Offline'}
          </div>
          
          {connectionStatus === 'connected' && (
            <button 
              onClick={() => setShowConfig(!showConfig)}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors text-slate-300"
            >
              <Settings size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Interface de Configuração de Conexão */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold text-slate-800 mb-6">Configuração do Datalogger / Gateway</h2>
              
              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => setConnectionType('rs485')}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                    connectionType === 'rs485' 
                      ? "border-yellow-500 bg-yellow-50 text-yellow-700" 
                      : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"
                  )}
                >
                  <Cable size={24} />
                  <span className="font-bold">Gateway Local (RS485)</span>
                  <span className="text-xs text-center opacity-70">Leitura Modbus RTU em tempo real (1s)</span>
                </button>

                <button
                  onClick={() => setConnectionType('wifi')}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                    connectionType === 'wifi' 
                      ? "border-blue-500 bg-blue-50 text-blue-700" 
                      : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"
                  )}
                >
                  <Wifi size={24} />
                  <span className="font-bold">Nuvem (API Fabricante)</span>
                  <span className="text-xs text-center opacity-70">Integração via portal WEG/Fronius (Delay 15m)</span>
                </button>
              </div>

              <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 mb-6">
                {connectionType === 'wifi' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Fabricante</label>
                      <select className="w-full p-2 border rounded-lg bg-white">
                        <option>WEG IoT Platform</option>
                        <option>Fronius Solar.web</option>
                        <option>Growatt ShineServer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">API Key / Token</label>
                      <input type="password" defaultValue="************************" className="w-full p-2 border rounded-lg bg-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">ID da Planta (Plant ID)</label>
                      <input type="text" defaultValue="PLANT-99823" className="w-full p-2 border rounded-lg bg-white" />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">IP do Gateway</label>
                      <input type="text" defaultValue="192.168.1.150" className="w-full p-2 border rounded-lg bg-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Porta TCP</label>
                      <input type="text" defaultValue="502" className="w-full p-2 border rounded-lg bg-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Baud Rate (RS485)</label>
                      <select defaultValue="19200" className="w-full p-2 border rounded-lg bg-white">
                        <option value="9600">9600</option>
                        <option value="19200">19200</option>
                        <option value="38400">38400</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Qtd. Inversores</label>
                      <input type="number" defaultValue="2" className="w-full p-2 border rounded-lg bg-white" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                {connectionStatus === 'connected' && (
                  <button 
                    onClick={handleDisconnect}
                    className="px-6 py-2 rounded-lg font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Desconectar
                  </button>
                )}
                <button 
                  onClick={handleConnect}
                  disabled={connectionStatus === 'connecting'}
                  className="px-6 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {connectionStatus === 'connecting' ? (
                    <><RefreshCw size={18} className="animate-spin" /> Conectando...</>
                  ) : connectionStatus === 'connected' ? (
                    <><CheckCircle2 size={18} /> Atualizar Conexão</>
                  ) : (
                    <><Server size={18} /> Iniciar Telemetria</>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dashboard Principal (Só aparece conectado) */}
      {connectionStatus === 'connected' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-yellow-50 p-2 text-yellow-600">
                  <Zap size={20} />
                </div>
                <span className="text-sm font-medium text-slate-500">Potência Atual</span>
              </div>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-slate-900">{potenciaTotal.toFixed(1)}</p>
                <span className="text-slate-500 font-medium mb-1">kW</span>
              </div>
              <p className="text-xs text-green-600 font-medium mt-2 flex items-center gap-1">
                <Activity size={12} /> Atualizado agora
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                  <Sun size={20} />
                </div>
                <span className="text-sm font-medium text-slate-500">Geração Hoje</span>
              </div>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-slate-900">{totalGeracaoDia.toFixed(1)}</p>
                <span className="text-slate-500 font-medium mb-1">kWh</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">Total da usina</p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
                  <Calendar size={20} />
                </div>
                <span className="text-sm font-medium text-slate-500">Geração Mês</span>
              </div>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-slate-900">3.450</p>
                <span className="text-slate-500 font-medium mb-1">kWh</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">Abril / 2026</p>
            </div>

            <div className="rounded-2xl bg-green-50 p-6 shadow-sm border border-green-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-green-100 p-2 text-green-700">
                  <DollarSign size={20} />
                </div>
                <span className="text-sm font-medium text-green-800">Economia Hoje</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-green-700 font-bold mb-1">R$</span>
                <p className="text-3xl font-black text-green-700">{economiaEstimada.toFixed(2)}</p>
              </div>
              <p className="text-xs text-green-600/80 mt-2">Base: R$ 0,95 / kWh</p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Curva de Geração Diária */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Curva de Geração</h2>
                  <p className="text-sm text-slate-500">Potência (kW) ao longo do dia</p>
                </div>
                <TrendingUp className="text-slate-400" />
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={MOCK_CURVA_GERACAO} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorKw" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#EAB308" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="hora" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => [`${value} kW`, 'Potência']}
                    />
                    <Area type="monotone" dataKey="kw" stroke="#EAB308" strokeWidth={3} fillOpacity={1} fill="url(#colorKw)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Histórico Mensal */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Histórico de Energia</h2>
                  <p className="text-sm text-slate-500">Energia (kWh) gerada por dia</p>
                </div>
                <Calendar className="text-slate-400" />
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MOCK_GERACAO_MENSAL} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <RechartsTooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => [`${value} kWh`, 'Energia']}
                    />
                    <Bar dataKey="kwh" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tabela de Inversores (Equivalente aos Bancos de Capacitores) */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Server className="text-blue-500" />
                Inversores da Usina
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-sm font-medium text-slate-500">
                    <th className="pb-4">Equipamento</th>
                    <th className="pb-4">Status</th>
                    <th className="pb-4">Potência (kW)</th>
                    <th className="pb-4">Tensão (V)</th>
                    <th className="pb-4">Corrente (A)</th>
                    <th className="pb-4">Temp. (°C)</th>
                    <th className="pb-4">Gerado Hoje (kWh)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {inversores.map((inv) => (
                    <tr key={inv.id} className="text-sm text-slate-700">
                      <td className="py-4">
                        <p className="font-bold text-slate-900">{inv.modelo}</p>
                        <p className="text-xs text-slate-500 font-mono">SN: {inv.sn}</p>
                      </td>
                      <td className="py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-4 font-black text-slate-900">{inv.potenciaAtual.toFixed(1)}</td>
                      <td className="py-4">{inv.tensaoCA}</td>
                      <td className="py-4">{inv.correnteCA.toFixed(1)}</td>
                      <td className="py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-md text-xs font-bold",
                          inv.temperatura > 60 ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"
                        )}>
                          {inv.temperatura}°C
                        </span>
                      </td>
                      <td className="py-4 font-bold text-blue-600">{inv.geracaoDia.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </motion.div>
      )}
    </div>
  );
}

