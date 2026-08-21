import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isPlanId, type PlanId, PLANS } from '@/lib/plans';
import { enforceRateLimit } from '@/lib/server/rate-limit';

const planMap: Record<PlanId, string | undefined> = {
  basico: process.env.MP_PLAN_BASICO,
  essencial: process.env.MP_PLAN_ESSENCIAL,
  pro: process.env.MP_PLAN_PRO,
  master: process.env.MP_PLAN_MASTER,
};

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const allowed = await enforceRateLimit({
      endpoint: 'create-subscription',
      request,
      userId: user.id,
      maxRequests: 5,
      windowSeconds: 3600,
    });
    if (!allowed) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde antes de iniciar outro checkout.' }, { status: 429 });
    }

    if (Number(request.headers.get('content-length') || 0) > 2_000) {
      return NextResponse.json({ error: 'Requisição inválida' }, { status: 413 });
    }
    const body = await request.json();
    if (!isPlanId(body?.plano)) return NextResponse.json({ error: 'Plano inválido' }, { status: 400 });
    const plano = body.plano as PlanId;
    const preapprovalPlanId = planMap[plano];
    if (!preapprovalPlanId) return NextResponse.json({ error: 'Plano indisponível para contratação' }, { status: 503 });

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id, email')
      .eq('id', user.id)
      .single();
    if (profileError || !profile?.tenant_id) {
      return NextResponse.json({ error: 'Perfil empresarial não encontrado' }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .select('id, name, email, payment_status, mp_subscription_id')
      .eq('id', profile.tenant_id)
      .single();
    if (tenantError || !tenant) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
    if (tenant.payment_status === 'active') {
      return NextResponse.json({ error: 'Já existe uma assinatura ativa. Contate o suporte para alterar o plano.' }, { status: 409 });
    }

    const accessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!accessToken || !appUrl) return NextResponse.json({ error: 'Cobrança temporariamente indisponível' }, { status: 503 });

    const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        preapproval_plan_id: preapprovalPlanId,
        external_reference: tenant.id,
        payer_email: tenant.email || profile.email || user.email,
        reason: `CapacitorManager — ${PLANS[plano].name}`,
        back_url: `${appUrl.replace(/\/$/, '')}/subscription/success`,
        notification_url: `${appUrl.replace(/\/$/, '')}/api/mp/webhook`,
        status: 'pending',
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await mpResponse.json();
    if (!mpResponse.ok || !data?.id || !data?.init_point) {
      console.error('[Mercado Pago] Falha ao criar assinatura:', mpResponse.status, data?.message);
      return NextResponse.json({ error: 'Não foi possível iniciar a assinatura' }, { status: 502 });
    }

    const { error: updateError } = await admin
      .from('tenants')
      .update({ mp_subscription_id: data.id, payment_status: 'pending', plano, updated_at: new Date().toISOString() })
      .eq('id', tenant.id);
    if (updateError) throw updateError;

    return NextResponse.json({ init_point: data.init_point });
  } catch (error) {
    console.error('[Assinatura] Falha inesperada:', error);
    return NextResponse.json({ error: 'Não foi possível iniciar a assinatura' }, { status: 500 });
  }
}
