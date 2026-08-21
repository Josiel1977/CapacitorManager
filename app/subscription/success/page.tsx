'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

export default function SubscriptionSuccessPage() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    const waitForConfirmation = async () => {
      for (let attempt = 0; attempt < 6 && !cancelled; attempt += 1) {
        try {
          const response = await fetch('/api/subscription/status', { cache: 'no-store' });
          const result = await response.json();
          if (response.ok && result.active) {
            await Swal.fire({
              title: 'Assinatura confirmada!',
              text: 'O pagamento foi validado e seu plano está ativo.',
              icon: 'success',
              confirmButtonText: 'Continuar',
            });
            if (!cancelled) router.replace('/dimensionar');
            return;
          }
        } catch {
          // Uma falha transitória não deve transformar retorno do checkout em aprovação.
        }
        await new Promise(resolve => setTimeout(resolve, 2500));
      }

      if (!cancelled) {
        await Swal.fire({
          title: 'Pagamento em confirmação',
          text: 'O Mercado Pago ainda não confirmou a ativação. Você pode acompanhar o status na página de planos.',
          icon: 'info',
          confirmButtonText: 'Ver planos',
        });
        router.replace('/planos');
      }
    };

    waitForConfirmation();
    return () => { cancelled = true; };
  }, [router]);
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-4" aria-live="polite">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      <p className="text-sm text-slate-600">Confirmando o pagamento com segurança…</p>
    </div>
  );
}
