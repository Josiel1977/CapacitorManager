import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function calculateCorrenteTeorica(potenciaKvar: number, tensao: number) {
  // I = (Q × 1000) / (√3 × V)
  if (!tensao || tensao === 0) return 0;
  return (potenciaKvar * 1000) / (Math.sqrt(3) * tensao);
}

export function calculateCapacitanciaTeoricaDelta(capacitanciaNominal: number) {
  // Capacitância Teórica (entre fases) = Capacitância_nominal_fase × 1.5
  return capacitanciaNominal * 1.5;
}

export function getStatusValidacao(desvio: number, config?: {
  tolerancia_min_aprovado: number;
  tolerancia_max_aprovado: number;
  tolerancia_min_atencao: number;
  tolerancia_max_atencao: number;
}) {
  if (isNaN(desvio) || !isFinite(desvio)) return 'reprovado';

  // Arredondar para 2 casas decimais para evitar ruído de ponto flutuante
  const d = Math.round(desvio * 100) / 100;

  // Priorizar configurações do usuário se disponíveis, senão usar padrões obrigatórios
  const minAprov = Number(config?.tolerancia_min_aprovado ?? -5);
  const maxAprov = Number(config?.tolerancia_max_aprovado ?? 10);
  const minAtenc = Number(config?.tolerancia_min_atencao ?? -10);
  const maxAtenc = Number(config?.tolerancia_max_atencao ?? 15);

  // Lógica Obrigatória:
  // Aprovado: -5 a 10
  // Atenção: -10 a -5 ou 10 a 15
  // Reprovado: fora disso
  if (d >= minAprov && d <= maxAprov) return 'aprovado';
  if ((d >= minAtenc && d < minAprov) || (d > maxAprov && d <= maxAtenc)) return 'atencao';
  return 'reprovado';
}
