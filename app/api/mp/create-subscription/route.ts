// app/api/mercadopago/create-subscription/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { plano, tenantId, email, nome } = await req.json();
  const planMap = {
    basico: process.env.MP_PLAN_BASICO,
    essencial: process.env.MP_PLAN_ESSENCIAL,
    pro: process.env.MP_PLAN_PRO,
    master: process.env.MP_PLAN_MASTER,
  };
  const preapproval_plan_id = planMap[plano];
  if (!preapproval_plan_id) throw new Error('Plano inválido');

  const accessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN;
  const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      preapproval_plan_id,
      external_reference: tenantId,
      payer_email: email,
      reason: `CapacitorManager - ${nome} - ${plano}`,
      back_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/success`,
      status: 'pending',
    }),
  });
  const data = await mpRes.json();
  if (!mpRes.ok) throw new Error(data.message);

  // Salva o mp_subscription_id no tenant
  await supabase.from('tenants').update({ mp_subscription_id: data.id }).eq('id', tenantId);

  return NextResponse.json({ init_point: data.init_point });
}
