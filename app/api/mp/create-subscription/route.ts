import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const { tenantId, plano, email, nome } = await request.json();

    // Logs para diagnóstico
    console.log('=== Diagnóstico MP ===');
    console.log('MP_ACCESS_TOKEN:', process.env.MP_ACCESS_TOKEN ? 'Definido' : 'INDEFINIDO');
    console.log('MERCADO_PAGO_ACCESS_TOKEN:', process.env.MERCADO_PAGO_ACCESS_TOKEN ? 'Definido' : 'INDEFINIDO');
    console.log('Todas as variáveis MP_*:', Object.keys(process.env).filter(k => k.includes('MP')));

    const planMap: Record<string, string | undefined> = {
      basico: process.env.MP_PLAN_BASICO,
      essencial: process.env.MP_PLAN_ESSENCIAL,
      pro: process.env.MP_PLAN_PRO,
      master: process.env.MP_PLAN_MASTER,
    };

    const preapprovalPlanId = planMap[plano];
    if (!preapprovalPlanId) {
      return NextResponse.json({ error: `Plano '${plano}' não encontrado` }, { status: 400 });
    }

    const accessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('Nenhum token encontrado nas variáveis de ambiente');
      return NextResponse.json({ error: 'MP access token não configurado' }, { status: 500 });
    }

    const response = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        preapproval_plan_id: preapprovalPlanId,
        reason: `CapacitorManager - ${nome} - Plano ${plano}`,
        external_reference: tenantId,
        payer_email: email,
        back_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/success`,
        status: 'pending',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Resposta de erro do MP:', data);
      throw new Error(data.message || 'Erro ao criar assinatura');
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