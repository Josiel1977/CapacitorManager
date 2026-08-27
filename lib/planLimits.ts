import { PLANS, isPlanId } from "./plans";

export const PLAN_LIMITS = Object.fromEntries(
  Object.values(PLANS).map((plan) => [plan.id, {
    clientes: plan.limits.clients,
    bancos: plan.limits.banks,
    capacitores: plan.limits.capacitors,
  }]),
);

export function getPlanLimits(plan: string) {
  return isPlanId(plan) ? PLAN_LIMITS[plan] : PLAN_LIMITS.basico;
}
