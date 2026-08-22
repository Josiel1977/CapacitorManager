import { createHmac, timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

type WebhookPayload = {
  id?: number | string;
  type?: string;
  action?: string;
  data?: { id?: number | string };
};

type PlanName = 'basico' | 'essencial' | 'pro' | 'master';

function getAccessToken(): string {
  const token = (process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN)?.trim();
  if (!token) throw new Error('Token do Mercado Pago não configurado.');
  return token;
}

function getPlanName(planId: string | undefined): PlanName | null {
  if (!planId) return null;
  const plans: Array<[string | undefined, PlanName]> = [
    [process.env.MP_PLAN_BASICO?.trim(), 'basico'],
    [process.env.MP_PLAN_ESSENCIAL?.trim(), 'essencial'],
    [process.env.MP_PLAN_PRO?.trim(), 'pro'],
    [process.env.MP_PLAN_MASTER?.trim(), 'master'],
  ];
  return plans.find(([configuredId]) => configuredId === planId)?.[1] || null;
}

export function verifyMercadoPagoSignature(request: Request, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error('[Mercado Pago] MP_WEBHOOK_SECRET não configurado.');
    return false;
  }

  const signature = request.headers.get('x-signature');
  const requestId = request.headers.get('x-request-id');
  if (!signature || !requestId || !dataId) return false;

  const parts = Object.fromEntries(
    signature.split(',').map(part => {
      const [key, value] = part.trim().split('=');
      return [key, value];
    })
  );
  if (!parts.ts || !parts.v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  const receivedBuffer = Buffer.from(parts.v1, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

async function mercadoPagoGet(path: string) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || `Mercado Pago respondeu ${response.status}`);
  return body;
}

async function registerEvent(eventKey: string, payload: WebhookPayload): Promise<'process' | 'duplicate'> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('payment_webhook_events').insert({
    provider: 'mercadopago',
    event_key: eventKey,
    event_type: payload.type || payload.action || 'unknown',
    payload,
    status: 'processing',
    attempt_count: 1,
    updated_at: new Date().toISOString(),
  });

  if (!error) return 'process';
  if (error.code === '23505') {
    const { data: existing, error: readError } = await supabase
      .from('payment_webhook_events')
      .select('status, attempt_count')
      .eq('event_key', eventKey)
      .single();
    if (readError) throw readError;
    if (existing.status !== 'failed') return 'duplicate';
    const { data: claimed, error: retryError } = await supabase
      .from('payment_webhook_events')
      .update({
        status: 'processing',
        attempt_count: (existing.attempt_count || 1) + 1,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('event_key', eventKey)
      .eq('status', 'failed')
      .select('id')
      .maybeSingle();
    if (retryError) throw retryError;
    if (!claimed) return 'duplicate';
    return 'process';
  }
  throw error;
}

async function finishEvent(eventKey: string, status: 'processed' | 'failed', error?: unknown) {
  const message = error instanceof Error ? error.message.slice(0, 500) : error ? 'Erro não identificado' : null;
  const { error: updateError } = await getSupabaseAdmin()
    .from('payment_webhook_events')
    .update({
      status,
      processed_at: status === 'processed' ? new Date().toISOString() : null,
      last_error: message,
      updated_at: new Date().toISOString(),
    })
    .eq('event_key', eventKey);
  if (updateError) console.error('[Mercado Pago] Não foi possível finalizar registro do evento:', updateError);
}

async function updateSubscriptionState(subscription: Record<string, unknown>, paymentStatus: string) {
  const subscriptionId = typeof subscription.id === 'string' ? subscription.id : '';
  const tenantId = typeof subscription.external_reference === 'string' ? subscription.external_reference : '';
  const configuredPlanId = typeof subscription.preapproval_plan_id === 'string'
    ? subscription.preapproval_plan_id
    : typeof subscription.plan_id === 'string' ? subscription.plan_id : undefined;
  const plan = getPlanName(configuredPlanId);
  if (!subscriptionId || !tenantId || !plan) throw new Error('Assinatura sem empresa ou plano reconhecido.');

  const supabase = getSupabaseAdmin();
  const { data: updatedTenant, error: tenantError } = await supabase
    .from('tenants')
    .update({ plano: plan, payment_status: paymentStatus, mp_subscription_id: subscriptionId, updated_at: new Date().toISOString() })
    .eq('id', tenantId)
    .eq('mp_subscription_id', subscriptionId)
    .select('id')
    .maybeSingle();
  if (tenantError) throw tenantError;
  if (!updatedTenant) throw new Error('Assinatura não corresponde à empresa registrada.');

  const profileStatus = paymentStatus === 'active' ? 'active' : paymentStatus === 'pending' ? 'inactive' : paymentStatus;
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ plan, subscription_status: profileStatus })
    .eq('tenant_id', tenantId);
  if (profileError) throw profileError;
}

