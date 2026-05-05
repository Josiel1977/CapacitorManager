import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  const body = await request.json();
  const { type, data } = body;
  console.log('[MP Webhook]', type);

  if (type === 'subscription_authorized_payment') {
    const preapprovalId = data.id;
    const accessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN;
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
      await supabase
        .from('tenants')
        .update({ payment_status: 'active', plano, updated_at: new Date().toISOString() })
        .eq('id', tenantId);
      await supabase
        .from('profiles')
        .update({ plan: plano, subscription_status: 'active' })
        .eq('tenant_id', tenantId);
    }
  }

  if (type === 'subscription_payment_failed' || type === 'subscription_cancelled') {
    const preapprovalId = data.id;
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('mp_subscription_id', preapprovalId)
      .single();
    if (tenant) {
      await supabase
        .from('tenants')
        .update({ payment_status: 'past_due' })
        .eq('id', tenant.id);
      await supabase
        .from('profiles')
        .update({ subscription_status: 'past_due' })
        .eq('tenant_id', tenant.id);
    }
  }

  return NextResponse.json({ received: true });
}