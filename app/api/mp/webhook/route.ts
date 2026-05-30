import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  const body = await request.json();
  const { type, data } = body;
  console.log('[Webhook] Evento recebido:', type);

  // --- Assinaturas (recorrente) ---
  if (type === 'subscription_authorized_payment') {
    // Notificação de primeiro pagamento autorizado da assinatura
    const preapprovalId = data.id;
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    // Busca detalhes da assinatura
    const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const subscription = await res.json();

    // O external_reference foi enviado na criação da assinatura
    const tenantId = subscription.external_reference;
    const planId = subscription.plan_id; // ID do plano do Mercado Pago

    // Mapeia ID do plano para nome interno
    const planMap: Record<string, string> = {
      [process.env.MP_PLAN_BASICO!]: 'basico',
      [process.env.MP_PLAN_ESSENCIAL!]: 'essencial',
      [process.env.MP_PLAN_PRO!]: 'pro',
      [process.env.MP_PLAN_MASTER!]: 'master',
    };
    const plano = planMap[planId];

    if (tenantId && plano) {
      // Atualiza o tenant (ou a tabela profiles) com o plano ativo
      await supabase
        .from('tenants')
        .update({ plano, payment_status: 'active', updated_at: new Date().toISOString() })
        .eq('id', tenantId);

      // Se você usa a tabela profiles, faça também:
      await supabase
        .from('profiles')
        .update({ plan: plano })
        .eq('tenant_id', tenantId);
    }
  }

  // --- (Opcional) Compatibilidade com pagamentos únicos antigos ---
  if (type === 'payment') {
    const paymentId = data.id;
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const payment = await res.json();
    if (payment.status === 'approved') {
      const subscriptionId = payment.preapproval_id;
      const planId = payment.preapproval_plan_id;
      const planMap: Record<string, string> = {
        [process.env.MP_PLAN_BASICO!]: 'basico',
        [process.env.MP_PLAN_ESSENCIAL!]: 'essencial',
        [process.env.MP_PLAN_PRO!]: 'pro',
        [process.env.MP_PLAN_MASTER!]: 'master',
      };
      const plano = planMap[planId] || 'essencial';
      await supabase
        .from('tenants')
        .update({ plano, payment_status: 'active', updated_at: new Date().toISOString() })
        .eq('mp_subscription_id', subscriptionId);
    }
  }

  return NextResponse.json({ received: true });
}