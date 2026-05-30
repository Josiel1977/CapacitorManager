export const PLAN_LIMITS = {
  basico: { clientes: 1, bancos: 1, capacitores: 6 },
  essencial: { clientes: 5, bancos: 10, capacitores: 50 },
  pro: { clientes: 20, bancos: 20, capacitores: 300 },
  master: { clientes: 50, bancos: 100, capacitores: 600 },
};

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.basico;
}