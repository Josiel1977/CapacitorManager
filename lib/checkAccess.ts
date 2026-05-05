export async function checkUserAccess(userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, plan')
    .eq('id', userId)
    .single();
  return profile?.subscription_status === 'active';
}