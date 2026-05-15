import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const planMap = {
  basico: process.env.MP_PLAN_BASICO,
  essencial: process.env.MP_PLAN_ESSENCIAL,
  pro: process.env.MP_PLAN_PRO,
  master: process.env.MP_PLAN_MASTER,
} as const;

type PlanoKey = keyof typeof planMap;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { plano, tenantId, email, nome } = body;

    // Validação explícita do plano
    if (!plano || typeof plano !== 'string' || !['basico', 'essencial', 'pro', 'master'].includes(plano)) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 });
    }

    const preapproval_plan_id = planMap[plano as PlanoKey];
    if (!preapproval_plan_id) {
      return NextResponse.json({ error: 'ID do plano não configurado' }, { status: 500 });
    }

    const accessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: 'Token do Mercado Pago não configurado' }, { status: 500 });
    }

    const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        preapproval_plan_id,
        external_reference: tenantId,
        payer_email: email,
        reason: `CapacitorManager - ${nome} - Plano ${plano}`,
        back_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/success`,
        status: 'pending',
      }),
    });

    const data = await mpResponse.json();
    if (!mpResponse.ok) {
      console.error('Erro MP:', data);
      throw new Error(data.message || 'Falha ao criar assinatura');
    }

    await supabase
      .from('tenants')
      .update({ mp_subscription_id: data.id, payment_status: 'pending', plano })
      .eq('id', tenantId);

    return NextResponse.json({ init_point: data.init_point });
  } catch (error: any) {
    console.error('Erro no endpoint:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
