'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Play, Info, CheckCircle2, AlertTriangle, XCircle, 
  Zap, Activity, TrendingUp, Calendar, Clock, 
  DollarSign, Shield, Wrench, ArrowRight, Mail,
  CheckCircle, AlertCircle, Lock, Star, Edit3, RefreshCw
} from 'lucide-react';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

// Dados padrão para demonstração
const DEFAULT_CAPACITOR = {
  codigo: "CAP-DEMO-001",
  potencia_kvar: 30,
  tensao_nominal_v: 480,
  capacitancia_nominal_uf: 138,
};

export default function DemoPage() {
  const [tipoTeste, setTipoTeste] = useState<'corrente' | 'capacitancia'>('corrente');
  const [valorMedido, setValorMedido] = useState('');
  const [tensaoMedida, setTensaoMedida] = useState('480');
  
  // ✅ Estado para os parâmetros editáveis do capacitor
  const [capacitorParams, setCapacitorParams] = useState({
    potencia_kvar: DEFAULT_CAPACITOR.potencia_kvar,
    tensao_nominal_v: DEFAULT_CAPACITOR.tensao_nominal_v,
    capacitancia_nominal_uf: DEFAULT_CAPACITOR.capacitancia_nominal_uf,
  });
  
  const [resultado, setResultado] = useState<null | {
    desvio: number;
    status: 'aprovado' | 'atencao' | 'reprovado';
    mensagem: string;
    valorTeorico: number;
    valorMedido: number;
    tipo: string;
  }>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  
  // ✅ Contador de testes realizados (usando sessionStorage)
  const [testesRealizados, setTestesRealizados] = useState(0);
  const [bloqueado, setBloqueado] = useState(false);

  // Carregar contador ao iniciar
  useEffect(() => {
    const stored = sessionStorage.getItem('demo_testes');
    const count = stored ? parseInt(stored) : 0;
    setTestesRealizados(count);
    // ✅ Bloqueia quando atingir 2 ou mais (3ª tentativa)
    setBloqueado(count >= 2);
  }, []);

  function incrementarContador() {
    const novoContador = testesRealizados + 1;
    setTestesRealizados(novoContador);
    sessionStorage.setItem('demo_testes', novoContador.toString());
    // ✅ Bloqueia ao completar 2 testes (3ª tentativa)
    if (novoContador >= 2) {
      setBloqueado(true);
    }
  }

  function calcularDemonstracao() {
    if (!valorMedido || parseFloat(valorMedido) === 0) {
      Swal.fire('Atenção', 'Informe um valor válido para o teste', 'warning');
      return;
    }

    // ✅ Verificar se já atingiu o limite (2 testes já feitos)
    if (testesRealizados >= 2) {
      setBloqueado(true);
      Swal.fire({
        title: 'Testes Gratuitos Concluídos!',
        html: `
          <div class="text-center">
            <p>Você já realizou os <strong>2 testes gratuitos</strong> disponíveis.</p>
            <div class="mt-4 p-3 bg-primary/10 rounded-lg">
              <p class="font-bold text-primary">🎯 Desbloqueie o acesso completo!</p>
              <p class="text-sm text-slate-500 mt-1">Com a versão completa você pode:</p>
              <ul class="text-left text-xs mt-2 space-y-1">
                <li>✓ Fazer quantos testes quiser</li>
                <li>✓ Cadastrar seus próprios capacitores</li>
                <li>✓ Gerar relatórios profissionais</li>
                <li>✓ Acompanhar histórico de medições</li>
              </ul>
            </div>
          </div>
        `,
        icon: 'info',
        confirmButtonText: 'Solicitar Acesso Completo',
        confirmButtonColor: '#0a2b3c',
        showCancelButton: true,
        cancelButtonText: 'Fechar'
      }).then((result) => {
        if (result.isConfirmed) {
          handleSolicitarDemo();
        }
      });
      return;
    }

    setLoading(true);
    
    setTimeout(() => {
      let valorTeorico = 0;
      let desvio = 0;
      let valorNumerico = parseFloat(valorMedido);
      
      if (tipoTeste === 'corrente') {
        const tensao = parseFloat(tensaoMedida);
        if (isNaN(tensao) || tensao === 0) {
          Swal.fire('Atenção', 'Informe um valor válido para a tensão', 'warning');
          setLoading(false);
          return;
        }
        // ✅ Usa os parâmetros editáveis do capacitor
        valorTeorico = (capacitorParams.potencia_kvar * 1000) / (Math.sqrt(3) * tensao);
        desvio = ((valorNumerico - valorTeorico) / valorTeorico) * 100;
      } else {
        // ✅ Usa os parâmetros editáveis do capacitor
        valorTeorico = capacitorParams.capacitancia_nominal_uf * 1.5;
        desvio = ((valorNumerico - valorTeorico) / valorTeorico) * 100;
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
      
      setResultado({ 
        desvio, 
        status, 
        mensagem, 
        valorTeorico,
        valorMedido: valorNumerico,
        tipo: tipoTeste
      });
      
      // ✅ Incrementar contador APÓS o teste
      incrementarContador();
      setLoading(false);
    }, 500);
  }

  function handleNovoTeste() {
    if (bloqueado) {
      Swal.fire({
        title: 'Limite de Testes Atingido',
        html: `
          <p>Você já utilizou seus <strong>2 testes gratuitos</strong>.</p>
          <p class="mt-2">Solicite o acesso completo para continuar testando!</p>
        `,
        icon: 'info',
        confirmButtonText: 'Solicitar Acesso',
        confirmButtonColor: '#0a2b3c'
      }).then((result) => {
        if (result.isConfirmed) {
          handleSolicitarDemo();
        }
      });
      return;
    }
    
    setResultado(null);
    setValorMedido('');
    setTensaoMedida(capacitorParams.tensao_nominal_v.toString());
  }

  function resetarParametros() {
    setCapacitorParams({
      potencia_kvar: DEFAULT_CAPACITOR.potencia_kvar,
      tensao_nominal_v: DEFAULT_CAPACITOR.tensao_nominal_v,
      capacitancia_nominal_uf: DEFAULT_CAPACITOR.capacitancia_nominal_uf,
    });
    setTensaoMedida(DEFAULT_CAPACITOR.tensao_nominal_v.toString());
    Swal.fire('Parâmetros resetados!', 'Valores padrão restaurados.', 'success');
  }

  // ============================================
  // FUNÇÃO PARA SOLICITAR DEMONSTRAÇÃO
  // ============================================
  async function handleSolicitarDemo() {
    const result = await Swal.fire({
      title: 'Solicitar Demonstração Completa',
      html: `
        <form id="demo-form" class="text-left">
          <div class="mb-3">
            <label class="block text-sm font-medium mb-1">Nome *</label>
            <input type="text" id="nome" class="w-full border rounded-lg p-2" placeholder="Seu nome">
          </div>
          <div class="mb-3">
            <label class="block text-sm font-medium mb-1">E-mail *</label>
            <input type="email" id="email" class="w-full border rounded-lg p-2" placeholder="seu@email.com">
          </div>
          <div class="mb-3">
            <label class="block text-sm font-medium mb-1">Empresa</label>
            <input type="text" id="empresa" class="w-full border rounded-lg p-2" placeholder="Nome da empresa">
          </div>
          <div class="mb-3">
            <label class="block text-sm font-medium mb-1">Telefone</label>
            <input type="tel" id="telefone" class="w-full border rounded-lg p-2" placeholder="(00) 00000-0000">
          </div>
          <div class="mb-3">
            <label class="block text-sm font-medium mb-1">Plano de Interesse</label>
            <select id="plano" class="w-full border rounded-lg p-2">
              <option value="essencial">Plano Essencial - R$ 297/mês</option>
              <option value="pro">Plano Pro - R$ 597/mês</option>
              <option value="enterprise">Enterprise - Sob Consulta</option>
            </select>
          </div>
          <div class="mb-3">
            <label class="block text-sm font-medium mb-1">Mensagem (opcional)</label>
            <textarea id="mensagem" rows="2" class="w-full border rounded-lg p-2" placeholder="Alguma observação?"></textarea>
          </div>
        </form>
      `,
      showCancelButton: true,
      confirmButtonText: 'Enviar solicitação',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0a2b3c',
      cancelButtonColor: '#e74c3c',
      preConfirm: async () => {
        const nome = (document.getElementById('nome') as HTMLInputElement).value;
        const email = (document.getElementById('email') as HTMLInputElement).value;
        const empresa = (document.getElementById('empresa') as HTMLInputElement).value;
        const telefone = (document.getElementById('telefone') as HTMLInputElement).value;
        const plano_interesse = (document.getElementById('plano') as HTMLSelectElement).value;
        const mensagem = (document.getElementById('mensagem') as HTMLTextAreaElement).value;
        
        if (!nome || !email) {
          Swal.showValidationMessage('Preencha nome e e-mail');
          return false;
        }

        setSending(true);

        try {
          const response = await fetch('/api/lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              nome, 
              email, 
              telefone, 
              empresa, 
              plano_interesse,
              mensagem,
              origem: 'Demo Page'
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao enviar solicitação');
          }

          return { nome, email, empresa, telefone };
        } catch (error: any) {
          Swal.showValidationMessage(`Erro: ${error.message}`);
          return false;
        } finally {
          setSending(false);
        }
      }
    });

    if (result.isConfirmed) {
      Swal.fire({
        title: 'Solicitação enviada!',
        text: 'Entraremos em contato em até 24h úteis.',
        icon: 'success',
        confirmButtonColor: '#0a2b3c'
      });
    }
  }

  // Testes restantes
  const testesRestantes = 2 - testesRealizados;

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
            Teste a validação de capacitores em tempo real. 
            {!bloqueado ? (
              <strong className="text-secondary"> {testesRestantes} teste(s) restante(s)</strong>
            ) : (
              <strong className="text-secondary"> Testes concluídos! Solicite acesso completo.</strong>
            )}
          </p>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Simulador */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-primary">🎮 Simulador de Validação</h2>
              <div className="text-right">
                <span className={cn(
                  "text-xs font-bold px-2 py-1 rounded-full",
                  bloqueado ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                )}>
                  {bloqueado ? "🔒 Testes Esgotados" : `📊 ${testesRealizados}/2 testes`}
                </span>
              </div>
            </div>
            
            {/* ✅ Dados do capacitor EDITÁVEIS */}
            <div className="bg-slate-50 p-4 rounded-xl mb-6">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-medium text-slate-700">📋 Dados do Capacitor para Teste:</p>
                <button 
                  onClick={resetarParametros}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                  disabled={bloqueado}
                >
                  <RefreshCw size={12} />
                  Resetar
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block">Código</label>
                  <input 
                    type="text" 
                    value={DEFAULT_CAPACITOR.codigo} 
                    disabled
                    className="w-full text-sm font-bold text-primary bg-slate-200 rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block">Potência (kVAr)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={capacitorParams.potencia_kvar}
                    onChange={(e) => setCapacitorParams({...capacitorParams, potencia_kvar: parseFloat(e.target.value)})}
                    disabled={bloqueado}
                    className="w-full text-sm border rounded px-2 py-1 focus:border-primary disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block">Tensão Nominal (V)</label>
                  <input 
                    type="number" 
                    step="1"
                    value={capacitorParams.tensao_nominal_v}
                    onChange={(e) => {
                      setCapacitorParams({...capacitorParams, tensao_nominal_v: parseFloat(e.target.value)});
                      setTensaoMedida(e.target.value);
                    }}
                    disabled={bloqueado}
                    className="w-full text-sm border rounded px-2 py-1 focus:border-primary disabled:bg-slate-100"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500 block">Capacitância (µF)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={capacitorParams.capacitancia_nominal_uf}
                    onChange={(e) => setCapacitorParams({...capacitorParams, capacitancia_nominal_uf: parseFloat(e.target.value)})}
                    disabled={bloqueado}
                    className="w-full text-sm border rounded px-2 py-1 focus:border-primary disabled:bg-slate-100"
                  />
                </div>
              </div>
              {!bloqueado && (
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                  <Edit3 size={10} /> Você pode editar os valores para testar com seus dados reais!
                </p>
              )}
            </div>

            {!bloqueado ? (
              <>
                {/* Formulário de teste - ativo */}
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de Teste</label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setTipoTeste('corrente');
                          setResultado(null);
                          setValorMedido('');
                        }}
                        className={cn(
                          "flex-1 py-2 rounded-lg border transition-colors",
                          tipoTeste === 'corrente' 
                            ? "bg-primary text-white border-primary" 
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        ⚡ Teste por Corrente (Campo)
                      </button>
                      <button
                        onClick={() => {
                          setTipoTeste('capacitancia');
                          setResultado(null);
                          setValorMedido('');
                        }}
                        className={cn(
                          "flex-1 py-2 rounded-lg border transition-colors",
                          tipoTeste === 'capacitancia' 
                            ? "bg-primary text-white border-primary" 
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        🔋 Teste por Capacitância (Bancada)
                      </button>
                    </div>
                  </div>

                  {tipoTeste === 'corrente' ? (
                    <>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Tensão Medida (V)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          placeholder="Ex: 480"
                          className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                          value={tensaoMedida}
                          onChange={(e) => setTensaoMedida(e.target.value)}
                        />
                        <p className="text-xs text-slate-400 mt-1">💡 Tensão real no momento da medição</p>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Corrente Medida (A)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          placeholder="Ex: 38.5"
                          className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                          value={valorMedido}
                          onChange={(e) => setValorMedido(e.target.value)}
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Capacitância Medida entre Fases (µF)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        placeholder="Ex: 145.2"
                        className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                        value={valorMedido}
                        onChange={(e) => setValorMedido(e.target.value)}
                      />
                      <p className="mt-1 text-xs text-slate-400">
                        ⚠️ Para ligação delta, o valor teórico é Cfase × 1.5 = {(capacitorParams.capacitancia_nominal_uf * 1.5).toFixed(2)} µF
                      </p>
                    </div>
                  )}

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
              </>
            ) : (
              // ✅ Bloqueado - mostrar apenas botão de solicitação
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock size={40} className="text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Testes Gratuitos Concluídos!</h3>
                <p className="text-slate-500 mb-6">
                  Você já realizou seus 2 testes. Solicite o acesso completo para continuar.
                </p>
                <button 
                  onClick={handleSolicitarDemo}
                  disabled={sending}
                  className="bg-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {sending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Star size={18} />
                  )}
                  Solicitar Acesso Completo
                </button>
              </div>
            )}

            {/* Resultado */}
            {resultado && !bloqueado && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "mt-6 p-4 rounded-xl border-2",
                  resultado.status === 'aprovado' ? "border-green-200 bg-green-50" :
                  resultado.status === 'atencao' ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"
                )}
              >
                <div className="flex justify-between items-start">
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
                  <button 
                    onClick={handleNovoTeste}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Novo teste →
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                  <div>
                    <span className="text-slate-500">Valor Teórico:</span>
                    <strong className="block text-primary">
                      {resultado.valorTeorico.toFixed(2)} {resultado.tipo === 'corrente' ? 'A' : 'µF'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Valor Medido:</span>
                    <strong className="block text-primary">
                      {resultado.valorMedido.toFixed(2)} {resultado.tipo === 'corrente' ? 'A' : 'µF'}
                    </strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500">Desvio:</span>
                    <strong className={cn(
                      "block",
                      resultado.desvio > 0 ? "text-red-600" : "text-green-600"
                    )}>
                      {resultado.desvio > 0 ? '+' : ''}{resultado.desvio.toFixed(2)}%
                    </strong>
                  </div>
                </div>
                <p className="mt-3 text-sm">{resultado.mensagem}</p>
              </motion.div>
            )}
          </div>

          {/* Call to Action */}
          <div className="bg-gradient-to-r from-primary/5 to-secondary/5 p-6 rounded-2xl text-center">
            <p className="text-slate-600 mb-3">
              {bloqueado ? 'Já sabe como funciona?' : 'Gostou do que viu?'}
            </p>
            <button 
              onClick={handleSolicitarDemo}
              disabled={sending}
              className="bg-primary text-white px-8 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
            >
              {sending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowRight size={18} />
              )}
              {bloqueado ? 'Solicitar Acesso Completo' : 'Solicitar Demonstração Completa'}
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
                { step: 1, text: "Edite os parâmetros do capacitor (opcional)" },
                { step: 2, text: "Selecione o tipo de teste (Corrente ou Capacitância)" },
                { step: 3, text: "Informe o valor medido em campo ou bancada" },
                { step: 4, text: "O sistema calcula automaticamente o desvio percentual" },
                { step: 5, text: "Classificação baseada na norma IEC 60831-1/2" }
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
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-600" /> Testes ilimitados</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
