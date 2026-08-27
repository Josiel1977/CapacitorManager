import { PLANS, type PlanId, formatPlanLimits } from '@/lib/plans';

export default function PlanTerms({ planId }: { planId: PlanId }) {
  const plan = PLANS[planId];
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold text-primary">Condições comerciais — Plano {plan.name}</h1>
      <div className="prose prose-sm max-w-none">
        <p><strong>Preço:</strong> R$ {plan.priceMonthly.toFixed(2).replace('.', ',')} por mês. <strong>Limites:</strong> {formatPlanLimits(plan)}.</p>
        <p>A cobrança é recorrente e processada pelo Mercado Pago. A ativação depende da confirmação do pagamento. Tributos e condições exibidos no checkout prevalecem quando exigidos por lei.</p>
        <p>A assinatura é renovada mensalmente até o cancelamento. O cancelamento impede renovações futuras; estornos e direitos de arrependimento seguem a legislação aplicável e as condições informadas no checkout.</p>
        <h2>Uso técnico responsável</h2>
        <p>O CapacitorManager apoia registros, cálculos e relatórios. Resultados automáticos dependem dos dados informados e não substituem inspeção, medição em campo, projeto, laudo, ART/TRT nem decisão de profissional legalmente habilitado.</p>
        <h2>Conta e dados</h2>
        <p>O assinante deve proteger suas credenciais, manter os dados corretos e respeitar os limites contratados. O tratamento de dados pessoais segue a Política de Privacidade.</p>
        <h2>Disponibilidade e suporte</h2>
        <p>Atualizações de segurança e manutenções podem causar indisponibilidades temporárias. Os canais e horários de suporte publicados no site aplicam-se ao plano contratado.</p>
        <p className="mt-6 text-xs text-slate-500">Versão comercial: 20 de agosto de 2026. Estas condições devem ser revisadas juridicamente antes da abertura definitiva das vendas.</p>
      </div>
    </main>
  );
}
