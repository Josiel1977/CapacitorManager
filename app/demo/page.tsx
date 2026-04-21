// app/demo/page.tsx
'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Play, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import Swal from 'sweetalert2';

// Dados de exemplo para demonstração
const DEMO_DATA = {
  cliente: "Indústria ABC Ltda",
  banco: "Banco Principal - Sala de Máquinas",
  capacitor: {
    codigo: "CAP-001",
    potencia_kvar: 30,
    tensao_nominal_v: 480,
    capacitancia_nominal_uf: 138,
    data_instalacao: "15/03/2022"
  },
  medicoes: [
    { data: "10/01/2024", corrente: 38.2, desvio: 4.5, status: "aprovado" },
    { data: "10/02/2024", corrente: 39.1, desvio: 7.2, status: "aprovado" },
    { data: "10/03/2024", corrente: 41.5, desvio: 13.8, status: "atencao" }
  ]
};

export default function DemoPage() {
  const [step, setStep] = useState(1);
  const [testValues, setTestValues] = useState({
    corrente_medida: '',
    tipo_teste: 'corrente'
  });
  const [resultado, setResultado] = useState(null);

  function calcularDemonstracao() {
    const correnteTeorica = (DEMO_DATA.capacitor.potencia_kvar * 1000) / (Math.sqrt(3) * DEMO_DATA.capacitor.tensao_nominal_v);
    const correnteMedida = parseFloat(testValues.corrente_medida);
    const desvio = ((correnteMedida - correnteTeorica) / correnteTeorica) * 100;
    
    let status = '';
    let cor = '';
    let mensagem = '';
    
    if (desvio >= -5 && desvio <= 10) {
      status = 'Aprovado';
      cor = 'text-green-600';
      mensagem = '✅ Capacitor dentro das especificações IEC 60831-1/2. Nenhuma ação necessária.';
    } else if ((desvio >= -10 && desvio < -5) || (desvio > 10 && desvio <= 15)) {
      status = 'Atenção';
      cor = 'text-amber-600';
      mensagem = '⚠️ Capacitor em nível de atenção. Recomenda-se monitoramento mensal e planejamento de substituição em até 6 meses.';
    } else {
      status = 'Reprovado';
      cor = 'text-red-600';
      mensagem = '❌ Capacitor reprovado! Substituição imediata recomendada para evitar multas por baixo fator de potência.';
    }
    
    setResultado({ desvio: desvio.toFixed(2), status, cor, mensagem, correnteTeorica: correnteTeorica.toFixed(2) });
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Hero da Demo */}
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

      {/* Passo a passo da demonstração */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Simulador interativo */}
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
                <select 
                  className="w-full rounded-lg border border-slate-200 px-4 py-2"
                  value={testValues.tipo_teste}
                  onChange={(e) => setTestValues({...testValues, tipo_teste: e.target.value})}
                >
                  <option value="corrente">Medição de Corrente (A)</option>
                  <option value="capacitancia">Medição de Capacitância (µF)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Valor Medido ({testValues.tipo_teste === 'corrente' ? 'Amperes (A)' : 'Microfarads (µF)'})
                </label>
                <input 
                  type="number" 
                  step="0.1"
                  placeholder={testValues.tipo_teste === 'corrente' ? "Ex: 38.5" : "Ex: 145.2"}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2"
                  value={testValues.corrente_medida}
                  onChange={(e) => setTestValues({...testValues, corrente_medida: e.target.value})}
                />
              </div>

              <button 
                onClick={calcularDemonstracao}
                className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                🔍 Validar Capacitor
              </button>
            </div>

            {/* Resultado */}
            {resultado && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-6 p-4 rounded-xl border-2 ${resultado.status === 'Aprovado' ? 'border-green-200 bg-green-50' : resultado.status === 'Atenção' ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}
              >
                <h3 className={`font-bold text-lg ${resultado.cor}`}>📊 Resultado: {resultado.status}</h3>
                <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                  <div><span className="text-slate-500">Corrente Teórica:</span> <strong>{resultado.correnteTeorica} A</strong></div>
                  <div><span className="text-slate-500">Corrente Medida:</span> <strong>{testValues.corrente_medida} A</strong></div>
                  <div><span className="text-slate-500">Desvio:</span> <strong className={resultado.cor}>{resultado.desvio > 0 ? '+' : ''}{resultado.desvio}%</strong></div>
                  <div><span className="text-slate-500">Norma:</span> <strong>IEC 60831-1/2</strong></div>
                </div>
                <p className="mt-3 text-sm">{resultado.mensagem}</p>
              </motion.div>
            )}
          </div>

          {/* Call to Action */}
          <div className="bg-gradient-to-r from-primary/5 to-secondary/5 p-6 rounded-2xl text-center">
            <p className="text-slate-600 mb-3">Gostou do que viu?</p>
            <button 
              onClick={() => Swal.fire({
                title: 'Solicitar Acesso',
                html: `
                  <form id="demo-form" class="text-left">
                    <div class="mb-3">
                      <label class="block text-sm mb-1">Nome</label>
                      <input type="text" id="nome" class="w-full border rounded-lg p-2" placeholder="Seu nome">
                    </div>
                    <div class="mb-3">
                      <label class="block text-sm mb-1">E-mail</label>
                      <input type="email" id="email" class="w-full border rounded-lg p-2" placeholder="seu@email.com">
                    </div>
                    <div class="mb-3">
                      <label class="block text-sm mb-1">Empresa</label>
                      <input type="text" id="empresa" class="w-full border rounded-lg p-2" placeholder="Nome da empresa">
                    </div>
                  </form>
                `,
                showCancelButton: true,
                confirmButtonText: 'Enviar solicitação',
                cancelButtonText: 'Cancelar',
                preConfirm: () => {
                  const nome = (document.getElementById('nome') as HTMLInputElement).value;
                  const email = (document.getElementById('email') as HTMLInputElement).value;
                  const empresa = (document.getElementById('empresa') as HTMLInputElement).value;
                  
                  if (!nome || !email) {
                    Swal.showValidationMessage('Preencha nome e e-mail');
                    return false;
                  }
                  
                  // Aqui você pode enviar para seu CRM ou banco de dados
                  console.log('Lead:', { nome, email, empresa });
                  return { nome, email, empresa };
                }
              }).then((result) => {
                if (result.isConfirmed) {
                  Swal.fire('Solicitação enviada!', 'Entraremos em contato em breve.', 'success');
                }
              })}
              className="bg-primary text-white px-8 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
            >
              Solicitar Demonstração Completa →
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
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</div>
                <p>Informe o valor medido do capacitor (corrente ou capacitância)</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</div>
                <p>O sistema calcula automaticamente o desvio percentual</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">3</div>
                <p>Classificação baseada na norma IEC 60831-1/2</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">4</div>
                <p>Recomendação de ação (monitorar ou substituir)</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
            <h3 className="font-bold text-primary mb-4">📊 Faixas de Validação</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={16} className="text-green-600" />
                <span><strong className="text-green-600">Aprovado:</strong> -5% a +10%</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle size={16} className="text-amber-600" />
                <span><strong className="text-amber-600">Atenção:</strong> -10% a -5% ou +10% a +15%</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <XCircle size={16} className="text-red-600" />
                <span><strong className="text-red-600">Reprovado:</strong> Abaixo de -10% ou acima de +15%</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-primary/5 p-6 border border-primary/20">
            <h3 className="font-bold text-primary mb-2">🚀 Versão Completa</h3>
            <ul className="text-sm space-y-2 text-slate-600">
              <li>✓ Gestão completa de clientes</li>
              <li>✓ Bancos de capacitores ilimitados</li>
              <li>✓ Histórico de medições</li>
              <li>✓ Manutenção preditiva com IA</li>
              <li>✓ Relatórios profissionais</li>
              <li>✓ Dashboard com indicadores</li>
              <li>✓ Suporte prioritário</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
