'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Send, X, CheckCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadCaptureProps {
  title?: string;
  description?: string;
  buttonText?: string;
  variant?: 'floating' | 'inline' | 'modal';
  position?: 'bottom-right' | 'bottom-left' | 'center';
}

export default function LeadCapture({ 
  title = "Receba novidades e dicas exclusivas!",
  description = "Inscreva-se para receber conteúdos sobre gestão de capacitores e eficiência energética.",
  buttonText = "Quero receber",
  variant = 'inline',
  position = 'bottom-right'
}: LeadCaptureProps) {
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setSubmitting(true);

    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nome, origem: window.location.pathname })
      });

      if (response.ok) {
        setSuccess(true);
        setEmail('');
        setNome('');
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setSubmitting(false);
    }
  }

  if (variant === 'floating' && !isVisible) return null;

  const variants = {
    floating: cn(
      "fixed z-50 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4",
      position === 'bottom-right' && "bottom-4 right-4",
      position === 'bottom-left' && "bottom-4 left-4",
      position === 'center' && "fixed inset-0 m-auto"
    ),
    inline: "w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-6",
    modal: "fixed inset-0 z-50 flex items-center justify-center bg-black/50"
  };

  if (variant === 'floating') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={variants[variant]}
      >
        <button 
          onClick={() => setIsVisible(false)}
          className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
        >
          <X size={14} />
        </button>
        
        <div className="flex items-center gap-2 mb-3">
          <Zap size={18} className="text-secondary" />
          <h3 className="font-bold text-primary text-sm">{title}</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Seu nome"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <input
            type="email"
            placeholder="Seu melhor e-mail"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button 
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Enviando...' : buttonText}
          </button>
        </form>
      </motion.div>
    );
  }

  if (variant === 'modal' && !isVisible) return null;

  if (variant === 'modal') {
    return (
      <div className={variants.modal} onClick={() => setIsVisible(false)}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl p-6 max-w-md w-full mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => setIsVisible(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
          >
            <X size={20} />
          </button>
          
          {success ? (
            <div className="text-center py-6">
              <CheckCircle size={48} className="mx-auto text-green-500 mb-3" />
              <h3 className="text-xl font-bold text-primary mb-2">Inscrição confirmada!</h3>
              <p className="text-slate-500">Você receberá nossos conteúdos em breve.</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-4">
                <Zap size={32} className="mx-auto text-secondary mb-2" />
                <h3 className="text-xl font-bold text-primary">{title}</h3>
                <p className="text-sm text-slate-500 mt-1">{description}</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="text"
                  placeholder="Seu nome"
                  className="w-full rounded-lg border border-slate-200 px-4 py-2"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
                <input
                  type="email"
                  placeholder="Seu melhor e-mail"
                  className="w-full rounded-lg border border-slate-200 px-4 py-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-primary text-white py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? 'Enviando...' : <><Send size={16} /> {buttonText}</>}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  // Inline variant
  return (
    <div className={variants.inline}>
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-bold text-primary">{title}</h3>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 flex-1">
          <input
            type="text"
            placeholder="Seu nome"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <input
            type="email"
            placeholder="Seu e-mail"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button 
            type="submit"
            disabled={submitting}
            className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {success ? <CheckCircle size={16} /> : submitting ? '...' : buttonText}
          </button>
        </form>
      </div>
    </div>
  );
}
