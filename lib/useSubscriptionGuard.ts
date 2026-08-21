import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import Swal from 'sweetalert2';

export function useSubscriptionGuard(redirectTo: string = '/planos') {
  const { user, profile, isAuthenticated, isLoading, isProfileLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || isProfileLoading) return;

    if (!isAuthenticated || !user) {
      router.push('/login');
      return;
    }

    const checkAccess = async () => {
      if (!profile) {
        router.push('/login');
        return;
      }

      // ADMIN: acesso total, sem verificar assinatura
      if (profile.role === 'admin') {
        return; // permite acesso
      }

      // Para não‑admin, verifica se assinatura está ativa
      if (profile.subscription_status !== 'active') {
        await Swal.fire({
          title: 'Acesso bloqueado',
          text: 'Sua assinatura está inativa. Escolha um plano para continuar.',
          icon: 'warning',
          confirmButtonText: 'Ver planos',
          confirmButtonColor: '#0a2b3c',
        });
        router.push(redirectTo);
      }
    };

    checkAccess();
  }, [user, profile, isAuthenticated, isLoading, isProfileLoading, router, redirectTo]);
}
