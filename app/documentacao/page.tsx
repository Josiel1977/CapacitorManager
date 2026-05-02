'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, FileText, Download, ChevronRight, 
  Users, Database, Zap, ClipboardCheck, BarChart3, 
  Wrench, HelpCircle, CheckCircle2, AlertTriangle, XCircle, Play,
  Search, Menu, X, Factory, Globe, Sliders
} from 'lucide-react';
import { cn } from '@/lib/utils';

const docs = {
  introducao: {
    title: "📖 Introdução",
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Bem-vindo ao CapacitorManager</h2>
        <p className="text-slate-600">
          O CapacitorManager é uma plataforma profissional para <strong>validação, gestão e dimensionamento de bancos de capacitores</strong>. 
          Evoluiu de um simples validador de capacitores para uma ferramenta completa que:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-slate-600">
          <li>✅ Dimensiona bancos de capacitores automaticamente a partir de faturas de energia (mínimo 2 faturas).</li>
          <li>✅ Realiza validação individual de capacitores (medições em campo/bancada).</li>
          <li>✅ Gerencia clientes, transformadores e histórico de medições.</li>
          <li>✅ Aplica manutenção preditiva com previsão de substituição.</li>
          <li>✅ Produz memoriais técnicos e propostas comerciais em PDF.</li>
        </ul>
        <div className="bg-primary/5 p-4 rounded-lg mt-4">
          <p className="text-sm font-medium text-primary">🎯 Versão: 2.0 | Última atualização: Maio/2026</p>
          <p className="text-xs text-slate-500 mt-1">📧 Suporte: <a href="mailto:suporte@capacitormanager.com.br" className="text-primary">suporte@capacitormanager.com.br</a></p>
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
            { step: 2, title: "Configure os transformadores", desc: "Informe potência (kVA), quantidade e tensão dos transformadores da instalação." },
            { step: 3, title: "Adicione faturas de energia", desc: "Insira no mínimo 2 faturas (recomenda-se 3 a 12) com os dados de consumo ativo, reativo excedente e demanda." },
            { step: 4, title: "Ajuste parâmetros avançados", desc: "Defina FP desejado, fator de carga, correção fixa e número de estágios (6 a 8)." },
            { step: 5, title: "Calcule e analise", desc: "Obtenha o dimensionamento do banco automático, economia, payback e ROI." },
            { step: 6, title: "Exporte a proposta", desc: "Gere o memorial técnico em PDF e apresente ao cliente." }
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
          A partir de no mínimo 2 faturas de energia (até 12 meses), o sistema calcula automaticamente a necessidade de correção do fator de potência 
          e sugere um banco de capacitores otimizado, considerando:
        </p>
        <ul className="list-disc pl-5 text-sm">
          <li>Multa média mensal por reativo excedente</li>
          <li>Demanda medida e potência instalada</li>
          <li>Fator de carga ajustável (0,3 a 0,9)</li>
          <li>FP desejado (0,92 / 0,95 / 0,98)</li>
          <li>Correção fixa opcional para o transformador (célula capacitiva)</li>
          <li>Número de estágios automáticos (6 a 8)</li>
        </ul>
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-bold text-blue-700 mb-2">📋 Dados extraídos da fatura:</h4>
          <ul className="list-disc pl-5 text-sm">
            <li>Consumo ativo (ponta e fora ponta) – kWh</li>
            <li>Reativo excedente (ponta e fora ponta) – kVArh</li>
            <li>Demanda registrada (kW)</li>
            <li>Concessionária (tarifa aplicada automaticamente)</li>
          </ul>
        </div>
        <div className="bg-emerald-50 p-4 rounded-lg">
          <h4 className="font-bold text-emerald-700 mb-2">💰 Resultados financeiros:</h4>
          <ul className="list-disc pl-5 text-sm">
            <li>Multa média mensal atual</li>
            <li>Economia projetada (≈ 92% da multa)</li>
            <li>Investimento total estimado (banco automático + fixo, se aplicável)</li>
            <li>Payback (meses), economia anual, retorno em 5 anos e ROI</li>
            <li>Prejuízo acumulado e projeções de 1, 3 e 5 anos</li>
          </ul>
        </div>
        <div className="bg-amber-50 p-3 rounded-lg text-sm">
          💡 <strong>Dica:</strong> Use o memorial gerado como proposta comercial – ele já contém todas as análises e a recomendação técnica.
        </div>
      </div>
    )
  },
  fundamentos: {
    title: "📐 Fundamentos Técnicos",
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Como o sistema calcula?</h2>
        <p className="text-slate-600">Todas as fórmulas seguem a norma ANEEL e as práticas clássicas da engenharia elétrica.</p>
        <div className="bg-slate-50 p-4 rounded-lg space-y-2 text-sm">
          <p><strong className="text-primary">FP atual:</strong> cosφ = E_ativa / √(E_ativa² + E_reativa²)</p>
          <p><strong className="text-primary">Potência reativa necessária (Qc):</strong> Qc = P × (tanφ₁ – tanφ₂)</p>
          <p><strong className="text-primary">Potência ativa (P):</strong> maior valor entre:</p>
          <ul className="list-disc pl-8">
            <li>Demanda máxima registrada na fatura (kW)</li>
            <li>Estimativa: Potência instalada (kVA) × fator de carga × FP atual</li>
          </ul>
          <p><strong className="text-primary">Estágios:</strong> divisão igualitária do total, arredondada para múltiplos de 2,5 kVAr (valores comerciais).</p>
          <p><strong className="text-primary">Economia projetada:</strong> multa média mensal × 0,92 (eficácia típica da correção).</p>
          <p><strong className="text-primary">Payback (meses):</strong> investimento total / economia mensal.</p>
        </div>
        <div className="bg-primary/5 p-3 rounded text-sm">
          📌 Exemplo prático com os dados da WG Armazéns (faturas Equatorial Pará) está disponível no memorial gerado.
        </div>
      </div>
    )
  },
  concessionarias: {
    title: "🌐 Concessionárias Suportadas",
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Concessionárias Integradas</h2>
        <p className="text-slate-600">O sistema reconhece automaticamente a concessionária e aplica a tarifa correta de reativo excedente (R$/kVArh).</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="bg-green-50 p-3 rounded-lg flex items-center gap-2"><Globe size={16} className="text-green-700"/> Equatorial Pará (tarifa: R$ 0,28622/kVArh)</div>
          <div className="bg-green-50 p-3 rounded-lg flex items-center gap-2"><Globe size={16} className="text-green-700"/> Roraima Energia (tarifa: R$ 0,30603/kVArh)</div>
        </div>
        <p className="text-sm text-slate-500">Novas concessionárias podem ser adicionadas sob consulta – basta entrar em contato com o suporte.</p>
      </div>
    )
  },
  personalizacao: {
    title: "⚙️ Personalização",
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Parâmetros Configuráveis</h2>
        <p className="text-slate-600">O engenheiro tem controle total sobre as premissas do dimensionamento:</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-2"><Sliders size={16}/> Fator de potência desejado (0,92 / 0,95 / 0,98)</div>
          <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-2"><Sliders size={16}/> Fator de carga (0,3 a 0,9) – reflete o nível de utilização dos transformadores</div>
          <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-2"><Sliders size={16}/> Correção fixa (0% a 10%) – célula capacitiva para compensar o reativo do transformador</div>
          <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-2"><Sliders size={16}/> Número de estágios automáticos (6 a 8)</div>
        </div>
        <p className="text-sm text-slate-500">Essa flexibilidade permite ajustar o projeto à realidade de cada instalação.</p>
      </div>
    )
  },
  medicoes: {
    title: "📊 Medições e Validação",
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Medições e Validação de Capacitores</h2>
        <p className="text-slate-600">Além do dimensionamento, a ferramenta permite validar individualmente cada capacitor em campo ou bancada, comparando a capacitância/corrente medida com o valor nominal.</p>
        <div className="grid gap-3">
          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
            <h4 className="font-bold text-green-700 flex items-center gap-2"><CheckCircle2 size={16} /> Aprovado</h4>
            <p className="text-sm">Desvio entre -5% e +10% – Capacitor dentro das especificações IEC 60831-1/2.</p>
          </div>
          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
            <h4 className="font-bold text-amber-700 flex items-center gap-2"><AlertTriangle size={16} /> Atenção</h4>
            <p className="text-sm">Desvio entre -10% e -5% OU entre +10% e +15% – Monitoramento recomendado.</p>
          </div>
          <div className="bg-red-50 p-3 rounded-lg border border-red-200">
            <h4 className="font-bold text-red-700 flex items-center gap-2"><XCircle size={16} /> Reprovado</h4>
            <p className="text-sm">Desvio abaixo de -10% ou acima de +15% – Substituição necessária.</p>
          </div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-bold text-blue-700 mb-2">📐 Fórmulas de Validação</h4>
          <p className="text-sm font-mono">Corrente Teórica = (Potência kVAr × 1000) / (√3 × Tensão Nominal)</p>
          <p className="text-sm font-mono mt-1">Desvio (%) = ((Valor Medido - Valor Teórico) / Valor Teórico) × 100</p>
        </div>
      </div>
    )
  },
  manutencao: {
    title: "🔧 Manutenção Preditiva",
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Manutenção Preditiva</h2>
        <p className="text-slate-600">Com base no histórico de medições, o sistema projeta a data em que cada capacitor atingirá o limite crítico (desvio {'>'} +15% ou {'<'} -10%).</p>
        <div className="bg-slate-50 p-4 rounded-lg">
          <h4 className="font-bold mb-2">📈 Como funciona:</h4>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>Armazena todas as medições de cada capacitor ao longo do tempo.</li>
            <li>Calcula a taxa de degradação mensal (∆% ao mês).</li>
            <li>Projeta quando o desvio atingirá o limite crítico.</li>
            <li>Gera alertas com recomendação de substituição imediata ou planejada.</li>
          </ol>
        </div>
        <div className="bg-primary/5 p-4 rounded-lg">
          <h4 className="font-bold text-primary mb-2">💡 Benefícios:</h4>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Evita multas por baixo fator de potência</li>
            <li>Permite planejar substituições (evita paradas emergenciais)</li>
            <li>Prolonga a vida útil do banco de capacitores</li>
            <li>Economia mensal mensurável</li>
          </ul>
        </div>
      </div>
    )
  },
  relatorios: {
    title: "📄 Relatórios e Propostas",
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Geração de Memorial Técnico</h2>
        <p className="text-slate-600">Após o dimensionamento, o sistema gera um memorial completo que pode ser:</p>
        <ul className="list-disc pl-5 text-sm">
          <li>Visualizado diretamente na tela de resultados</li>
          <li>Exportado para PDF com múltiplas páginas (layout profissional)</li>
          <li>Usado como proposta comercial para o cliente</li>
        </ul>
        <div className="bg-slate-50 p-4 rounded-lg">
          <h4 className="font-bold mb-2">📋 Conteúdo do memorial:</h4>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Resumo da solução (kVAr total, estágios, banco fixo + automático)</li>
            <li>Evolução do FP e multa por mês</li>
            <li>Distribuição detalhada por transformador</li>
            <li>Análise financeira (payback, ROI, projeções)</li>
            <li>Resumo executivo para carta-proposta</li>
            <li>Especificações técnicas (tensão, reatores, IP)</li>
          </ul>
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
            { q: "Quais normas técnicas são utilizadas?", a: "O sistema segue a norma IEC 60831-1/2 para bancos de capacitores e os critérios da ANEEL (Resolução 414/2010) para fator de potência." },
            { q: "Posso exportar relatórios?", a: "Sim! O memorial técnico pode ser exportado em PDF com um clique." },
            { q: "Como faço para adicionar uma nova concessionária?", a: "Entre em contato com o suporte – podemos incluir tarifas personalizadas." },
            { q: "O sistema armazena dados em nuvem?", a: "Todos os dados ficam armazenados localmente no seu navegador (localStorage). Você pode exportar/importar a qualquer momento." }
          ].map((item, idx) => (
            <div key={idx} className="border-b border-slate-100 pb-3">
              <p className="font-bold text-primary">{item.q}</p>
              <p className="text-sm text-slate-600 mt-1">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    )
  },
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
            <h3 className="font-bold text-primary">⚡ Tecnólogo em Eletrotécnica Josiel Maia</h3>
            <p className="text-sm text-slate-600">Desenvolvedor Full Stack e entusiasta de automação.</p>
            <p className="text-xs text-slate-500 mt-1">Implementou a plataforma web, integração com faturas e geração de relatórios.</p>
          </div>
        </div>
        <div className="bg-primary/5 p-4 rounded-lg text-center">
          <p className="text-sm">📧 Para suporte, sugestões ou parcerias: <a href="mailto:suporte@capacitormanager.com.br" className="text-primary font-medium">suporte@capacitormanager.com.br</a></p>
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
    { id: 'fundamentos', label: 'Fundamentos Técnicos', icon: Calculator },
    { id: 'concessionarias', label: 'Concessionárias', icon: Globe },
    { id: 'personalizacao', label: 'Personalização', icon: Sliders },
    { id: 'medicoes', label: 'Medições e Validação', icon: ClipboardCheck },
    { id: 'manutencao', label: 'Manutenção Preditiva', icon: Wrench },
    { id: 'relatorios', label: 'Relatórios', icon: FileText },
    { id: 'faq', label: 'FAQ', icon: HelpCircle },
    { id: 'desenvolvedores', label: 'Desenvolvedores', icon: Users },
  ];

  // Adicionando ícone de calculadora para fundamentos
  const getIcon = (iconName: string) => {
    switch(iconName) {
      case 'Calculator': return <Calculator size={18} />;
      case 'Globe': return <Globe size={18} />;
      case 'Sliders': return <Sliders size={18} />;
      default: return <BookOpen size={18} />;
    }
  };

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
              {filteredDocs.map((section) => {
                let Icon = section.icon;
                if (section.id === 'fundamentos') Icon = Calculator;
                if (section.id === 'concessionarias') Icon = Globe;
                if (section.id === 'personalizacao') Icon = Sliders;
                return (
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
                    <Icon size={18} />
                    <span>{section.label}</span>
                    {activeSection === section.id && <ChevronRight size={16} className="ml-auto" />}
                  </button>
                );
              })}
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
            <p className="mt-1">Documentação versão 2.1 | Última atualização: Maio/2026</p>
            <p className="mt-1">📧 Suporte: <a href="mailto:suporte@capacitormanager.com.br" className="text-primary">suporte@capacitormanager.com.br</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}