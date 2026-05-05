// lib/planLimits.ts
export const planLimits = {
  free: { clients: 1, bancos: 1, capacitores: 50 },
  basico: { clients: 1, bancos: 1, capacitores: 50 },
  essencial: { clients: 5, bancos: 10, capacitores: 50 },
  pro: { clients: 20, bancos: 20, capacitores: 200 },
  master: { clients: 50, bancos: 100, capacitores: 600 }
};

export function getPlanLimits(plan: string) {
  return planLimits[plan as keyof typeof planLimits] || planLimits.free;
}