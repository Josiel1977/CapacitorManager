export default function PrivacidadePage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold text-primary mb-6">Política de Privacidade</h1>
      <div className="prose prose-sm max-w-none">
        <p className="text-sm text-slate-500 mb-6">Última atualização: 05 de maio de 2026</p>

        <h2>1. Introdução</h2>
        <p>A CapacitorManager respeita sua privacidade e está comprometida em proteger seus dados pessoais. Esta Política de Privacidade explica como coletamos, usamos, armazenamos e protegemos as informações dos usuários do sistema, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).</p>

        <h2>2. Dados Coletados</h2>
        <p>Coletamos os seguintes dados durante o uso do CapacitorManager:</p>
        <ul>
          <li><strong>Dados cadastrais</strong>: nome, e-mail, telefone, CPF/CNPJ, nome da empresa.</li>
          <li><strong>Dados de uso</strong>: medições de capacitores, bancos cadastrados, relatórios, histórico de ações.</li>
          <li><strong>Dados de pagamento</strong>: processados exclusivamente pelo Mercado Pago (não armazenamos dados de cartão de crédito).</li>
          <li><strong>Dados técnicos</strong>: endereço IP, tipo de navegador, páginas acessadas, data e hora.</li>
        </ul>

        <h2>3. Finalidade do Tratamento</h2>
        <p>Utilizamos seus dados para:</p>
        <ul>
          <li>Fornecer e gerenciar sua conta no CapacitorManager.</li>
          <li>Processar pagamentos e assinaturas (via Mercado Pago).</li>
          <li>Melhorar e personalizar sua experiência no sistema.</li>
          <li>Enviar comunicações técnicas, atualizações e ofertas (com opção de descadastro).</li>
          <li>Cumprir obrigações legais e fiscais.</li>
        </ul>

        <h2>4. Compartilhamento de Dados</h2>
        <p>Não vendemos seus dados. Compartilhamos apenas com parceiros essenciais à operação:</p>
        <ul>
          <li><strong>Mercado Pago</strong>: para processamento de pagamentos recorrentes.</li>
          <li><strong>Supabase</strong>: plataforma de banco de dados e autenticação.</li>
          <li><strong>Vercel</strong>: hospedagem da aplicação.</li>
          <li><strong>Autoridades legais</strong>: quando exigido por lei.</li>
        </ul>

        <h2>5. Armazenamento e Segurança</h2>
        <p>Seus dados são armazenados em servidores seguros no Brasil (Supabase). Utilizamos criptografia SSL/TLS, backups diários e controles de acesso rigorosos. Apesar disso, nenhum sistema é 100% inviolável – recomendamos o uso de senhas fortes e manter suas credenciais em sigilo.</p>

        <h2>6. Seus Direitos (LGPD)</h2>
        <p>Você tem direito a:</p>
        <ul>
          <li>Confirmar a existência de tratamento de seus dados.</li>
          <li>Acessar, corrigir ou solicitar a exclusão de seus dados.</li>
          <li>Revogar consentimentos anteriores (quando aplicável).</li>
          <li>Solicitar a portabilidade dos dados.</li>
        </ul>
        <p>Para exercer seus direitos, entre em contato pelo e-mail <strong>contato@capacitormanager.com.br</strong>.</p>

        <h2>7. Cookies</h2>
        <p>Utilizamos cookies de sessão para autenticação e preferências. Você pode desabilitar os cookies nas configurações do navegador, mas algumas funcionalidades podem ser afetadas.</p>

        <h2>8. Retenção de Dados</h2>
        <p>Mantemos seus dados enquanto sua conta estiver ativa. Após o cancelamento da assinatura ou exclusão da conta, seus dados serão completamente removidos em até 90 dias, exceto quando a lei exigir retenção por prazos maiores (ex: obrigações fiscais).</p>

        <h2>9. Crianças e Adolescentes</h2>
        <p>O CapacitorManager não se destina a menores de 18 anos. Não coletamos intencionalmente dados de crianças e adolescentes sem autorização dos responsáveis.</p>

        <h2>10. Alterações nesta Política</h2>
        <p>Podemos atualizar esta política periodicamente. Notificaremos os usuários por e-mail ou por meio do sistema sobre mudanças relevantes.</p>

        <h2>11. Contato</h2>
        <p>Em caso de dúvidas sobre esta Política de Privacidade, entre em contato:</p>
        <p><strong>CapacitorManager</strong><br />
        E-mail: contato@capacitormanager.com.br<br />
        WhatsApp: (91) 98485-5557</p>

        <p className="mt-8 text-xs text-slate-400">Ao utilizar o CapacitorManager, você concorda com os termos desta Política de Privacidade.</p>
      </div>
    </div>
  );
}