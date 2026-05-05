import { supabase } from './supabaseClient';

export async function checkTenantAccess(tenantId: string): Promise<{ allowed: boolean; plan?: string; reason?: string }> {
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('payment_status, plano')
    .eq('id', tenantId)
    .single();

  if (error || !tenant) return { allowed: false, reason: 'Tenant não encontrado' };
  if (tenant.payment_status !== 'active') return { allowed: false, reason: 'Assinatura inativa' };
  return { allowed: true, plan: tenant.plano };
}