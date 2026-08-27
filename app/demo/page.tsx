'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { 
  Play, Info, CheckCircle2, AlertTriangle, XCircle, 
  Zap, Activity, TrendingUp, Calendar, Clock, 
  DollarSign, Shield, Wrench, ArrowRight, Mail,
  CheckCircle, AlertCircle, Lock, Star, Edit3, RefreshCw, Upload, FileText, PieChart, BarChart2
} from 'lucide-react';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';
import { calculateExpectedCapacitorCurrent } from '@/lib/domain/capacitorAnalysis';
import { readJsonResponse } from '@/lib/http-json-response';
import { parseEquatorialInvoiceText, reconstructPdfText } from '@/lib/equatorial-invoice-parser';
import { buildInvoiceAuditResult, type InvoiceAuditResult } from '@/lib/invoice-audit-result';

// Dados padrão para demonstração
const DEFAULT_CAPACITOR = {
  codigo: "CAP-DEMO-001",
  potencia_kvar: 30,
  tensao_nominal_v: 480,
  capacitancia_nominal_uf: 138,
};

async function analyzeInvoiceLocally(file: File): Promise<InvoiceAuditResult> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = '';
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    text += `${reconstructPdfText(content.items as any[])}\n`;
  }
  const parsed = parseEquatorialInvoiceText(text, file.name);
  const hasUsefulData = parsed.total_pagar > 0
    || parsed.consumo_ponta_kwh > 0
    || parsed.consumo_fora_ponta_kwh > 0
    || (parsed.penalidade_reativa_informada ?? 0) > 0;
  if (!hasUsefulData) throw new Error('Não foi possível identificar os campos da fatura Equatorial.');
  return buildInvoiceAuditResult(parsed);
}

