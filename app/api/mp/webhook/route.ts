import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  const body = await request.json();
  if (body.type !== 'payment') return NextResponse.json({ received: true });

  const paymentId = body.data.id;
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const payment = await res.json();

  if (payment.status === 'approved') {
    const subscriptionId = payment.preapproval_id;
    const planId = payment.preapproval_plan_id;

    // Mapeia o ID do plano para o nome do plano (ex: 'basico', 'essencial')
    const planMap: Record<string, string> = {
      [process.env.MP_PLAN_BASICO!]: 'basico',
      [process.env.MP_PLAN_ESSENCIAL!]: 'essencial',
      [process.env.MP_PLAN_PRO!]: 'pro',
      [process.env.MP_PLAN_MASTER!]: 'master',
    };
    const plano = planMap[planId] || 'essencial';

    // Atualiza o tenant que possui esse subscription_id (ou pelo email)
    await supabase
      .from('tenants')
      .update({ plano, payment_status: 'active', updated_at: new Date().toISOString() })
      .eq('mp_subscription_id', subscriptionId);
  }
  return NextResponse.json({ received: true });
}