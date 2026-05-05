// app/api/webhooks/mercadopago/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, data } = body;

  // Verifica se a notificação é sobre o primeiro pagamento de uma assinatura
  if (type === 'subscription_authorized_payment') {
    const subscriptionId = data.id;

    // Busca os detalhes completos da assinatura no Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${subscriptionId}`, {
      headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    const subscription = await mpResponse.json();

    // Obtém o tenantId que você enviou no passo 1
    const tenantId = subscription.external_reference;

    // Mapeia o plano a partir do payment_method_id (ajuste conforme sua lógica)
    let planName = 'free';
    if (subscription.plan_id === process.env.MP_PLAN_BASICO) planName = 'basico';
    else if (subscription.plan_id === process.env.MP_PLAN_ESSENCIAL) planName = 'essencial';
    else if (subscription.plan_id === process.env.MP_PLAN_PRO) planName = 'pro';
    else if (subscription.plan_id === process.env.MP_PLAN_MASTER) planName = 'master';

    if (tenantId && planName) {
      // Atualiza o plano do tenant no seu banco de dados
      await supabase.from('profiles').update({ plan: planName }).eq('tenant_id', tenantId);
      console.log(`Plano ${planName} ativado para o tenant ${tenantId}`);
    }
  }

  return NextResponse.json({ ok: true });
}import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  const body = await request.json();
  console.log('[Webhook] Recebido:', body.type);

  // --- Assinaturas recorrentes (seu caso) ---
  if (body.type === 'subscription_authorized_payment') {
    // Notificação do PRIMEIRO pagamento autorizado da assinatura
    const subscriptionId = body.data.id; // ID da assinatura (preapproval_id)
    const accessToken = process.env.MP_ACCESS_TOKEN;

    // Busca detalhes da assinatura
    const res = await fetch(`https://api.mercadopago.com/preapproval/${subscriptionId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const subscription = await res.json();

    // O external_reference foi enviado no checkout (via URL ou criação da assinatura)
    const tenantId = subscription.external_reference;
    const planId = subscription.plan_id; // ID do plano do Mercado Pago

    // Mapeia ID do plano para o nome interno
    const planMap: Record<string, string> = {
      [process.env.MP_PLAN_BASICO!]: 'basico',
      [process.env.MP_PLAN_ESSENCIAL!]: 'essencial',
      [process.env.MP_PLAN_PRO!]: 'pro',
      [process.env.MP_PLAN_MASTER!]: 'master',
    };
    const planoNome = planMap[planId] || 'essencial';

    if (tenantId) {
      // Atualiza o perfil do usuário (ou tenant) com o plano ativo
      await supabase
        .from('profiles')
        .update({ plan: planoNome, subscription_status: 'active' })
        .eq('tenant_id', tenantId);

      // Opcional: guardar subscription_id no tenant
      await supabase
        .from('tenants')
        .update({ mp_subscription_id: subscriptionId, plano: planoNome, payment_status: 'active' })
        .eq('id', tenantId);
    }
  }

  // --- Alternativa: evento de criação da assinatura (pode ocorrer antes do pagamento) ---
  if (body.type === 'subscription_created') {
    // Assinatura foi criada, mas ainda não paga. Você pode armazenar o subscription_id.
    const subscriptionId = body.data.id;
    // ... faça o que precisar
  }

  // --- Se quiser manter compatibilidade com pagamentos únicos antigos ---
  if (body.type === 'payment') {
    // ... seu código antigo, se ainda precisar
  }

  return NextResponse.json({ received: true });
}