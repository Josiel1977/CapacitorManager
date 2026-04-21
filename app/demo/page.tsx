'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Play, Info, CheckCircle2, AlertTriangle, XCircle, 
  Zap, Activity, TrendingUp, Calendar, Clock, 
  DollarSign, Shield, Wrench, ArrowRight, Mail,
  CheckCircle, AlertCircle
} from 'lucide-react';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

// Dados de exemplo para demonstração
const DEMO_DATA = {
  cliente: "Indústria ABC Ltda",
  banco: "Banco Principal - Sala de Máquinas",
  capacitor: {
    codigo: "CAP-DEMO-001",
    potencia_kvar: 30,
    tensao_nominal_v: 480,
    capacitancia_nominal_uf: 138,
    data_instalacao: "15/03/2022"
  }
};

export default function DemoPage() {
  const [tipoTeste, setTipoTeste] = useState<'corrente' | 'capacitancia'>('corrente');
  const [valorMedido, setValorMedido] = useState('');
  const [resultado, setResultado] = useState<null | {
    desvio: number;
    status: 'aprovado' | 'atencao' | 'reprovado';
    mensagem: string;
    valorTeorico: number;
  }>(null);
  const [loading, setLoading] = useState(false);

  function calcularDemonstracao() {
    if (!valorMedido || parseFloat(valorMedido) === 0) {
      Swal.fire('Atenção', 'Informe um valor válido para o teste', 'warning');
      return;
    }

    setLoading(true);
    
    // Simular processamento
    setTimeout(() => {
      let valorTeorico = 0;
      let desvio = 0;
      
      if (tipoTeste === 'corrente') {
        // Corrente Teórica = (Potência × 1000) / (√3 × Tensão)
        valorTeorico = (DEMO_DATA.capacitor.potencia_kvar * 1000) / (Math.sqrt(3) * DEMO_DATA.capacitor.tensao_nominal_v);
        const correnteMedida = parseFloat(valorMedido);
        desvio = ((correnteMedida - valorTeorico) / valorTeorico) * 100;
      } else {
        // Capacitância Teórica = Capacitância Nominal × 1.5
        valorTeorico = DEMO_DATA.capacitor.capacitancia_nominal_uf * 1.5;
        const capacitanciaMedida = parseFloat(valorMedido);
        desvio = ((capacitanciaMedida - valorTeorico) / valorTeorico) * 100;
      }
      
      let status: 'aprovado' | 'atencao' | 'reprovado';
      let mensagem = '';
      
      if (desvio >= -5 && desvio <= 10) {
        status = 'aprovado';
        mensagem = '✅ Capacitor dentro das especificações da norma IEC 60831-1/2. Nenhuma ação necessária.';
      } else if ((desvio >= -10 && desvio < -5) || (desvio > 10 && desvio <= 15)) {
        status = 'atencao';
        mensagem = '⚠️ Capacitor em nível de atenção. Recomenda-se monitoramento mensal e planejamento de substituição em até 6 meses.';
      } else {
        status = 'reprovado';
        mensagem = '❌ Capacitor reprovado! Substituição imediata recomendada para evitar multas por baixo fator de potência.';
      }
      
      setResultado({ desvio, status, mensagem, valorTeorico });
      setLoading(false);
    }, 500);
  }

  handleSolicitarDemo

  return (
    <div className="space-y-8 pb-12">
      {/* Hero */}
      <motion.section 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-primary/80 p-8 text-white shadow-xl md:p-12"
      >
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-secondary/20 p-2">
              <Play size={24} className="text-secondary" />
            </div>
            <span className="text-sm font-medium text-white/80">Demonstração Gratuita</span>
          </div>
          <h1 className="mb-4 text-4xl font-bold leading-tight md:text-5xl">
            Experimente o <span className="text-secondary">CapacitorManager</span>
          </h1>
          <p className="text-lg text-white/80 md:text-xl max-w-2xl">
            Teste a validação de capacitores em tempo real. Sem cadastro, sem compromisso.
          </p>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Simulador */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-primary mb-4">🎮 Simulador de Validação</h2>
            
            {/* Dados do capacitor de exemplo */}
            <div className="bg-slate-50 p-4 rounded-xl mb-6">
              <p className="text-sm text-slate-500 mb-2">📋 Capacitor de demonstração:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><span className="text-slate-500">Código:</span> <strong>{DEMO_DATA.capacitor.codigo}</strong></div>
                <div><span className="text-slate-500">Potência:</span> <strong>{DEMO_DATA.capacitor.potencia_kvar} kVAr</strong></div>
                <div><span className="text-slate-500">Tensão:</span> <strong>{DEMO_DATA.capacitor.tensao_nominal_v}V</strong></div>
                <div><span className="text-slate-500">Instalação:</span> <strong>{DEMO_DATA.capacitor.data_instalacao}</strong></div>
              </div>
            </div>

            {/* Formulário de teste */}
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de Teste</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setTipoTeste('corrente')}
                    className={cn(
                      "flex-1 py-2 rounded-lg border transition-colors",
                      tipoTeste === 'corrente' 
                        ? "bg-primary text-white border-primary" 
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    ⚡ Corrente (A)
                  </button>
                  <button
                    onClick={() => setTipoTeste('capacitancia')}
                    className={cn(
                      "flex-1 py-2 rounded-lg border transition-colors",
                      tipoTeste === 'capacitancia' 
                        ? "bg-primary text-white border-primary" 
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    🔋 Capacitância (µF)
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Valor Medido ({tipoTeste === 'corrente' ? 'Amperes (A)' : 'Microfarads (µF)'})
                </label>
                <input 
                  type="number" 
                  step="0.1"
                  placeholder={tipoTeste === 'corrente' ? "Ex: 38.5" : "Ex: 145.2"}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                  value={valorMedido}
                  onChange={(e) => setValorMedido(e.target.value)}
                />
              </div>

              <button 
                onClick={calcularDemonstracao}
                disabled={loading}
                className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Zap size={18} />
                )}
                Validar Capacitor
              </button>
            </div>

            {/* Resultado */}
            {resultado && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "mt-6 p-4 rounded-xl border-2",
                  resultado.status === 'aprovado' ? "border-green-200 bg-green-50" :
                  resultado.status === 'atencao' ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"
                )}
              >
                <h3 className={cn(
                  "font-bold text-lg flex items-center gap-2",
                  resultado.status === 'aprovado' ? "text-green-700" :
                  resultado.status === 'atencao' ? "text-amber-700" : "text-red-700"
                )}>
                  {resultado.status === 'aprovado' && <CheckCircle2 size={20} />}
                  {resultado.status === 'atencao' && <AlertTriangle size={20} />}
                  {resultado.status === 'reprovado' && <XCircle size={20} />}
                  {resultado.status === 'aprovado' ? 'Aprovado' : resultado.status === 'atencao' ? 'Atenção' : 'Reprovado'}
                </h3>
                
                <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                  <div>
                    <span className="text-slate-500">Valor Teórico:</span>
                    <strong className="block">{resultado.valorTeorico.toFixed(2)} {tipoTeste === 'corrente' ? 'A' : 'µF'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Valor Medido:</span>
                    <strong className="block">{parseFloat(valorMedido).toFixed(2)} {tipoTeste === 'corrente' ? 'A' : 'µF'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Desvio:</span>
                    <strong className={cn(
                      "block",
                      resultado.desvio > 0 ? "text-red-600" : "text-green-600"
                    )}>
                      {resultado.desvio > 0 ? '+' : ''}{resultado.desvio.toFixed(2)}%
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Norma:</span>
                    <strong className="block">IEC 60831-1/2</strong>
                  </div>
                </div>
                <p className="mt-3 text-sm">{resultado.mensagem}</p>
              </motion.div>
            )}
          </div>

          {/* Call to Action */}
          <div className="bg-gradient-to-r from-primary/5 to-secondary/5 p-6 rounded-2xl text-center">
            <p className="text-slate-600 mb-3">Gostou do que viu?</p>
            <button 
              onClick={handleSolicitarDemo}
              className="bg-primary text-white px-8 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
            >
              Solicitar Demonstração Completa
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* Painel de informações */}
        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
            <h3 className="font-bold text-primary mb-4 flex items-center gap-2">
              <Info size={18} />
              Como funciona?
            </h3>
            <div className="space-y-4 text-sm">
              {[
                { step: 1, text: "Informe o valor medido do capacitor" },
                { step: 2, text: "O sistema calcula automaticamente o desvio percentual" },
                { step: 3, text: "Classificação baseada na norma IEC 60831-1/2" },
                { step: 4, text: "Recomendação de ação (monitorar ou substituir)" }
              ].map((item) => (
                <div key={item.step} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                    {item.step}
                  </div>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
            <h3 className="font-bold text-primary mb-4">📊 Faixas de Validação</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm p-2 rounded-lg bg-green-50">
                <CheckCircle2 size={16} className="text-green-600" />
                <span><strong className="text-green-600">Aprovado:</strong> -5% a +10%</span>
              </div>
              <div className="flex items-center gap-2 text-sm p-2 rounded-lg bg-amber-50">
                <AlertTriangle size={16} className="text-amber-600" />
                <span><strong className="text-amber-600">Atenção:</strong> -10% a -5% ou +10% a +15%</span>
              </div>
              <div className="flex items-center gap-2 text-sm p-2 rounded-lg bg-red-50">
                <XCircle size={16} className="text-red-600" />
                <span><strong className="text-red-600">Reprovado:</strong> Abaixo de -10% ou acima de +15%</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-primary/5 p-6 border border-primary/20">
            <h3 className="font-bold text-primary mb-2">🚀 Versão Completa</h3>
            <ul className="text-sm space-y-2 text-slate-600">
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-600" /> Gestão completa de clientes</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-600" /> Bancos de capacitores ilimitados</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-600" /> Histórico de medições</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-600" /> Manutenção preditiva com IA</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-600" /> Relatórios profissionais</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-600" /> Dashboard com indicadores</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
