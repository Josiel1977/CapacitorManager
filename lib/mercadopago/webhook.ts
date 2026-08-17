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
  const token = process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) throw new Error('Token do Mercado Pago não configurado.');
  return token;
}

function getPlanName(planId: string | undefined): PlanName | null {
  if (!planId) return null;
  const plans: Array<[string | undefined, PlanName]> = [
    [process.env.MP_PLAN_BASICO, 'basico'],
    [process.env.MP_PLAN_ESSENCIAL, 'essencial'],
    [process.env.MP_PLAN_PRO, 'pro'],
    [process.env.MP_PLAN_MASTER, 'master'],
  ];
  return plans.find(([configuredId]) => configuredId === planId)?.[1] || null;
}

export function verifyMercadoPagoSignature(request: Request, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[Mercado Pago] MP_WEBHOOK_SECRET ainda não configurado; validação de assinatura pendente.');
    return true;
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

  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
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

async function registerEvent(eventKey: string, payload: WebhookPayload): Promise<'new' | 'duplicate' | 'unavailable'> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('payment_webhook_events').insert({
    provider: 'mercadopago',
    event_key: eventKey,
    event_type: payload.type || payload.action || 'unknown',
    payload,
  });

  if (!error) return 'new';
  if (error.code === '23505') return 'duplicate';
  // Compatibilidade durante a implantação, antes da migração da tabela.
  if (error.code === '42P01' || error.code === 'PGRST205') {
    console.warn('[Mercado Pago] Tabela de idempotência ainda não criada.');
    return 'unavailable';
  }
  throw error;
}

export async function processMercadoPagoWebhook(request: Request): Promise<Response> {
  try {
    const payload = await request.json() as WebhookPayload;
    const dataId = String(payload.data?.id || '');

    if (!payload.type || !dataId) {
      return Response.json({ error: 'Evento inválido' }, { status: 400 });
    }
    if (!verifyMercadoPagoSignature(request, dataId)) {
      return Response.json({ error: 'Assinatura inválida' }, { status: 401 });
    }

    const eventKey = `${payload.type}:${payload.action || 'event'}:${dataId}:${payload.id || ''}`;
    const registration = await registerEvent(eventKey, payload);
    if (registration === 'duplicate') {
      return Response.json({ received: true, duplicate: true });
    }

    const supabase = getSupabaseAdmin();

    if (payload.type === 'subscription_authorized_payment') {
      const subscription = await mercadoPagoGet(`/preapproval/${dataId}`);
      const tenantId = subscription.external_reference as string | undefined;
      const plan = getPlanName(subscription.plan_id);

      if (!tenantId || !plan) throw new Error('Assinatura sem tenant ou plano reconhecido.');

      const { error: tenantError } = await supabase
        .from('tenants')
        .update({
          plano: plan,
          payment_status: 'active',
          mp_subscription_id: subscription.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId);
      if (tenantError) throw tenantError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ plan, subscription_status: 'active' })
        .eq('tenant_id', tenantId);
      if (profileError) throw profileError;
    } else if (payload.type === 'payment') {
      const payment = await mercadoPagoGet(`/v1/payments/${dataId}`);
      const subscriptionId = payment.preapproval_id as string | undefined;
      if (subscriptionId) {
        const status = payment.status === 'approved' ? 'active' : payment.status === 'rejected' ? 'past_due' : null;
        if (status) {
          const update: Record<string, string> = { payment_status: status, updated_at: new Date().toISOString() };
          const plan = getPlanName(payment.preapproval_plan_id);
          if (plan) update.plano = plan;
          const { error } = await supabase.from('tenants').update(update).eq('mp_subscription_id', subscriptionId);
          if (error) throw error;
        }
      }
    } else if (payload.type === 'subscription_payment_failed' || payload.type === 'subscription_cancelled') {
      const { error } = await supabase
        .from('tenants')
        .update({ payment_status: 'past_due', updated_at: new Date().toISOString() })
        .eq('mp_subscription_id', dataId);
      if (error) throw error;
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('[Mercado Pago] Falha ao processar webhook:', error);
    return Response.json({ error: 'Falha ao processar notificação' }, { status: 500 });
  }
}
