import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ============================================
// UTILITÁRIOS BÁSICOS
// ============================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  
  // Replace comma with dot and remove any other non-numeric characters except minus sign
  const sanitized = value.toString().replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = parseFloat(sanitized);
  return isNaN(parsed) ? 0 : parsed;
}

// ============================================
// FORMATAÇÃO
// ============================================

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatPercent(value: number, showSign: boolean = true): string {
  const formatted = value.toFixed(2);
  if (!showSign) return `${formatted}%`;
  return `${value > 0 ? '+' : ''}${formatted}%`;
}

export function formatDate(date: string | Date, format: 'short' | 'long' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (format === 'short') {
    return d.toLocaleDateString('pt-BR');
  }
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10) {
    return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  if (clean.length === 11) {
    return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  return phone;
}

export function formatCnpjCpf(value: string): string {
  const clean = value.replace(/\D/g, '');
  if (clean.length <= 11) {
    // CPF: 000.000.000-00
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4').slice(0, 14);
  }
  // CNPJ: 00.000.000/0000-00
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5').slice(0, 18);
}

// ============================================
// CÁLCULOS TÉCNICOS
// ============================================

export function calculateCorrenteTeorica(potenciaKvar: number, tensao: number) {
  // I = (Q × 1000) / (√3 × V)
  if (!tensao || tensao === 0) return 0;
  return (potenciaKvar * 1000) / (Math.sqrt(3) * tensao);
}

export function calculateCapacitanciaTeoricaDelta(capacitanciaNominal: number) {
  // Capacitância Teórica (entre fases) = Capacitância_nominal_fase × 1.5
  return capacitanciaNominal * 1.5;
}

export function calculateDesvioPercentual(medido: number, teorico: number): number {
  if (!teorico || teorico === 0) return 0;
  return ((medido - teorico) / teorico) * 100;
}

export function calculateDegradacaoMensal(desvios: number[], datas: Date[]): number {
  if (desvios.length < 2) return 0;
  
  const primeiroDesvio = Math.abs(desvios[0]);
  const ultimoDesvio = Math.abs(desvios[desvios.length - 1]);
  const variacao = ultimoDesvio - primeiroDesvio;
  
  const primeiraData = datas[0];
  const ultimaData = datas[datas.length - 1];
  const dias = (ultimaData.getTime() - primeiraData.getTime()) / (1000 * 3600 * 24);
  
  if (dias <= 0) return 0;
  return (variacao / dias) * 30;
}

export function calculatePrevisaoSubstituicao(
  desvioAtual: number,
  degradacaoMensal: number,
  limiteCritico: number = 15
): { meses: number; data: Date; urgente: boolean } | null {
  const desvioAbs = Math.abs(desvioAtual);
  const desvioRestante = limiteCritico - desvioAbs;
  
  if (desvioRestante <= 0) {
    return { meses: 0, data: new Date(), urgente: true };
  }
  
  if (degradacaoMensal <= 0) {
    return null;
  }
  
  const mesesRestantes = desvioRestante / degradacaoMensal;
  const dataPrevisao = new Date();
  dataPrevisao.setMonth(dataPrevisao.getMonth() + mesesRestantes);
  
  return {
    meses: mesesRestantes,
    data: dataPrevisao,
    urgente: mesesRestantes <= 1
  };
}

// ============================================
// VALIDAÇÃO DE STATUS (com configurações personalizáveis)
// ============================================

export interface ToleranciasConfig {
  tolerancia_min_aprovado: number;
  tolerancia_max_aprovado: number;
  tolerancia_min_atencao: number;
  tolerancia_max_atencao: number;
}

const DEFAULT_TOLERANCIAS: ToleranciasConfig = {
  tolerancia_min_aprovado: -5,
  tolerancia_max_aprovado: 10,
  tolerancia_min_atencao: -10,
  tolerancia_max_atencao: 15,
};

export function getStatusValidacao(desvio: number, config?: ToleranciasConfig) {
  if (isNaN(desvio) || !isFinite(desvio)) return 'reprovado';

  const d = Math.round(desvio * 100) / 100;
  const { minAprov, maxAprov, minAtenc, maxAtenc } = {
    minAprov: config?.tolerancia_min_aprovado ?? DEFAULT_TOLERANCIAS.tolerancia_min_aprovado,
    maxAprov: config?.tolerancia_max_aprovado ?? DEFAULT_TOLERANCIAS.tolerancia_max_aprovado,
    minAtenc: config?.tolerancia_min_atencao ?? DEFAULT_TOLERANCIAS.tolerancia_min_atencao,
    maxAtenc: config?.tolerancia_max_atencao ?? DEFAULT_TOLERANCIAS.tolerancia_max_atencao,
  };

  if (d >= minAprov && d <= maxAprov) return 'aprovado';
  if ((d >= minAtenc && d < minAprov) || (d > maxAprov && d <= maxAtenc)) return 'atencao';
  return 'reprovado';
}

export function getStatusColor(status: string): string {
  const colors = {
    aprovado: 'text-green-600 bg-green-50 border-green-200',
    atencao: 'text-amber-600 bg-amber-50 border-amber-200',
    reprovado: 'text-red-600 bg-red-50 border-red-200',
    critical: 'text-red-600 bg-red-50 border-red-200',
    warning: 'text-amber-600 bg-amber-50 border-amber-200',
    ok: 'text-green-600 bg-green-50 border-green-200',
  };
  return colors[status as keyof typeof colors] || colors.atencao;
}

export function getStatusIcon(status: string): string {
  const icons = {
    aprovado: '✅',
    atencao: '⚠️',
    reprovado: '❌',
    critical: '🔴',
    warning: '🟡',
    ok: '🟢',
  };
  return icons[status as keyof typeof icons] || '❓';
}

// ============================================
// VALIDAÇÃO DE FORMULÁRIOS
// ============================================

export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export function isValidPhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, '');
  return clean.length === 10 || clean.length === 11;
}

