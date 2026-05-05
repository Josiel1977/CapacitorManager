import { supabase } from '@/lib/supabaseClient';

export async function checkUserAccess(userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, plan')
    .eq('id', userId)
    .single();

  return {
    subscriptionActive: profile?.subscription_status === 'active',
    plan: profile?.plan || 'demo',
  };
}