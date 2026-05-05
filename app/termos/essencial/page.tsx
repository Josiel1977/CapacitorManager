// app/termos/essencial/page.tsx
export default function TermosEssencialPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold text-primary mb-6">Termos do Plano Essencial</h1>
      <div className="prose">
        <p>Este plano permite até 5 clientes, 10 bancos e 50 capacitores.</p>
        <p>O valor mensal é de R$ 297,00, cobrado automaticamente via Mercado Pago.</p>
        {/* insira o contrato completo ou resumo */}
      </div>
    </div>
  );
}