export default function TermosBasicoPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold text-primary mb-6">Termos do Plano Básico</h1>
      <div className="prose">
        <p>Este plano permite 1 cliente, 1 banco de capacitores e 6 capacitores.</p>
        <p>O valor mensal é de R$ 149,00, cobrado automaticamente via Mercado Pago.</p>
        <p>Demais condições se aplicam conforme contrato.</p>
      </div>
    </div>
  );
}