export async function processMercadoPagoWebhook(request: Request): Promise<Response> {
  let eventKey: string | null = null;
  try {
    const payload = await request.json() as WebhookPayload;
    const bodyDataId = String(payload.data?.id || '');
    const signedDataId = new URL(request.url).searchParams.get('data.id') || '';

    if (!payload.type || !bodyDataId || !signedDataId || bodyDataId.toLowerCase() !== signedDataId.toLowerCase()) {
      return Response.json({ error: 'Evento inválido' }, { status: 400 });
    }
    if (!verifyMercadoPagoSignature(request, signedDataId)) {
      return Response.json({ error: 'Assinatura inválida' }, { status: 401 });
    }

    const dataId = bodyDataId;
    eventKey = `${payload.type}:${payload.action || 'event'}:${dataId}:${payload.id || ''}`;
    const registration = await registerEvent(eventKey, payload);
    if (registration === 'duplicate') {
      return Response.json({ received: true, duplicate: true });
    }

    if (payload.type === 'subscription_authorized_payment') {
      const invoice = await mercadoPagoGet(`/authorized_payments/${dataId}`);
      const subscriptionId = typeof invoice.preapproval_id === 'string' ? invoice.preapproval_id : '';
      if (!subscriptionId) throw new Error('Cobrança sem assinatura vinculada.');
      const subscription = await mercadoPagoGet(`/preapproval/${subscriptionId}`);
      const paymentStatus = invoice.payment?.status === 'approved'
        ? 'active'
        : invoice.payment?.status === 'rejected' ? 'past_due' : 'pending';
      await updateSubscriptionState(subscription, paymentStatus);
    } else if (payload.type === 'subscription_preapproval') {
      const subscription = await mercadoPagoGet(`/preapproval/${dataId}`);
      const subscriptionStatus = subscription.status === 'cancelled' || subscription.status === 'paused'
        ? 'cancelled'
        : 'pending';
      await updateSubscriptionState(subscription, subscriptionStatus);
    } else if (payload.type === 'payment') {
      const payment = await mercadoPagoGet(`/v1/payments/${dataId}`);
      const subscriptionId = payment.preapproval_id as string | undefined;
      if (subscriptionId) {
        const subscription = await mercadoPagoGet(`/preapproval/${subscriptionId}`);
        const status = payment.status === 'approved' ? 'active' : payment.status === 'rejected' ? 'past_due' : 'pending';
        await updateSubscriptionState(subscription, status);
      }
    } else if (payload.type === 'subscription_payment_failed' || payload.type === 'subscription_cancelled') {
      const { error } = await getSupabaseAdmin()
        .from('tenants')
        .update({ payment_status: 'past_due', updated_at: new Date().toISOString() })
        .eq('mp_subscription_id', dataId);
      if (error) throw error;
    }

    await finishEvent(eventKey, 'processed');
    return Response.json({ received: true });
  } catch (error) {
    if (eventKey) await finishEvent(eventKey, 'failed', error);
    console.error('[Mercado Pago] Falha ao processar webhook:', error);
    return Response.json({ error: 'Falha ao processar notificação' }, { status: 500 });
  }
}
