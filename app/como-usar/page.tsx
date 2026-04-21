// app/como-usar/page.tsx
'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, Video, FileText, Download, ChevronRight, 
  Users, Database, Zap, ClipboardCheck, TrendingUp 
} from 'lucide-react';

export default function ComoUsarPage() {
  const [activeTab, setActiveTab] = useState('inicio');

  const tutorials = {
    inicio: {
      title: "Primeiros Passos",
      content: (
        <div className="space-y-4">
          <div className="bg-green-50 p-4 rounded-xl border border-green-200">
            <h3 className="font-bold text-green-700 mb-2">🎯 Bem-vindo ao CapacitorManager!</h3>
            <p className="text-sm text-green-600">Sua plataforma completa para gestão de bancos de capacitores.</p>
          </div>
          
          <div className="grid gap-4">
            <div className="flex gap-3 p-3 bg-slate-50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">1</div>
              <div>
                <h4 className="font-bold">Cadastre seus clientes</h4>
                <p className="text-sm text-slate-500">Acesse a aba "Clientes" e adicione as empresas que serão monitoradas.</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-slate-50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">2</div>
              <div>
                <h4 className="font-bold">Configure os bancos de capacitores</h4>
                <p className="text-sm text-slate-500">Para cada cliente, crie os bancos de capacitores com suas especificações técnicas.</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-slate-50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">3</div>
              <div>
                <h4 className="font-bold">Registre os capacitores</h4>
                <p className="text-sm text-slate-500">Adicione cada capacitor individualmente com potência, tensão e capacitância nominal.</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-slate-50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">4</div>
              <div>
                <h4 className="font-bold">Realize medições</h4>
                <p className="text-sm text-slate-500">Insira os valores medidos (corrente ou capacitância) e o sistema valida automaticamente.</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    clientes: {
      title: "📋 Gestão de Clientes",
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <Users size={24} />
            <h3 className="text-xl font-bold">Clientes</h3>
          </div>
          <p>Tela para cadastro e gerenciamento de clientes. Cada cliente pode ter múltiplos bancos de capacitores.</p>
          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="font-bold mb-2">Campos disponíveis:</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li><strong>Nome:</strong> Razão social ou nome do cliente</li>
              <li><strong>CNPJ/CPF:</strong> Documento de identificação (opcional)</li>
              <li><strong>Responsável:</strong> Pessoa de contato</li>
              <li><strong>Telefone/E-mail:</strong> Informações de contato</li>
            </ul>
          </div>
          <div className="bg-amber-50 p-3 rounded-lg text-sm">
            💡 <strong>Dica:</strong> Clientes desativados vão para a lixeira e podem ser restaurados.
          </div>
        </div>
      )
    },
    medicoes: {
      title: "📊 Medições e Validação",
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <ClipboardCheck size={24} />
            <h3 className="text-xl font-bold">Medições</h3>
          </div>
          
          <div className="grid gap-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h4 className="font-bold text-green-700 mb-2">✅ Aprovado</h4>
              <p className="text-sm">Desvio entre -5% e +10%. Capacitor dentro das especificações IEC.</p>
            </div>
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
              <h4 className="font-bold text-amber-700 mb-2">⚠️ Atenção</h4>
              <p className="text-sm">Desvio entre -10% e -5% OU entre +10% e +15%. Monitoramento recomendado.</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <h4 className="font-bold text-red-700 mb-2">❌ Reprovado</h4>
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
          <div className="flex items-center gap-2 text-primary">
            <TrendingUp size={24} />
            <h3 className="text-xl font-bold">Manutenção Preditiva</h3>
          </div>
          <p>A ferramenta analisa o histórico de medições e prevê quando o capacitor precisará ser substituído.</p>
          
          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="font-bold mb-2">Como funciona:</h4>
            <ol className="list-decimal pl-5 space-y-2 text-sm">
              <li>O sistema armazena todas as medições de cada capacitor</li>
              <li>Calcula a taxa de degradação mensal</li>
              <li>Projeta quando o desvio atingirá o limite crítico (+15% ou -10%)</li>
              <li>Gera alertas e recomendações de substituição</li>
            </ol>
          </div>

          <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
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
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <header>
        <div className="flex items-center gap-3 mb-4">
          <BookOpen size={32} className="text-primary" />
          <h1 className="text-3xl font-bold text-primary">Como Usar</h1>
        </div>
        <p className="text-slate-500">Guia completo do CapacitorManager</p>
      </header>

      {/* Video Tutorial */}
      <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Video size={24} className="text-primary" />
          <h2 className="text-xl font-bold text-primary">Vídeo Tutorial</h2>
        </div>
        <div className="aspect-video bg-slate-200 rounded-xl flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-3 cursor-pointer hover:bg-primary/90 transition-colors">
              <Play size={32} className="text-white ml-1" />
            </div>
            <p className="text-slate-500">Em breve: tutorial completo em vídeo</p>
          </div>
        </div>
      </div>

      {/* Tabs e conteúdo */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden sticky top-24">
            {Object.entries(tutorials).map(([key, tab]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`w-full text-left px-5 py-3 transition-colors flex items-center justify-between ${
                  activeTab === key 
                    ? 'bg-primary/10 text-primary border-l-4 border-primary' 
                    : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <span>{tab.title}</span>
                <ChevronRight size={16} className={activeTab === key ? 'text-primary' : 'text-slate-400'} />
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3">
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6"
          >
            {tutorials[activeTab as keyof typeof tutorials].content}
          </motion.div>
        </div>
      </div>

      {/* Download Guia PDF */}
      <div className="bg-slate-50 rounded-2xl p-6 text-center border border-slate-200">
        <FileText size={32} className="mx-auto text-primary mb-3" />
        <h3 className="font-bold text-primary mb-2">Guia em PDF</h3>
        <p className="text-sm text-slate-500 mb-4">Baixe o guia completo para consultar offline</p>
        <button className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90">
          <Download size={18} />
          Download PDF
        </button>
      </div>
    </div>
  );
}
