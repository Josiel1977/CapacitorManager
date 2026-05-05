// app/api/mercadopago/create-subscription/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { planoId, tenantId } = await request.json();
    if (!tenantId) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });

    // Mapeia o ID interno do plano para o ID da assinatura no Mercado Pago
    const planMap: Record<string, string | undefined> = {
      basico: process.env.MP_PLAN_BASICO,
      essencial: process.env.MP_PLAN_ESSENCIAL,
      pro: process.env.MP_PLAN_PRO,
      master: process.env.MP_PLAN_MASTER,
    };

    const preapproval_plan_id = planMap[planoId];
    if (!preapproval_plan_id) return NextResponse.json({ error: 'Plano não encontrado' }, { status: 400 });

    // --- Requisição para a API do Mercado Pago ---
    const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        preapproval_plan_id,
        external_reference: tenantId,
        status: 'pending', // Impede que o MP exija um método de pagamento imediato
        back_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`, // URL de retorno
        reason: `Assinatura ${planoId.charAt(0).toUpperCase() + planoId.slice(1)}`,
      }),
    });

    const mpData = await mpResponse.json();
    if (!mpResponse.ok) throw new Error(mpData.message || 'Falha ao criar assinatura');

    return NextResponse.json({ init_point: mpData.init_point });
  } catch (error: any) {
    console.error('Erro na API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}