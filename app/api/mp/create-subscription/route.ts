import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient'; // cliente Supabase

export async function POST(request: Request) {
  try {
    const { tenantId, plano, email, nome } = await request.json();

    // Mapeia o plano para o valor em reais
    let valor = 0;
    if (plano === 'essencial') valor = 297;
    else if (plano === 'pro') valor = 597;
    else throw new Error('Plano inválido');

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) throw new Error('MP access token não configurado');

    // 1. Cria a assinatura no Mercado Pago
    const response = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reason: `CapacitorManager - Plano ${plano} - ${nome}`,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: valor,
          currency_id: 'BRL'
        },
        payer_email: email,
        back_url: 'https://seusite.com/dashboard', // após o pagamento, volta para cá
        status: 'pending'
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message);

    // 2. Salva o ID da assinatura no tenant
    await supabase
      .from('tenants')
      .update({ mp_subscription_id: data.id, payment_status: 'pending' })
      .eq('id', tenantId);

    // 3. Retorna o link de checkout (init_point)
    return NextResponse.json({ init_point: data.init_point });
  } catch (error: any) {
    console.error('Erro ao criar assinatura:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}