export default function DemoPage() {
  const router = useRouter();
  const [modoDemo, setModoDemo] = useState<'capacitor' | 'fatura'>('capacitor');
  const [tipoTeste, setTipoTeste] = useState<'corrente' | 'capacitancia'>('corrente');
  const [valorMedido, setValorMedido] = useState('');
  const [tensaoMedida, setTensaoMedida] = useState('480');
  
  // Estados para análise de fatura e histórico de 12 meses
  const [arquivoFatura, setArquivoFatura] = useState<File | null>(null);
  const [analisandoFatura, setAnalisandoFatura] = useState(false);
  const [resultadoFatura, setResultadoFatura] = useState<null | {
    valorTotalFatura: number;
    multaReativoFp: number;
    multaReativoPta: number;
    totalMultas: number;
    percentualMulta: number;
    economiaAnualProjetada: number;
    consumoKwh: number;
    empresa: string;
    mesReferencia: string;
    historico12Meses: Array<{
      mes: string;
      consumoFp: number;
      reativoFp: number;
      multaEstimada: number;
    }>;
  }>(null);
  
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
  
  const [testesRealizados, setTestesRealizados] = useState(0);
  const [bloqueado, setBloqueado] = useState(false);

  useEffect(() => {
    carregarContador();
  }, []);

  function carregarContador() {
    const stored = sessionStorage.getItem('demo_testes');
    const count = stored ? parseInt(stored) : 0;
    setTestesRealizados(count);
    setBloqueado(count >= 2);
  }

  function resetarTestesGeral() {
    sessionStorage.removeItem('demo_testes');
    setTestesRealizados(0);
    setBloqueado(false);
    setResultado(null);
    setResultadoFatura(null);
    setArquivoFatura(null);
    Swal.fire('Testes Liberados!', 'O contador de testes foi resetado com sucesso.', 'success');
  }

  function incrementarContador() {
    const novoContador = testesRealizados + 1;
    setTestesRealizados(novoContador);
    sessionStorage.setItem('demo_testes', novoContador.toString());
    if (novoContador >= 2) {
      setBloqueado(true);
    }
  }

  function calcularDemonstracao() {
    if (!valorMedido || parseFloat(valorMedido) === 0) {
      Swal.fire('Atenção', 'Informe um valor válido para o teste', 'warning');
      return;
    }

    if (testesRealizados >= 2) {
      setBloqueado(true);
      exibirModalLimite();
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
        valorTeorico = calculateExpectedCapacitorCurrent(
          capacitorParams.potencia_kvar,
          capacitorParams.tensao_nominal_v,
          tensao,
        );
        desvio = ((valorNumerico - valorTeorico) / valorTeorico) * 100;
      } else {
        valorTeorico = capacitorParams.capacitancia_nominal_uf * 1.5;
        desvio = ((valorNumerico - valorTeorico) / valorTeorico) * 100;
      }
      
      let status: 'aprovado' | 'atencao' | 'reprovado';
      let mensagem = '';
      
      if (desvio >= -5 && desvio <= 10) {
        status = 'aprovado';
        mensagem = '✅ Resultado dentro da faixa de aceitação configurada. Registre as condições do ensaio e mantenha o acompanhamento periódico.';
      } else if ((desvio >= -10 && desvio < -5) || (desvio > 10 && desvio <= 15)) {
        status = 'atencao';
        mensagem = '⚠️ Desvio na faixa de atenção. Confirme as condições do ensaio e programe nova medição ou inspeção técnica.';
      } else {
        status = 'reprovado';
        mensagem = '❌ Desvio fora da faixa configurada. Um profissional habilitado deve avaliar o componente e definir a ação segura.';
      }
      
      setResultado({ 
        desvio, 
        status, 
        mensagem, 
        valorTeorico,
        valorMedido: valorNumerico,
        tipo: tipoTeste
      });
      
      incrementarContador();
      setLoading(false);
    }, 500);
  }

  async function simularAnaliseFatura() {
    if (!arquivoFatura) {
      Swal.fire('Atenção', 'Faça o upload da fatura de energia em PDF.', 'warning');
      return;
    }

    if (testesRealizados >= 2) {
      setBloqueado(true);
      exibirModalLimite();
      return;
    }

    setAnalisandoFatura(true);
    try {
      const formData = new FormData();
      formData.append('fatura', arquivoFatura);
      let auditResult: InvoiceAuditResult;
      try {
        const response = await fetch('/api/capacitormanager/auditar-fatura', {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(35_000),
        });
        const body = await readJsonResponse<{ data: InvoiceAuditResult }>(
          response,
          'Não foi possível analisar a fatura.',
        );
        auditResult = body.data;
      } catch (serverError) {
        if (process.env.NODE_ENV === 'production') throw serverError;
        auditResult = await analyzeInvoiceLocally(arquivoFatura);
      }
      setResultadoFatura(auditResult);
      incrementarContador();
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'TimeoutError'
        ? 'O processamento ultrapassou 35 segundos. Tente novamente.'
        : error instanceof Error ? error.message : 'Tente novamente.';
      Swal.fire('Análise não concluída', message, 'error');
    } finally {
      setAnalisandoFatura(false);
    }
  }

  function exibirModalLimite() {
    Swal.fire({
      title: 'Testes Gratuitos Concluídos!',
      html: `
        <div class="text-center">
          <p>Você já realizou os <strong>2 testes gratuitos</strong> disponíveis.</p>
          <div class="mt-4 p-3 bg-primary/10 rounded-lg">
            <p class="font-bold text-primary">🎯 Escolha uma opção:</p>
            <ul class="text-left text-xs mt-2 space-y-1">
              <li>🔓 <strong>Assinar plano</strong> – Acesso completo imediato</li>
              <li>📞 <strong>Solicitar demonstração</strong> – Entraremos em contato</li>
            </ul>
          </div>
        </div>
      `,
      icon: 'info',
      confirmButtonText: 'Assinar Plano',
      confirmButtonColor: '#0a2b3c',
      showDenyButton: true,
      denyButtonText: 'Solicitar Demonstração',
      denyButtonColor: '#6c757d'
    }).then((result) => {
      if (result.isConfirmed) {
        router.push('/signup');
      } else if (result.isDenied) {
        handleSolicitarDemo();
      }
    });
  }

  function handleNovoTeste() {
    setResultado(null);
    setResultadoFatura(null);
    setValorMedido('');
    setArquivoFatura(null);
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

  async function handleSolicitarDemo() {
    const result = await Swal.fire({
      title: 'Zerar Multas de Reativo / Solicitar Contato',
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
            <label class="block text-sm font-medium mb-1">Telefone / WhatsApp *</label>
            <input type="tel" id="telefone" class="w-full border rounded-lg p-2" placeholder="(91) 98231-9448">
          </div>
          <div class="mb-3">
            <label class="block text-sm font-medium mb-1">Plano de Interesse</label>
            <select id="plano" class="w-full border rounded-lg p-2">
              <option value="essencial">Plano Essencial - R$ 297/mês</option>
              <option value="pro">Plano Pro - R$ 597/mês</option>
              <option value="master">Plano Master - R$ 797/mês</option>
            </select>
          </div>
          <div class="mb-3">
            <label class="block text-sm font-medium mb-1">Mensagem (opcional)</label>
            <textarea id="mensagem" rows="2" class="w-full border rounded-lg p-2" placeholder="Quero eliminar minhas multas de reativos..."></textarea>
          </div>
          <label class="flex items-start gap-2 text-xs">
            <input type="checkbox" id="privacidade" class="mt-0.5">
            <span>Concordo com a Política de Privacidade para que a equipe responda a esta solicitação.</span>
          </label>
        </form>
      `,
      showCancelButton: true,
      confirmButtonText: 'Enviar e Falar com Especialista',
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
        const aceite_privacidade = (document.getElementById('privacidade') as HTMLInputElement).checked;
        
        if (!nome || !email || !telefone || !aceite_privacidade) {
          Swal.showValidationMessage('Preencha nome, e-mail e telefone e aceite a Política de Privacidade');
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
              origem: 'Demo Page - Auditoria de Fatura',
              aceite_privacidade
            })
          });
          if (!response.ok) throw new Error('Erro ao enviar');
          return { nome, email };
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
        text: 'Nossa equipe técnica entrará em contato imediatamente para ajudar a eliminar suas multas.',
        icon: 'success',
        confirmButtonColor: '#0a2b3c'
      });
    }
  }

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
            <span className="text-sm font-medium text-white/80">Demonstração Interativa & Auditoria de Fatura</span>
          </div>
          <h1 className="mb-4 text-4xl font-bold leading-tight md:text-5xl">
            Experimente o <span className="text-secondary">CapacitorManager</span>
          </h1>
          <p className="text-lg text-white/80 md:text-xl max-w-2xl">
            Simule a validação de capacitores ou extraia os dados identificáveis de uma fatura para visualizar cobranças por reativo.
            {!bloqueado ? (
              <strong className="text-secondary"> {testesRestantes} teste(s) restante(s)</strong>
            ) : (
              <strong className="text-secondary"> Testes concluídos! Assine o plano para continuar.</strong>
            )}
          </p>
        </div>
      </motion.section>

      {/* Seletor de Modo e Botão de Destravamento de Teste */}
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
        <div className="flex gap-4">
          <button
            onClick={() => { setModoDemo('capacitor'); setResultado(null); }}
            className={cn(
              "px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm",
              modoDemo === 'capacitor' 
                ? "bg-primary text-white shadow-md scale-105" 
                : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
            )}
          >
            <Zap size={18} /> Simulador de Capacitores
          </button>
          <button
            onClick={() => { setModoDemo('fatura'); setResultadoFatura(null); }}
            className={cn(
              "px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm",
              modoDemo === 'fatura' 
                ? "bg-primary text-white shadow-md scale-105" 
                : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
            )}
          >
            <BarChart2 size={18} /> Auditoria de Fatura
          </button>
        </div>
        <button
          onClick={resetarTestesGeral}
          title="Clique para reiniciar os testes de demonstração"
          className="px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
        >
          <RefreshCw size={14} /> Resetar Testes (Destravar)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-primary">
                {modoDemo === 'capacitor' ? '🎮 Simulador de Validação de Capacitores' : '📊 Auditoria da Fatura Enviada'}
              </h2>
              <div className="text-right">
                <span className={cn(
                  "text-xs font-bold px-2 py-1 rounded-full",
                  bloqueado ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                )}>
                  {bloqueado ? "🔒 Testes Esgotados" : `📊 ${testesRealizados}/2 testes`}
                </span>
              </div>
            </div>

            {/* MODO CAPACITOR */}
            {modoDemo === 'capacitor' && (
              <>
                <div className="bg-slate-50 p-4 rounded-xl mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm font-medium text-slate-700">📋 Dados do Capacitor para Teste:</p>
                    <button onClick={resetarParametros} className="text-xs text-primary hover:underline flex items-center gap-1" disabled={bloqueado}>
                      <RefreshCw size={12} /> Resetar Padrões
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 block">Código</label>
                      <input type="text" value={DEFAULT_CAPACITOR.codigo} disabled className="w-full text-sm font-bold text-primary bg-slate-200 rounded px-2 py-1" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block">Potência (kVAr)</label>
                      <input type="number" step="0.1" value={capacitorParams.potencia_kvar} onChange={(e) => setCapacitorParams({...capacitorParams, potencia_kvar: parseFloat(e.target.value)})} disabled={bloqueado} className="w-full text-sm border rounded px-2 py-1 focus:border-primary disabled:bg-slate-100" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block">Tensão Nominal (V)</label>
                      <input type="number" step="1" value={capacitorParams.tensao_nominal_v} onChange={(e) => { setCapacitorParams({...capacitorParams, tensao_nominal_v: parseFloat(e.target.value)}); setTensaoMedida(e.target.value); }} disabled={bloqueado} className="w-full text-sm border rounded px-2 py-1 focus:border-primary disabled:bg-slate-100" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-slate-500 block">Capacitância (µF)</label>
                      <input type="number" step="0.1" value={capacitorParams.capacitancia_nominal_uf} onChange={(e) => setCapacitorParams({...capacitorParams, capacitancia_nominal_uf: parseFloat(e.target.value)})} disabled={bloqueado} className="w-full text-sm border rounded px-2 py-1 focus:border-primary disabled:bg-slate-100" />
                    </div>
                  </div>
                </div>

                {!bloqueado ? (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de Teste</label>
                      <div className="flex gap-3">
                        <button onClick={() => { setTipoTeste('corrente'); setResultado(null); setValorMedido(''); }} className={cn("flex-1 py-2 rounded-lg border transition-colors", tipoTeste === 'corrente' ? "bg-primary text-white border-primary" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
                          ⚡ Teste por Corrente (Campo)
                        </button>
                        <button onClick={() => { setTipoTeste('capacitancia'); setResultado(null); setValorMedido(''); }} className={cn("flex-1 py-2 rounded-lg border transition-colors", tipoTeste === 'capacitancia' ? "bg-primary text-white border-primary" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
                          🔋 Teste por Capacitância (Bancada)
                        </button>
                      </div>
                    </div>

                    {tipoTeste === 'corrente' ? (
                      <>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Tensão Medida (V)</label>
                          <input type="number" step="0.1" placeholder="Ex: 480" className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary" value={tensaoMedida} onChange={(e) => setTensaoMedida(e.target.value)} />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Corrente Medida (A)</label>
                          <input type="number" step="0.01" placeholder="Ex: 38.5" className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary" value={valorMedido} onChange={(e) => setValorMedido(e.target.value)} />
                        </div>
                      </>
                    ) : (
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Capacitância Medida entre Fases (µF)</label>
                        <input type="number" step="0.01" placeholder="Ex: 145.2" className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary" value={valorMedido} onChange={(e) => setValorMedido(e.target.value)} />
                      </div>
                    )}

                    <button onClick={calcularDemonstracao} disabled={loading} className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                      {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Zap size={18} />}
                      Validar Capacitor
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Lock size={40} className="text-amber-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Testes Gratuitos Concluídos!</h3>
                    <p className="text-slate-500 mb-6">Você já utilizou seus 2 testes. Clique em &quot;Resetar Testes&quot; acima para testar novamente.</p>
                    <div className="flex flex-col gap-3 max-w-xs mx-auto">
                      <button onClick={() => router.push('/signup')} className="bg-primary text-white px-6 py-3 rounded-lg font-medium inline-flex items-center justify-center gap-2">
                        <Star size={18} /> Assinar Plano
                      </button>
                      <button onClick={handleSolicitarDemo} disabled={sending} className="border border-primary text-primary bg-white px-6 py-3 rounded-lg font-medium inline-flex items-center justify-center gap-2">
                        <ArrowRight size={18} /> Solicitar Demonstração
                      </button>
                    </div>
                  </div>
                )}

                {resultado && !bloqueado && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("mt-6 p-4 rounded-xl border-2", resultado.status === 'aprovado' ? "border-green-200 bg-green-50" : resultado.status === 'atencao' ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50")}>
                    <div className="flex justify-between items-start">
                      <h3 className={cn("font-bold text-lg flex items-center gap-2", resultado.status === 'aprovado' ? "text-green-700" : resultado.status === 'atencao' ? "text-amber-700" : "text-red-700")}>
                        {resultado.status === 'aprovado' && <CheckCircle2 size={20} />}
                        {resultado.status === 'atencao' && <AlertTriangle size={20} />}
                        {resultado.status === 'reprovado' && <XCircle size={20} />}
                        {resultado.status === 'aprovado' ? 'Aprovado' : resultado.status === 'atencao' ? 'Atenção' : 'Reprovado'}
                      </h3>
                      <button onClick={handleNovoTeste} className="text-xs text-slate-400 hover:text-slate-600">Novo teste →</button>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                      <div><span className="text-slate-500">Valor Teórico:</span><strong className="block text-primary">{resultado.valorTeorico.toFixed(2)} {resultado.tipo === 'corrente' ? 'A' : 'µF'}</strong></div>
                      <div><span className="text-slate-500">Valor Medido:</span><strong className="block text-primary">{resultado.valorMedido.toFixed(2)} {resultado.tipo === 'corrente' ? 'A' : 'µF'}</strong></div>
                      <div className="col-span-2"><span className="text-slate-500">Desvio:</span><strong className={cn("block", resultado.desvio > 0 ? "text-red-600" : "text-green-600")}>{resultado.desvio > 0 ? '+' : ''}{resultado.desvio.toFixed(2)}%</strong></div>
                    </div>
                    <p className="mt-3 text-sm">{resultado.mensagem}</p>
                  </motion.div>
                )}
              </>
            )}

            {/* MODO AUDITORIA & HISTÓRICO DE 12 MESES */}
            {modoDemo === 'fatura' && (
              <>
                {!bloqueado && !resultadoFatura ? (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative">
                      <input 
                        type="file" 
                        accept="application/pdf,.pdf" 
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setArquivoFatura(e.target.files[0]);
                          }
                        }}
                      />
                      <Upload size={36} className="mx-auto text-primary mb-2" />
                      <p className="font-medium text-slate-700">
                        {arquivoFatura ? arquivoFatura.name : "Faça upload da fatura de energia em PDF"}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Compatível nesta versão com o modelo Equatorial Pará; confira os valores extraídos com o documento original.</p>
                    </div>

                    <button 
                      onClick={simularAnaliseFatura}
                      disabled={analisandoFatura || !arquivoFatura}
                      className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary/95 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {analisandoFatura ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <BarChart2 size={18} />}
                      Extrair e Analisar Fatura
                    </button>
                  </div>
                ) : null}

                {bloqueado && !resultadoFatura && (
                  <div className="text-center py-8">
                    <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Lock size={40} className="text-amber-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Testes Gratuitos Concluídos!</h3>
                    <p className="text-slate-500 mb-6">Clique em &quot;Resetar Testes&quot; acima para reiniciar sua demonstração livremente.</p>
                    <button onClick={handleSolicitarDemo} className="bg-primary text-white px-6 py-3 rounded-lg font-medium inline-flex items-center gap-2">
                      <ArrowRight size={18} /> Falar com Especialista Imediatamente
                    </button>
                  </div>
                )}

                {/* PAINEL COMPLETO EXIBIDO DIRETAMENTE NA TELA */}
                {resultadoFatura && !bloqueado && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div className="flex justify-between items-start border-b pb-4">
                      <div>
                        <span className="text-xs bg-red-100 text-red-700 font-bold px-2.5 py-1 rounded-full">Relatório de Auditoria Energética</span>
                        <h3 className="font-bold text-xl text-primary mt-2">{resultadoFatura.empresa}</h3>
                        <p className="text-xs text-slate-500">Mês de referência identificado: {resultadoFatura.mesReferencia} | Resultado da fatura enviada</p>
                      </div>
                      <button onClick={handleNovoTeste} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                        <RefreshCw size={12} /> Nova Análise
                      </button>
                    </div>

                    {/* Cards de Comparativo Direto */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <span className="text-xs text-slate-500 font-medium block">Fatura Atual (Mês Ref)</span>
                        <strong className="text-xl text-primary block mt-1">
                          R$ {resultadoFatura.valorTotalFatura.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </strong>
                        <span className="text-[11px] text-slate-400 mt-1 block">Consumo: {resultadoFatura.consumoKwh.toLocaleString('pt-BR')} kWh</span>
                      </div>

                      <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                        <span className="text-xs text-red-700 font-medium block">Multa Reativa do Mês</span>
                        <strong className="text-xl text-red-700 block mt-1">
                          R$ {resultadoFatura.totalMultas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </strong>
                        <span className="text-[11px] text-red-600 font-bold mt-1 block">
                          Impacto de {resultadoFatura.percentualMulta.toFixed(1)}% na conta
                        </span>
                      </div>

                      <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                        <span className="text-xs text-amber-800 font-medium block">Projeção anual prudente</span>
                        <strong className="text-xl text-amber-700 block mt-1">
                          R$ {resultadoFatura.economiaAnualProjetada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </strong>
                        <span className="text-[11px] text-amber-800 font-medium mt-1 block">
                          12 meses × valor atual × 90%; não é histórico nem garantia
                        </span>
                      </div>
                    </div>

                    {/* DADOS DA FATURA ENVIADA */}
                    <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
                      <div className="bg-primary/5 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                        <h4 className="font-bold text-primary text-sm flex items-center gap-2">
                          <Calendar size={16} /> Dados identificados na fatura enviada
                        </h4>
                        <span className="text-xs text-slate-500">Fonte: PDF enviado; sujeito a conferência</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-bold border-b">
                              <th className="p-3">Mês</th>
                              <th className="p-3">Consumo Ativo (kWh)</th>
                              <th className="p-3">Excedente Reativo (kVArh)</th>
                              <th className="p-3 text-right">Multa Estimada (R$)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {resultadoFatura.historico12Meses.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/80">
                                <td className="p-3 font-bold text-primary">{item.mes}</td>
                                <td className="p-3 text-slate-600">{item.consumoFp.toLocaleString('pt-BR')} kWh</td>
                                <td className="p-3 text-slate-600">{item.reativoFp.toLocaleString('pt-BR')} kVArh</td>
                                <td className="p-3 text-right font-bold text-red-600">
                                  R$ {item.multaEstimada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* CTA Comercial Imediato */}
                    <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-5 rounded-2xl border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <h4 className="font-bold text-primary text-base">Chega de jogar dinheiro fora com multas!</h4>
                        <p className="text-xs text-slate-600 mt-0.5">Use as medições e a memória de cálculo para buscar a redução das cobranças, com validação de profissional habilitado.</p>
                      </div>
                      <button 
                        onClick={handleSolicitarDemo}
                        className="bg-primary text-white text-xs px-5 py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors whitespace-nowrap inline-flex items-center gap-2 shadow-md"
                      >
                        <ArrowRight size={16} /> Quero Eliminar Essas Multas Agora
                      </button>
                    </div>
                  </motion.div>
                )}
              </>
            )}

          </div>

          <div className="bg-gradient-to-r from-primary/5 to-secondary/5 p-6 rounded-2xl text-center">
            <p className="text-slate-600 mb-3">
              {bloqueado ? 'Pronto para eliminar todas as multas e automatizar sua gestão?' : 'Quer ver este resultado aplicado nas faturas dos seus clientes?'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => router.push('/signup')} className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2">
                <Star size={18} /> Assinar Plano
              </button>
              <button onClick={handleSolicitarDemo} disabled={sending} className="border border-primary text-primary bg-white px-6 py-2 rounded-lg font-medium hover:bg-primary/5 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50">
                {sending ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Mail size={18} />}
                Solicitar Demonstração / Contato
              </button>
            </div>
          </div>
        </div>

        {/* Painel lateral */}
        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
            <h3 className="font-bold text-primary mb-4 flex items-center gap-2">
              <Info size={18} /> Como interpretar a auditoria
            </h3>
            <p className="text-sm text-slate-600 mb-3">
              A extração automatiza a leitura da fatura enviada. Ela não substitui conferência documental, histórico de várias competências nem medição em campo.
            </p>
            <ul className="text-sm space-y-2 text-slate-600">
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-600" /> Valores extraídos da competência enviada</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-600" /> Projeção anual claramente identificada</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-600" /> Conferência técnica antes da proposta</li>
            </ul>
          </div>

          <div className="rounded-2xl bg-primary/5 p-6 border border-primary/20">
            <h3 className="font-bold text-primary mb-2">🚀 Vantagens do CapacitorManager</h3>
            <ul className="text-sm space-y-2 text-slate-600">
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-600" /> Gestão completa de clientes</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-600" /> Limites transparentes conforme o plano</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-600" /> Auditoria de faturas de energia</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-600" /> Relatórios comerciais de impacto</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
