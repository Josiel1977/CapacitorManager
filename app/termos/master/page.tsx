// app/termos/master/page.tsx
export default function TermosMasterPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold text-primary mb-6">Termos do Plano Master</h1>
      <div className="prose">
        <p>Este plano permite até 50 clientes, 100 bancos e 600apacitores.</p>
        <p>O valor mensal é de R$ 797,00, cobrado automaticamente via Mercado Pago.</p>
        {/* insira o contrato completo ou resumo */}
      </div>
    </div>
  );
}