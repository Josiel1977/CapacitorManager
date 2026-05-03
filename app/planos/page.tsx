'use client';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';

const planos = [
  { id: 'basico', nome: 'Básico', preco: 149, url: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=47ea8c45383d442aa29c78eb9a44d621' },
  { id: 'essencial', nome: 'Essencial', preco: 297, url: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=b784ac180ef24399b2d822031f751c25' },
  { id: 'pro', nome: 'Pro', preco: 597, url: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=56ebc8d07448417eb434e90d94b20820' },
  { id: 'master', nome: 'Master', preco: 797, url: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=40770917d39545329960264af15edb12' },
];

export default function PlanosPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const assinar = (url: string) => {
    if (!isAuthenticated) return router.push('/login');
    window.location.href = url;
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold text-primary text-center">Escolha seu plano</h1>
      <div className="grid md:grid-cols-4 gap-6 mt-8">
        {planos.map(p => (
          <div key={p.id} className="border rounded-xl p-6 shadow text-center">
            <h2 className="text-xl font-bold">{p.nome}</h2>
            <p className="text-3xl font-bold mt-2">R$ {p.preco}<span className="text-base">/mês</span></p>
            <button onClick={() => assinar(p.url)} className="mt-6 w-full bg-primary text-white py-2 rounded-lg hover:bg-primary/90">Assinar</button>
          </div>
        ))}
      </div>
    </div>
  );
}