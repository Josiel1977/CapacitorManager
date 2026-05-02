'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, FileText, Download, ChevronRight, 
  Users, Database, Zap, ClipboardCheck, BarChart3, 
  Wrench, HelpCircle, CheckCircle2, AlertTriangle, XCircle, Play,
  Search, Menu, X, Factory, Globe, Sliders, Calculator
} from 'lucide-react';
import { cn } from '@/lib/utils';

const docs = {
  introducao: {
    title: "📖 Introdução",
    content: ( ... ) // mantenha o conteúdo original
  },
  primeirosPassos: {
    title: "🚀 Primeiros Passos",
    content: ( ... )
  },
  dimensionamento: {
    title: "📊 Dimensionamento por Faturas",
    content: ( ... )
  },
  fundamentos: {
    title: "📐 Fundamentos Técnicos",
    content: ( ... )
  },
  concessionarias: {
    title: "🌐 Concessionárias Suportadas",
    content: ( ... )
  },
  personalizacao: {
    title: "⚙️ Personalização",
    content: ( ... )
  },
  medicoes: {
    title: "📊 Medições e Validação",
    content: ( ... )
  },
  manutencao: {
    title: "🔧 Manutenção Preditiva",
    content: ( ... )
  },
  relatorios: {
    title: "📄 Relatórios",
    content: ( ... )
  },
  faq: {
    title: "❓ FAQ - Perguntas Frequentes",
    content: ( ... )
  },
  desenvolvedores: {
    title: "👨‍💻 Desenvolvedores",
    content: ( ... )
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