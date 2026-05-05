'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

export default function SubscriptionSuccessPage() {
  const router = useRouter();
  useEffect(() => {
    Swal.fire({
      title: 'Assinatura confirmada!',
      text: 'Seu plano foi ativado. Redirecionando...',
      icon: 'success',
      timer: 3000,
      showConfirmButton: false,
    }).then(() => router.push('/dimensionar'));
  }, [router]);
  return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}