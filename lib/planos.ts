import { PLANS } from "./plans";

export const planosLimites = Object.fromEntries(
  Object.values(PLANS).map((plan) => [plan.id, {
    cliente: plan.limits.clients,
    banco: plan.limits.banks,
    capacitor: plan.limits.capacitors,
  }]),
);
