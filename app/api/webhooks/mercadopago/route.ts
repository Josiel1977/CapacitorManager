// app/api/webhook/mercadopago/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  const { type, data } = await req.json();
  console.log('[Webhook]', type);

  if (type === 'subscription_authorized_payment') {
    const preapprovalId = data.id;
    const accessToken = process.env.MP_ACCESS_TOKEN;
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const subscription = await mpRes.json();
    const tenantId = subscription.external_reference;
    const planId = subscription.plan_id;

    const planMap = {
      [process.env.MP_PLAN_BASICO!]: 'basico',
      [process.env.MP_PLAN_ESSENCIAL!]: 'essencial',
      [process.env.MP_PLAN_PRO!]: 'pro',
      [process.env.MP_PLAN_MASTER!]: 'master',
    };
    const plano = planMap[planId];
    if (tenantId && plano) {
      await supabase.from('tenants').update({ plano, payment_status: 'active' }).eq('id', tenantId);
      await supabase.from('profiles').update({ plan: plano }).eq('tenant_id', tenantId);
    }
  }

  if (type === 'subscription_payment_failed' || type === 'subscription_cancelled') {
    const preapprovalId = data.id;
    await supabase.from('tenants').update({ payment_status: 'past_due' }).eq('mp_subscription_id', preapprovalId);
  }

  return NextResponse.json({ received: true });
}
