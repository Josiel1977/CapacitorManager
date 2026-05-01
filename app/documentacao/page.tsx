'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, FileText, Download, ChevronRight, 
  Users, Database, Zap, ClipboardCheck, BarChart3, 
  History, Activity, Wrench, Settings, HelpCircle,
  CheckCircle2, AlertTriangle, XCircle, Play, Star,
  Search, Menu, X, ArrowRight, Home, LayoutDashboard
} from 'lucide-react';
import { cn } from '@/lib/utils';

const docs = {
  introducao: {
    title: "📖 Introdução",
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Bem-vindo ao CapacitorManager</h2>
        <p className="text-slate-600">
          O CapacitorManager é um sistema profissional para dimensionamento, gestão e manutenção preditiva de bancos de capacitores. 
          Desenvolvido para engenheiros eletricistas e gestores de energia, a plataforma oferece ferramentas completas para:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-slate-600">
          <li>Dimensionamento automático a partir de faturas de energia</li>
          <li>Cadastro e gestão de clientes</li>
          <li>Configuração de bancos de capacitores</li>
          <li>Registro e validação de medições</li>
          <li>Análise gráfica de tendências</li>
          <li>Manutenção preditiva com IA</li>
          <li>Relatórios técnicos profissionais</li>
        </ul>
        <div className="bg-primary/5 p-4 rounded-lg mt-4">
          <p className="text-sm font-medium text-primary">🎯 Versão: 2.0 | Última atualização: Maio/2026</p>
        </div>
      </div>
    )
  },
  primeirosPassos: {
    title: "🚀 Primeiros Passos",
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Como começar</h2>
        <div className="grid gap-4">
          {[
            { step: 1, title: "Cadastre seus clientes", desc: "Acesse a aba 'Clientes' e adicione as empresas que serão monitoradas." },
            { step: 2, title: "Configure os transformadores", desc: "Informe a potência (kVA), quantidade e tensão dos transformadores da instalação." },
            { step: 3, title: "Adicione faturas de energia", desc: "Insira no mínimo 2 faturas (até 12) com os dados de consumo ativo, reativo excedente e demanda." },
            { step: 4, title: "Ajuste parâmetros avançados", desc: "Defina fator de potência desejado, fator de carga, correção fixa e número de estágios." },
            { step: 5, title: "Calcule e analise", desc: "Gere o dimensionamento, visualize o memorial e exporte em PDF." }
          ].map((item) => (
            <div key={item.step} className="flex gap-3 p-3 bg-slate-50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                {item.step}
              </div>
              <div>
                <h4 className="font-bold">{item.title}</h4>
                <p className="text-sm text-slate-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  },
  dimensionamento: {
    title: "📊 Dimensionamento por Faturas",
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Dimensionamento de Banco de Capacitores</h2>
        <p className="text-slate-600">
          A partir de no mínimo 2 faturas de energia (até 12 meses), o sistema calcula automaticamente 
          a necessidade de correção do fator de potência e sugere um banco de capacitores dimensionado.
        </p>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-bold text-blue-700 mb-2">📋 Dados extraídos da fatura:</h4>
          <ul className="list-disc pl-5 text-sm">
            <li>Consumo ativo (ponta e fora ponta) – kWh</li>
            <li>Reativo excedente (ponta e fora ponta) – kVArh</li>
            <li>Demanda registrada (kW)</li>
            <li>Concessionária (tarifa aplicada automaticamente)</li>
          </ul>
        </div>

        <div className="bg-primary/5 p-4 rounded-lg">
          <h4 className="font-bold text-primary mb-2">⚙️ Metodologia</h4>
          <p className="text-sm">Potência ativa estimada = demanda medida ou (potência instalada × fator de carga × FP atual).</p>
          <p className="text-sm mt-1">kVAr = P × (tanφ_atual – tanφ_desejado).</p>
          <p className="text-sm mt-1">Resultado dividido em banco fixo (reativo do transformador) + banco automático (compensação da carga).</p>
        </div>

        <div className="bg-slate-50 p-4 rounded-lg">
          <h4 className="font-bold mb-2">🎛️ Parâmetros configuráveis pelo usuário:</h4>
          <ul className="list-disc pl-5 text-sm">
            <li>Fator de potência desejado (0,92 / 0,95 / 0,98)</li>
            <li>Fator de carga (0,3 a 0,9) – relaciona carga média com potência instalada</li>
            <li>Correção fixa (0% a 10%) – célula capacitiva para o transformador</li>
            <li>Número de estágios automáticos (6 a 8)</li>
          </ul>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="font-bold text-green-700 mb-2">💰 Resultados financeiros:</h4>
          <ul className="list-disc pl-5 text-sm">
            <li>Multa média mensal atual</li>
            <li>Economia projetada (92% da multa)</li>
            <li>Investimento total estimado (fixo + automático)</li>
            <li>Payback (meses), economia anual, retorno em 5 anos e ROI</li>
          </ul>
        </div>

        <div className="bg-amber-50 p-3 rounded-lg text-sm">
          💡 <strong>Dica:</strong> Use o memorial gerado como proposta comercial para o cliente – ele já contém todas as análises e a recomendação técnica.
        </div>
      </div>
    )
  },
  clientes: {
    title: "👥 Gestão de Clientes",
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Clientes</h2>
        <p className="text-slate-600">Tela para cadastro e gerenciamento de clientes. Cada cliente pode ter múltiplos bancos de capacitores.</p>
        
        <div className="bg-slate-50 p-4 rounded-lg">
          <h3 className="font-bold mb-2">📋 Campos disponíveis:</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li><strong>Nome:</strong> Razão social ou nome do cliente</li>
            <li><strong>CNPJ/CPF:</strong> Documento de identificação (opcional)</li>
            <li><strong>Responsável:</strong> Pessoa de contato</li>
            <li><strong>Telefone/E-mail:</strong> Informações de contato</li>
          </ul>
        </div>
        
        <div className="bg-amber-50 p-3 rounded-lg text-sm">
          💡 <strong>Dica:</strong> Clientes desativados vão para a lixeira e podem ser restaurados posteriormente.
        </div>
      </div>
    )
  },
  bancos: {
    title: "🏦 Bancos de Capacitores",
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Bancos de Capacitores</h2>
        <p className="text-slate-600">Gerencie os bancos de capacitores vinculados aos clientes.</p>
        
        <div className="bg-slate-50 p-4 rounded-lg">
          <h3 className="font-bold mb-2">📊 Informações do banco:</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li><strong>Localização:</strong> Identificação física do banco</li>
            <li><strong>Tensão Nominal:</strong> Tensão de operação do banco</li>
            <li><strong>Potência Total:</strong> Soma de todos os capacitores do banco</li>
          </ul>
        </div>
      </div>
    )
  },
  capacitores: {
    title: "⚡ Capacitores",
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Capacitores</h2>
        <p className="text-slate-600">Cadastro individual de capacitores com suas especificações técnicas.</p>
        
        <div className="grid gap-4">
          <div className="bg-green-50 p-3 rounded-lg">
            <h4 className="font-bold text-green-700">✅ Dados obrigatórios:</h4>
            <ul className="list-disc pl-5 text-sm mt-1">
              <li>Código de identificação</li>
              <li>Potência (kVAr)</li>
              <li>Tensão nominal (V)</li>
            </ul>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg">
            <h4 className="font-bold text-blue-700">📏 Dados complementares:</h4>
            <ul className="list-disc pl-5 text-sm mt-1">
              <li>Capacitância nominal (µF)</li>
              <li>Data de instalação</li>
              <li>Fabricante e modelo</li>
            </ul>
          </div>
        </div>
      </div>
    )
  },
  medicoes: {
    title: "📊 Medições e Validação",
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Medições e Validação</h2>
        <p className="text-slate-600">Realize testes de validação em campo ou bancada.</p>
        
        <div className="grid gap-3">
          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
            <h4 className="font-bold text-green-700 flex items-center gap-2">
              <CheckCircle2 size={16} /> Aprovado
            </h4>
            <p className="text-sm">Desvio entre -5% e +10%. Capacitor dentro das especificações IEC 60831-1/2.</p>
          </div>
          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
            <h4 className="font-bold text-amber-700 flex items-center gap-2">
              <AlertTriangle size={16} /> Atenção
            </h4>
            <p className="text-sm">Desvio entre -10% e -5% OU entre +10% e +15%. Monitoramento recomendado.</p>
          </div>
          <div className="bg-red-50 p-3 rounded-lg border border-red-200">
            <h4 className="font-bold text-red-700 flex items-center gap-2">
              <XCircle size={16} /> Reprovado
            </h4>
            <p className="text-sm">Desvio abaixo de -10% ou acima de +15%. Substituição necessária.</p>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-bold text-blue-700 mb-2">📐 Fórmulas de Cálculo</h4>
          <p className="text-sm font-mono">Corrente Teórica = (Potência kVAr × 1000) / (√3 × Tensão Nominal)</p>
          <p className="text-sm font-mono mt-1">Desvio (%) = ((Medido - Teórico) / Teórico) × 100</p>
        </div>
      </div>
    )
  },
  manutencao: {
    title: "🔧 Manutenção Preditiva",
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Manutenção Preditiva</h2>
        <p className="text-slate-600">A ferramenta analisa o histórico de medições e prevê quando o capacitor precisará ser substituído.</p>
        
        <div className="bg-slate-50 p-4 rounded-lg">
          <h4 className="font-bold mb-2">📈 Como funciona:</h4>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>O sistema armazena todas as medições de cada capacitor</li>
            <li>Calcula a taxa de degradação mensal</li>
            <li>Projeta quando o desvio atingirá o limite crítico (+15% ou -10%)</li>
            <li>Gera alertas e recomendações de substituição</li>
          </ol>
        </div>

        <div className="bg-primary/5 p-4 rounded-lg">
          <h4 className="font-bold text-primary mb-2">💡 Benefícios:</h4>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Redução de multas por baixo fator de potência</li>
            <li>Planejamento de substituições (não emergencial)</li>
            <li>Aumento da vida útil dos equipamentos</li>
            <li>Economia mensal mensurável</li>
          </ul>
        </div>
      </div>
    )
  },
  relatorios: {
    title: "📄 Relatórios",
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Relatórios Técnicos</h2>
        <p className="text-slate-600">Gere relatórios profissionais com análise de tendência e recomendações.</p>
        
        <div className="bg-slate-50 p-4 rounded-lg">
          <h4 className="font-bold mb-2">📋 O que o relatório inclui:</h4>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Resumo executivo do cliente</li>
            <li>Análise de tendência por capacitor</li>
            <li>Detalhamento de todas as medições</li>
            <li>Recomendações técnicas</li>
            <li>Previsão de substituição</li>
          </ul>
        </div>

        desenvolvedores: {
  title: "👨‍💻 Desenvolvedores",
  content: (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-primary">Equipe de Desenvolvimento</h2>
      <p className="text-slate-600">
        O CapacitorManager foi projetado e desenvolvido por profissionais com vasta experiência em engenharia elétrica, eficiência energética e tecnologia da informação.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-slate-50 p-4 rounded-lg">
          <h3 className="font-bold text-primary">🧑‍🏫 Eng. Eletricista Francisco Rodrigues</h3>
          <p className="text-sm text-slate-600">Especialista em sistemas de potência, fator de potência e eficiência energética.</p>
          <p className="text-xs text-slate-500 mt-1">Responsável pela concepção dos algoritmos de dimensionamento e validação técnica das soluções.</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-lg">
          <h3 className="font-bold text-primary">⚡ Tecnólogo em Eletroténica Josiel Maia</h3>
          <p className="text-sm text-slate-600">Desenvolvedor Full Stack e entusiasta de automação.</p>
          <p className="text-xs text-slate-500 mt-1">Implementou a plataforma web, integração com faturas e geração de relatórios.</p>
        </div>
      </div>
      <div className="bg-primary/5 p-4 rounded-lg text-center">
        <p className="text-sm">📧 Para suporte, sugestões ou parcerias, entre em contato pelo e-mail: <a href="mailto:contato@capacitormanager.com.br" className="text-primary font-medium">contato@capacitormanager.com.br</a></p>
      </div>
    </div>
  )
}
        
        <div className="bg-amber-50 p-3 rounded-lg text-sm">
          💡 <strong>Dica:</strong> Os relatórios podem ser exportados em PDF para compartilhamento com clientes.
        </div>
      </div>
    )
  },
  faq: {
    title: "❓ FAQ - Perguntas Frequentes",
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Perguntas Frequentes</h2>
        
        <div className="space-y-3">
          {[
            { q: "O CapacitorManager é gratuito?", a: "Oferecemos uma versão de demonstração gratuita com testes limitados. Para acesso completo, consulte nossos planos." },
            { q: "Preciso instalar algum software?", a: "Não! O CapacitorManager é 100% web (SaaS). Basta acessar pelo navegador." },
            { q: "Quais normas técnicas são utilizadas?", a: "O sistema segue a norma IEC 60831-1/2 para bancos de capacitores e critérios da ANEEL para fator de potência." },
            { q: "Posso exportar relatórios?", a: "Sim! Você pode gerar relatórios em PDF com todos os dados e análises." },
            { q: "Como funciona o suporte?", a: "Oferecemos suporte por e-mail e WhatsApp para clientes dos planos pagos." }
          ].map((item, idx) => (
            <div key={idx} className="border-b border-slate-100 pb-3">
              <p className="font-bold text-primary">{item.q}</p>
              <p className="text-sm text-slate-600 mt-1">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }
};

export default function DocumentacaoPage() {
  const [activeSection, setActiveSection] = useState('introducao');
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sections = [
    { id: 'introducao', label: 'Introdução', icon: BookOpen },
    { id: 'primeirosPassos', label: 'Primeiros Passos', icon: Play },
    { id: 'dimensionamento', label: 'Dimensionamento por Faturas', icon: BarChart3 },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'bancos', label: 'Bancos', icon: Database },
    { id: 'capacitores', label: 'Capacitores', icon: Zap },
    { id: 'medicoes', label: 'Medições', icon: ClipboardCheck },
    { id: 'manutencao', label: 'Manutenção', icon: Wrench },
    { id: 'relatorios', label: 'Relatórios', icon: FileText },
    { id: 'faq', label: 'FAQ', icon: HelpCircle },
    { id: 'desenvolvedores', label: 'Desenvolvedores', icon: Users },
 ];
  

  const filteredDocs = sections.filter(section =>
    section.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-primary/80 p-8 text-white shadow-xl md:p-12">
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-secondary/20 p-2">
              <BookOpen size={28} className="text-secondary" />
            </div>
            <span className="text-sm font-medium text-white/80">Documentação</span>
          </div>
          <h1 className="mb-4 text-4xl font-bold leading-tight md:text-5xl">
            Guia do <span className="text-secondary">CapacitorManager</span>
          </h1>
          <p className="text-lg text-white/80 md:text-xl max-w-2xl">
            Tudo o que você precisa saber para utilizar o sistema de forma eficiente.
          </p>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar na documentação..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 outline-none focus:border-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90"
        >
          <Download size={18} />
          Baixar PDF
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden w-full flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 mb-3"
          >
            <span className="font-medium">Menu de Navegação</span>
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className={cn(
            "bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden",
            sidebarOpen ? "block" : "hidden lg:block"
          )}>
            <div className="p-4 border-b border-slate-100">
              <p className="font-bold text-primary">Navegação</p>
            </div>
            <div className="p-2">
              {filteredDocs.map((section) => (
                <button
                  key={section.id}
                  onClick={() => {
                    setActiveSection(section.id);
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 mb-1",
                    activeSection === section.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <section.icon size={18} />
                  <span>{section.label}</span>
                  {activeSection === section.id && <ChevronRight size={16} className="ml-auto" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6"
          >
            {docs[activeSection as keyof typeof docs]?.content}
          </motion.div>

          <div className="mt-6 text-center text-xs text-slate-400">
            <p>© 2026 CapacitorManager - Todos os direitos reservados</p>
            <p className="mt-1">Documentação versão 2.0 | Última atualização: Maio/2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}