// components/email-template.tsx
import * as React from 'react';

interface EmailTemplateProps {
  nome: string;
  email: string;
  telefone: string;
  empresa: string;
  plano_interesse: string;
  mensagem: string;
}

export const EmailTemplate: React.FC<Readonly<EmailTemplateProps>> = ({
  nome,
  email,
  telefone,
  empresa,
  plano_interesse,
  mensagem,
}) => (
  <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
    <div style={{ backgroundColor: '#0a2b3c', padding: '20px', textAlign: 'center' }}>
      <h1 style={{ color: '#f39c12', margin: 0 }}>CapacitorManager</h1>
      <p style={{ color: '#ffffff', margin: 0 }}>Nova Solicitação de Demonstração</p>
    </div>
    <div style={{ padding: '20px', border: '1px solid #e2e8f0', borderTop: 'none' }}>
      <h2 style={{ color: '#0a2b3c', marginTop: 0 }}>Dados do Lead</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr><td style={{ padding: '8px 0', fontWeight: 'bold', width: '120px' }}>Nome:</td><td>{nome}</td></tr>
          <tr><td style={{ padding: '8px 0', fontWeight: 'bold' }}>E-mail:</td><td>{email}</td></tr>
          <tr><td style={{ padding: '8px 0', fontWeight: 'bold' }}>Telefone:</td><td>{telefone || 'Não informado'}</td></tr>
          <tr><td style={{ padding: '8px 0', fontWeight: 'bold' }}>Empresa:</td><td>{empresa || 'Não informada'}</td></tr>
          <tr><td style={{ padding: '8px 0', fontWeight: 'bold' }}>Plano de Interesse:</td><td>{plano_interesse}</td></tr>
          {mensagem && <tr><td style={{ padding: '8px 0', fontWeight: 'bold' }}>Mensagem:</td><td>{mensagem}</td></tr>}
        </tbody>
      </table>
      <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />
      <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
        Esta mensagem foi enviada automaticamente pelo sistema CapacitorManager.
      </p>
    </div>
  </div>
);
