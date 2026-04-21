'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Mail, Phone, MapPin, Send, CheckCircle, User, Building, 
  MessageSquare, Star, Calendar, Clock, ArrowRight, Linkedin, 
  Github, Twitter, HelpCircle 
} from 'lucide-react';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

export default function ContatoPage() {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    empresa: '',
    cargo: '',
    mensagem: '',
    plano_interesse: 'essencial'
  });
  const [submitting, setSubmitting] = useState(false);

  const planos = [
    { id: 'demo', nome: 'Demo Gratuita', preco: 'Grátis', descricao: 'Acesso limitado para teste' },
    { id: 'essencial', nome: 'Plano Essencial', preco: 'R$ 297/mês', descricao: 'Até 10 clientes' },
    { id: 'pro', nome: 'Plano Pro', preco: 'R$ 597/mês', descricao: 'Clientes ilimitados' },
    { id: 'enterprise', nome: 'Enterprise', preco: 'Sob consulta', descricao: 'Solução customizada' }
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.nome || !formData.email) {
      Swal.fire('Atenção', 'Preencha nome e e-mail', 'warning');
      return;
    }

    setSubmitting(true);

    try {
      // Enviar para seu backend/email
      const response = await fetch('/api/contato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        Swal.fire({
          title: 'Solicitação Enviada!',
          html: `
            <div class="text-left">
              <p>✅ Recebemos sua solicitação!</p>
              <p class="text-sm text-slate-500 mt-2">Entraremos em contato em até 24h úteis.</p>
              <hr class="my-3">
              <p class="text-xs text-slate-400">Enquanto isso, explore a <a href="/demo" class="text-primary">Demonstração Gratuita</a></p>
            </div>
          `,
          icon: 'success',
          confirmButtonColor: '#0a2b3c'
        });
        
        setFormData({
          nome: '', email: '', telefone: '', empresa: '', cargo: '', mensagem: '', plano_interesse: 'essencial'
        });
      } else {
        throw new Error('Erro ao enviar');
      }
    } catch (error) {
      Swal.fire('Erro', 'Não foi possível enviar. Tente novamente.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Hero */}
      <motion.section 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-primary p-8 text-white shadow-xl md:p-12"
      >
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <Star size={28} className="text-secondary" />
            <span className="text-sm font-medium text-white/80">Solicite sua Demonstração</span>
          </div>
          <h1 className="mb-4 text-4xl font-bold leading-tight md:text-5xl">
            Comece sua <span className="text-secondary">jornada</span> com o CapacitorManager
          </h1>
          <p className="text-lg text-white/80 md:text-xl max-w-2xl">
            Preencha o formulário e nossa equipe entrará em contato para agendar uma demonstração personalizada.
          </p>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulário */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-xl font-bold text-primary mb-6">📋 Solicitar Acesso</h2>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      required
                      type="text"
                      className="w-full rounded-lg border border-slate-200 pl-10 pr-4 py-2 outline-none focus:border-primary"
                      value={formData.nome}
                      onChange={(e) => setFormData({...formData, nome: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    E-mail <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      required
                      type="email"
                      className="w-full rounded-lg border border-slate-200 pl-10 pr-4 py-2 outline-none focus:border-primary"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Telefone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="tel"
                      className="w-full rounded-lg border border-slate-200 pl-10 pr-4 py-2 outline-none focus:border-primary"
                      value={formData.telefone}
                      onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Empresa</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text"
                      className="w-full rounded-lg border border-slate-200 pl-10 pr-4 py-2 outline-none focus:border-primary"
                      value={formData.empresa}
                      onChange={(e) => setFormData({...formData, empresa: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Plano de Interesse</label>
                <select 
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:border-primary"
                  value={formData.plano_interesse}
                  onChange={(e) => setFormData({...formData, plano_interesse: e.target.value})}
                >
                  {planos.map(p => (
                    <option key={p.id} value={p.id}>{p.nome} - {p.preco}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Mensagem</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 text-slate-400" size={16} />
                  <textarea 
                    rows={4}
                    className="w-full rounded-lg border border-slate-200 pl-10 pr-4 py-2 outline-none focus:border-primary resize-none"
                    placeholder="Conte-nos sobre sua necessidade..."
                    value={formData.mensagem}
                    onChange={(e) => setFormData({...formData, mensagem: e.target.value})}
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Enviar Solicitação
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Informações de contato */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="font-bold text-primary mb-4">📞 Contato Direto</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">E-mail</p>
                  <p className="text-sm font-medium">contato@jmeletroservice.com</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">WhatsApp</p>
                  <p className="text-sm font-medium">(91) 98485-5557</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Horário de Atendimento</p>
                  <p className="text-sm font-medium">Seg-Sex: 9h às 18h</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-2xl p-6 border border-primary/20">
            <h3 className="font-bold text-primary mb-3 flex items-center gap-2">
              <Calendar size={18} />
              O que acontece após o contato?
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2">
                <ArrowRight size={14} className="text-secondary mt-0.5" />
                <span>Nossa equipe analisa sua solicitação</span>
              </div>
              <div className="flex gap-2">
                <ArrowRight size={14} className="text-secondary mt-0.5" />
                <span>Agendamos uma demonstração personalizada</span>
              </div>
              <div className="flex gap-2">
                <ArrowRight size={14} className="text-secondary mt-0.5" />
                <span>Você testa o sistema com seus dados</span>
              </div>
              <div className="flex gap-2">
                <ArrowRight size={14} className="text-secondary mt-0.5" />
                <span>Definimos o melhor plano para você</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
