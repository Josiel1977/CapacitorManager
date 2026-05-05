import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import Swal from 'sweetalert2';

export function useSubscriptionGuard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user) {
      router.push('/login');
      return;
    }
    const check = async () => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('subscription_status, tenant_id')
        .eq('id', user.id)
        .single();
      if (error || !profile) {
        router.push('/login');
        return;
      }
      if (profile.subscription_status !== 'active') {
        await Swal.fire({
          title: 'Acesso bloqueado',
          text: 'Seu plano está inativo. Escolha um plano para continuar.',
          icon: 'warning',
          confirmButtonText: 'Ver planos'
        });
        router.push('/planos');
      }
    };
    check();
  }, [user, isAuthenticated, isLoading, router]);
}