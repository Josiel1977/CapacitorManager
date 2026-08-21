import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  const checks = {
    app: 'ok' as 'ok' | 'error',
    database: 'error' as 'ok' | 'error',
    environment: (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) &&
      process.env.RATE_LIMIT_SALT &&
      process.env.MP_WEBHOOK_SECRET
    ) ? 'ok' as const : 'error' as const,
  };

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('profiles').select('id', { head: true, count: 'exact' }).limit(1);
    checks.database = error ? 'error' : 'ok';
  } catch {
    checks.database = 'error';
  }

  const healthy = checks.database === 'ok' && checks.environment === 'ok';
  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      checks,
      responseTimeMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  );
}
