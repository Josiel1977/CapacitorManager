'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  HelpCircle, Search, ChevronDown, ChevronUp, Mail, 
  MessageCircle, FileText, Video, BookOpen, Star, 
  CheckCircle, AlertCircle, Zap, Settings, Users, Database
} from 'lucide-react';
import { cn } from '@/lib/utils';

const faqs = [
  {
    question: "O que é o CapacitorManager?",
    answer: "É uma plataforma web para gestão, monitoramento e manutenção preditiva de bancos de capacitores. O sistema valida medições automaticamente com base na norma IEC 60831-1/2 e fornece recomendações inteligentes."
  },
  {
    question: "Preciso instalar algum software?",
    answer: "Não! O CapacitorManager é 100% web (SaaS). Basta acessar pelo navegador, sem instalação ou manutenção local."
  },
  {
    question: "Como funciona o período de teste?",
    answer: "Oferecemos 30 dias de teste gratuito com todas as funcionalidades. Ao final, você pode optar por um dos planos pagos ou continuar com a versão Demo limitada."
  },
  {
    question: "Quais normas técnicas são utilizadas?",
    answer: "O sistema segue rigorosamente a norma IEC 60831-1/2 para bancos de capacitores, com tolerâncias configuráveis de acordo com sua necessidade."
  },
  {
    question: "Posso exportar relatórios?",
    answer: "Sim! Você pode gerar relatórios em PDF e Excel com todas as medições, análises e recomendações."
  },
  {
    question: "O sistema tem suporte?",
    answer: "Sim, oferecemos suporte por e-mail, WhatsApp e chat. Planos Pro e Enterprise têm prioridade e suporte dedicado."
  }
];

const categorias = [
  { nome: "Primeiros Passos", icone: BookOpen, cor: "bg-blue-50 text-blue-600" },
  { nome: "Clientes e Bancos", icone: Users, cor: "bg-green-50 text-green-600" },
  { nome: "Medições", icone: Zap, cor: "bg-amber-50 text-amber-600" },
  { nome: "Configurações", icone: Settings, cor: "bg-purple-50 text-purple-600" },
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
            Tire suas dúvidas e aprenda a usar o CapacitorManager como um profissional.
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

      {/* Categorias */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {categorias.map((cat, idx) => (
          <motion.div
            key={cat.nome}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white rounded-2xl p-4 text-center shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3", cat.cor)}>
              <cat.icone size={22} />
            </div>
            <h3 className="font-medium text-sm">{cat.nome}</h3>
          </motion.div>
        ))}
      </div>

      {/* FAQs */}
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

      {/* Contato Suporte */}
      <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-2xl p-6 border border-primary/20 text-center">
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
    </div>
  );
}
