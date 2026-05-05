import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  const body = await request.json();
  const { type, data } = body;

  console.log('[MP Webhook] Tipo recebido:', type);

  // Assinatura recorrente – primeiro pagamento autorizado
  if (type === 'subscription_authorized_payment') {
    const preapprovalId = data.id;
    const accessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('Token de acesso não configurado');
      return NextResponse.json({ received: true });
    }

    const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const subscription = await res.json();
    const tenantId = subscription.external_reference;
    const planId = subscription.plan_id;

    const planMap: Record<string, string> = {
      [process.env.MP_PLAN_BASICO!]: 'basico',
      [process.env.MP_PLAN_ESSENCIAL!]: 'essencial',
      [process.env.MP_PLAN_PRO!]: 'pro',
      [process.env.MP_PLAN_MASTER!]: 'master',
    };
    const plano = planMap[planId];
    if (tenantId && plano) {
      await supabase.from('tenants').update({ plano, payment_status: 'active', updated_at: new Date().toISOString() }).eq('id', tenantId);
      await supabase.from('profiles').update({ plan: plano }).eq('tenant_id', tenantId);
    }
  }

  // Para pagamentos únicos (se ainda existir)
  if (type === 'payment') {
    const paymentId = data.id;
    const accessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
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
      const plano = planMap[planId];
      await supabase.from('tenants').update({ plano, payment_status: 'active', updated_at: new Date().toISOString() }).eq('mp_subscription_id', subscriptionId);
    }
  }

  return NextResponse.json({ received: true });
}