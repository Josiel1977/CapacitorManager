import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const configured = (value: string | undefined, minimumLength = 1) =>
  Boolean(value?.trim() && value.trim().length >= minimumLength);

export async function GET() {
  const startedAt = Date.now();
  const configuration = {
    authentication: configured(process.env.NEXT_PUBLIC_SUPABASE_URL)
      && configured(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    privilegedDatabase: configured(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
    abuseProtection: configured(process.env.RATE_LIMIT_SALT, 32),
    payments: configured(process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN)
      && configured(process.env.MP_WEBHOOK_SECRET)
      && configured(process.env.MP_PLAN_BASICO)
      && configured(process.env.MP_PLAN_ESSENCIAL)
      && configured(process.env.MP_PLAN_PRO)
      && configured(process.env.MP_PLAN_MASTER),
  };
  const environmentReady = Object.values(configuration).every(Boolean);
  const checks = {
    app: 'ok' as 'ok' | 'error',
    database: 'error' as 'ok' | 'error',
    environment: environmentReady ? 'ok' as const : 'error' as const,
  };

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('profiles').select('id', { head: true, count: 'exact' }).limit(1);
    checks.database = error ? 'error' : 'ok';
  } catch {
    checks.database = 'error';
  }

  const healthy = checks.database === 'ok' && checks.environment === 'ok';
  const exposeConfiguration = process.env.VERCEL_ENV !== 'production';
  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      checks,
      ...(exposeConfiguration ? {
        configuration: Object.fromEntries(
          Object.entries(configuration).map(([key, ready]) => [key, ready ? 'ok' : 'error']),
        ),
      } : {}),
      responseTimeMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  );
}
