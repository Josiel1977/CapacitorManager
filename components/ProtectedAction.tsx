'use client';

import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

interface ProtectedActionProps {
  children: React.ReactNode;
  action: () => void | Promise<void>;
  className?: string;
}

export default function ProtectedAction({ children, action, className }: ProtectedActionProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const handleClick = async () => {
    if (!isAuthenticated) {
      const result = await Swal.fire({
        title: 'Acesso Restrito',
        text: 'Você precisa estar logado para realizar essa ação.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Fazer Login',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0a2b3c',
      });
      if (result.isConfirmed) {
        router.push('/login');
      }
      return;
    }
    await action();
  };

  return (
    <button onClick={handleClick} className={className}>
      {children}
    </button>
  );
}