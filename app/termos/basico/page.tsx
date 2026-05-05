export default function TermosBasicoPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold text-primary mb-6">Termos de Uso – Plano Básico</h1>
      <div className="prose prose-sm">
        <h2>1. Limites do plano</h2>
        <p>Este plano concede direito de uso do sistema CapacitorManager com os seguintes limites:</p>
        <ul>
          <li>1 cliente ativo;</li>
          <li>1 banco de capacitores;</li>
          <li>6 capacitores cadastrados.</li>
        </ul>
        <h2>2. Valor e cobrança</h2>
        <p>O valor mensal é de R$ 149,00 (cento e quarenta e nove reais), cobrado automaticamente via Mercado Pago por meio de assinatura recorrente.</p>
        <h2>3. Vigência e cancelamento</h2>
        <p>O plano é válido por 30 dias, renovável automaticamente. O cancelamento pode ser feito a qualquer momento pelo painel de controle, sem direito a reembolso do mês corrente.</p>
        <h2>4. Propriedade intelectual</h2>
        <p>O sistema CapacitorManager é protegido por direitos autorais. O cliente não pode reproduzir, distribuir ou engenhar reversamente o software.</p>
        <h2>5. Suporte</h2>
        <p>O suporte técnico é fornecido por e-mail em dias úteis, das 9h às 18h.</p>
        <h2>6. Disposições gerais</h2>
        <p>Este contrato é regido pelas leis brasileiras. Fica eleito o foro de Belém/PA para dirimir quaisquer controvérsias.</p>
        <p className="text-sm text-slate-500 mt-4">Ao efetuar a assinatura, o cliente declara ter lido e aceito todos os termos.</p>
      </div>
    </div>
  );
}