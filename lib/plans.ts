export const PLAN_IDS = ["basico", "essencial", "pro", "master"] as const;

export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceMonthly: number;
  limits: {
    clients: number;
    banks: number;
    capacitors: number;
  };
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  basico: {
    id: "basico",
    name: "Básico",
    priceMonthly: 149,
    limits: { clients: 1, banks: 1, capacitors: 6 },
  },
  essencial: {
    id: "essencial",
    name: "Essencial",
    priceMonthly: 297,
    limits: { clients: 5, banks: 10, capacitors: 50 },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 597,
    limits: { clients: 20, banks: 20, capacitors: 200 },
  },
  master: {
    id: "master",
    name: "Master",
    priceMonthly: 797,
    limits: { clients: 50, banks: 100, capacitors: 600 },
  },
};

export const PLAN_LIST = PLAN_IDS.map((id) => PLANS[id]);

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && PLAN_IDS.includes(value as PlanId);
}

export function formatPlanLimits(plan: PlanDefinition): string {
  return `${plan.limits.clients} cliente${plan.limits.clients === 1 ? "" : "s"} · ${plan.limits.banks} banco${plan.limits.banks === 1 ? "" : "s"} · ${plan.limits.capacitors} capacitores`;
}