export function isValidCnpjCpf(value: string): boolean {
  const clean = value.replace(/\D/g, '');
  if (clean.length === 11) {
    // Validação CPF simplificada
    if (/^(\d)\1{10}$/.test(clean)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i)) * (10 - i);
    let rest = 11 - (sum % 11);
    const digit1 = rest >= 10 ? 0 : rest;
    if (parseInt(clean.charAt(9)) !== digit1) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i)) * (11 - i);
    rest = 11 - (sum % 11);
    const digit2 = rest >= 10 ? 0 : rest;
    return parseInt(clean.charAt(10)) === digit2;
  }
  if (clean.length === 14) {
    // Validação CNPJ simplificada
    if (/^(\d)\1{13}$/.test(clean)) return false;
    return true; // Validação completa pode ser adicionada
  }
  return false;
}

// ============================================
// UTILITÁRIOS PARA DEMONSTRAÇÃO
// ============================================

export function generateDemoData() {
  const demoCapacitor = {
    id: 'demo-001',
    codigo: 'CAP-DEMO-001',
    potencia_kvar: 30,
    tensao_nominal_v: 480,
    capacitancia_nominal_uf: 138,
    data_instalacao: new Date('2022-03-15'),
  };
  
  const medicoes = [
    { data: new Date('2024-01-10'), corrente: 38.2, desvio: 4.5, status: 'aprovado' },
    { data: new Date('2024-02-10'), corrente: 39.1, desvio: 7.2, status: 'aprovado' },
    { data: new Date('2024-03-10'), corrente: 41.5, desvio: 13.8, status: 'atencao' },
  ];
  
  return { capacitor: demoCapacitor, medicoes };
}

export function getTutorialSteps() {
  return [
    { step: 1, title: 'Cadastre clientes', description: 'Adicione as empresas que serão monitoradas', icon: '👥' },
    { step: 2, title: 'Configure bancos', description: 'Crie os bancos de capacitores', icon: '🏦' },
    { step: 3, title: 'Adicione capacitores', description: 'Cadastre cada capacitor com suas especificações', icon: '⚡' },
    { step: 4, title: 'Realize medições', description: 'Insira os valores medidos e valide', icon: '📊' },
    { step: 5, title: 'Analise tendências', description: 'Acompanhe a degradação e preveja manutenção', icon: '📈' },
  ];
}

// ============================================
// UTILITÁRIOS PARA LEADS/VENDAS
// ============================================

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (local.length <= 2) return email;
  const masked = local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  return `${masked}@${domain}`;
}

export function getPlanPrice(plan: string): number {
  const prices = {
    demo: 0,
    essencial: 297,
    pro: 597,
    enterprise: 0, // sob consulta
  };
  return prices[plan as keyof typeof prices] || 0;
}

export function getPlanFeatures(plan: string): string[] {
  const features = {
    demo: ['Acesso limitado', 'Apenas demonstração', 'Sem suporte'],
    essencial: ['Até 10 clientes', 'Até 50 capacitores', 'Suporte por email', 'Relatórios básicos'],
    pro: ['Clientes ilimitados', 'Capacitores ilimitados', 'Suporte prioritário', 'Relatórios avançados', 'API acesso'],
    enterprise: ['Tudo do Pro', 'Suporte dedicado', 'Customizações', 'SLA garantido', 'On-premise opcional'],
  };
  return features[plan as keyof typeof features] || features.demo;
}

// ============================================
// UTILITÁRIOS DE PERFORMANCE
// ============================================

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
