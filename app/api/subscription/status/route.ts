import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();
  if (profileError || !profile?.tenant_id) {
    return NextResponse.json({ error: 'Perfil empresarial não encontrado' }, { status: 404 });
  }

  const { data: tenant, error: tenantError } = await getSupabaseAdmin()
    .from('tenants')
    .select('payment_status, plano')
    .eq('id', profile.tenant_id)
    .single();
  if (tenantError || !tenant) {
    return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
  }

  return NextResponse.json(
    {
      active: profile.role === 'admin' || tenant.payment_status === 'active',
      status: tenant.payment_status || 'pending',
      plan: tenant.plano || null,
    },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
  );
}
