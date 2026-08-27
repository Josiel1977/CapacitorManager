'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  HelpCircle, Search, ChevronDown, ChevronUp, Mail, 
  MessageCircle, FileText, BookOpen,
  Zap, Settings, Users, Database,
  ExternalLink, ClipboardCheck
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const faqs = [
  {
    question: "O que é o CapacitorManager?",
    answer: "É uma plataforma web de apoio à gestão e análise de bancos de capacitores. Ela organiza medições, aplica faixas configuradas e gera memórias de cálculo, sempre sujeitas à conferência de profissional habilitado."
  },
  {
    question: "Preciso instalar algum software?",
    answer: "Não! O CapacitorManager é 100% web (SaaS). Basta acessar pelo navegador, sem instalação ou manutenção local. Funciona no computador, tablet e smartphone."
  },
  {
    question: "Como funciona o período de teste?",
    answer: "A demonstração pública permite auditar uma fatura ou simular uma medição sem cadastro. Você também pode solicitar um piloto assistido com seus dados antes de escolher um plano."
  },
  {
    question: "Quais normas técnicas são utilizadas?",
    answer: "A aplicação usa referências técnicas e faixas configuráveis, mas não declara conformidade automática. A edição aplicável das normas, o método de ensaio e as condições de campo devem ser validados pelo responsável técnico."
  },
  {
    question: "Posso exportar relatórios?",
    answer: "A versão atual gera relatórios em PDF nos módulos que exibem a opção de exportação. Recursos não mostrados na interface não fazem parte da oferta vigente."
  },
  {
    question: "O sistema tem suporte?",
    answer: "Os canais de contato publicados são e-mail e WhatsApp em horário comercial. Prazos específicos de atendimento só se aplicam quando constarem da proposta ou contrato."
  },
  {
    question: "É seguro? Meus dados estão protegidos?",
    answer: "Usamos HTTPS, autenticação e isolamento de dados por empresa. Região, retenção e cópias de segurança dependem da configuração dos provedores; consulte a Política de Privacidade e o checklist de implantação."
  },
  {
    question: "Como faço para convidar outros usuários da minha empresa?",
    answer: "Convites e múltiplos perfis por empresa ainda não fazem parte da oferta publicada. Não inclua esse recurso em propostas até ele ser implementado e testado."
  }
];

const categorias = [
  { nome: "Primeiros Passos", icone: BookOpen, slug: "primeiros-passos", desc: "Cadastro, planos e primeiras medições." },
  { nome: "Clientes e Bancos", icone: Users, slug: "clientes-bancos", desc: "Gerenciar clientes e bancos de capacitores." },
  { nome: "Medições", icone: Zap, slug: "medicoes", desc: "Como registrar e validar medições." },
  { nome: "Configurações", icone: Settings, slug: "configuracoes", desc: "Ajustes, limites e personalização." },
];

const atalhos = [
  { titulo: "Auditar uma fatura sem cadastro", descricao: "Comece pelo seu próprio documento", icone: FileText, href: '/demo' },
  { titulo: "Entender o fluxo completo", descricao: "Clientes, bancos e medições", icone: BookOpen, href: '/como-usar' },
  { titulo: "Ver um relatório de exemplo", descricao: "Conheça a estrutura da entrega", icone: ClipboardCheck, href: '/relatorio-exemplo' },
  { titulo: "Configurar o primeiro caso acompanhado", descricao: "Solicite o piloto assistido", icone: Settings, href: '/contato' },
];

export default function AjudaPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Hero */}
      <motion.section 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-primary p-8 text-white shadow-xl md:p-12"
      >
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />
        <div className="relative z-10 text-center">
          <HelpCircle size={48} className="mx-auto text-secondary mb-4" />
          <h1 className="mb-4 text-4xl font-bold leading-tight md:text-5xl">
            Central de <span className="text-secondary">Ajuda</span>
          </h1>
          <p className="text-lg text-white/80 md:text-xl max-w-2xl mx-auto">
            Tire suas dúvidas, aprenda com tutoriais e aproveite ao máximo o CapacitorManager.
          </p>
        </div>
      </motion.section>

      {/* Search */}
      <div className="relative max-w-md mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text"
          placeholder="Buscar ajuda..."
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 outline-none focus:border-primary"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Categorias com links (simulando páginas internas) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {categorias.map((cat, idx) => (
          <Link key={cat.nome} href="/como-usar" className="group">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white rounded-2xl p-5 text-center shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer h-full"
            >
              <div className={cn("w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3 text-primary")}>
                <cat.icone size={22} />
              </div>
              <h3 className="font-bold text-primary group-hover:underline">{cat.nome}</h3>
              <p className="text-xs text-slate-500 mt-1">{cat.desc}</p>
              <span className="text-xs text-primary/60 group-hover:text-primary mt-2 inline-flex items-center gap-1">
                Ver artigos <ExternalLink size={12} />
              </span>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* Atalhos práticos */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
          <BookOpen size={20} />
          Atalhos práticos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {atalhos.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <item.icone size={20} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{item.titulo}</p>
                <p className="text-xs text-slate-400">{item.descricao}</p>
              </div>
              <ExternalLink size={16} className="text-primary" />
            </Link>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-xl font-bold text-primary mb-6 flex items-center gap-2">
          <HelpCircle size={20} />
          Perguntas Frequentes
        </h2>

        <div className="space-y-3">
          {filteredFaqs.map((faq, idx) => (
            <div key={idx} className="border border-slate-100 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
              >
                <span className="font-medium text-slate-800">{faq.question}</span>
                {openFaq === idx ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {openFaq === idx && (
                <div className="p-4 bg-slate-50 border-t border-slate-100">
                  <p className="text-sm text-slate-600">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Guia rápido */}
      <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-2xl p-6 border border-primary/20">
        <h3 className="text-lg font-bold text-primary mb-3 text-center">⚡ Guia Rápido</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-2">
            <Users size={24} className="mx-auto text-primary mb-1" />
            <p className="text-xs">Cadastre clientes</p>
          </div>
          <div className="p-2">
            <Database size={24} className="mx-auto text-primary mb-1" />
            <p className="text-xs">Crie bancos de capacitores</p>
          </div>
          <div className="p-2">
            <Zap size={24} className="mx-auto text-primary mb-1" />
            <p className="text-xs">Realize medições</p>
          </div>
          <div className="p-2">
            <FileText size={24} className="mx-auto text-primary mb-1" />
            <p className="text-xs">Exporte relatórios</p>
          </div>
        </div>
      </div>

      {/* Contato Suporte */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center">
        <MessageCircle size={32} className="mx-auto text-primary mb-3" />
        <h3 className="text-xl font-bold text-primary mb-2">Ainda com dúvidas?</h3>
        <p className="text-slate-600 mb-4">Nossa equipe está pronta para te ajudar</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a 
            href="/contato"
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90"
          >
            <Mail size={16} />
            Fale Conosco
          </a>
          <a 
            href="https://wa.me/5591984855557"
            target="_blank"
            className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
          >
            <MessageCircle size={16} />
            WhatsApp
          </a>
        </div>
      </div>

      {/* Footer com links legais */}
      <div className="text-center text-xs text-slate-400 border-t pt-6">
        <Link href="/termos" className="hover:text-primary mx-2">Termos de Uso</Link> |
        <Link href="/privacidade" className="hover:text-primary mx-2">Política de Privacidade</Link>
      </div>
    </div>
  );
}
