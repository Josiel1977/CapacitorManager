export default function TermosProPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold text-primary mb-6">Termos de Uso – Plano Pro</h1>
      <div className="prose prose-sm">
        <h2>1. Limites do plano</h2>
        <p>Este plano concede direito de uso com os seguintes limites:</p>
        <ul>
          <li>5 clientes ativos;</li>
          <li>10 bancos de capacitores;</li>
          <li>50 capacitores cadastrados.</li>
        </ul>
        <h2>2. Valor e cobrança</h2>
        <p>Valor mensal de R$ 597,00 (quinhentos e noventa e sete reais), cobrado automaticamente via Mercado Pago.</p>
        <h2>3. Vigência e cancelamento</h2>
        <p>Renovação automática mensal. Cancelamento sem multa, sem reembolso do mês corrente.</p>
        <h2>4. Propriedade intelectual</h2>
        <p>O sistema CapacitorManager é protegido por direitos autorais.</p>
        <h2>5. Suporte</h2>
        <p>Suporte técnico por e‑mail em dias úteis, 9h às 18h.</p>
        <h2>6. Disposições gerais</h2>
        <p>Foro de Belém/PA.</p>
        <p className="text-sm text-slate-500 mt-4">Ao assinar, você aceita os termos.</p>
      </div>
    </div>
  );
}