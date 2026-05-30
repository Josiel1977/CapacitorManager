// lib/email.ts

interface LeadData {
  nome: string;
  email: string;
  telefone?: string;
  empresa?: string;
  cargo?: string;
  mensagem?: string;
  plano_interesse?: string;
  origem?: string;
}

interface ContatoData extends LeadData {
  assunto?: string;
}

/**
 * Envia lead para o webhook/serviço de email
 * Pode ser integrado com: Resend, SendGrid, AWS SES, ou Webhook do n8n/Make/Zapier
 */
export async function sendLead(data: LeadData): Promise<boolean> {
  try {
    // Opção 1: Enviar para um webhook (n8n, Make, Zapier)
    const webhookUrl = process.env.NEXT_PUBLIC_WEBHOOK_LEAD_URL || '/api/lead';
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        data_envio: new Date().toISOString(),
        origem_sistema: 'CapacitorManager'
      })
    });

    // Opção 2: Enviar para um serviço de email (Resend)
    if (process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'CapacitorManager <contato@capacitormanager.com>',
          to: ['vendas@capacitormanager.com', data.email],
          subject: `Novo lead: ${data.nome}`,
          html: `
            <h2>Novo Lead Capturado</h2>
            <p><strong>Nome:</strong> ${data.nome}</p>
            <p><strong>Email:</strong> ${data.email}</p>
            <p><strong>Telefone:</strong> ${data.telefone || 'N/A'}</p>
            <p><strong>Empresa:</strong> ${data.empresa || 'N/A'}</p>
            <p><strong>Plano Interesse:</strong> ${data.plano_interesse || 'N/A'}</p>
            <p><strong>Origem:</strong> ${data.origem || 'Site'}</p>
            <hr>
            <p><strong>Mensagem:</strong></p>
            <p>${data.mensagem || 'Nenhuma mensagem'}</p>
          `
        })
      });
    }

    return response.ok;
  } catch (error) {
    console.error('Erro ao enviar lead:', error);
    return false;
  }
}

/**
 * Envia email de contato
 */
export async function sendContato(data: ContatoData): Promise<boolean> {
  try {
    const webhookUrl = process.env.NEXT_PUBLIC_WEBHOOK_CONTATO_URL || '/api/contato';
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        data_envio: new Date().toISOString(),
        tipo: 'contato'
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Erro ao enviar contato:', error);
    return false;
  }
}

/**
 * Envia newsletter para leads
 */
export async function sendNewsletter(emails: string[], assunto: string, conteudo: string): Promise<boolean> {
  try {
    // Implementar com serviço de email marketing
    // Ex: Mailchimp, Brevo (Sendinblue), HubSpot
    return true;
  } catch (error) {
    console.error('Erro ao enviar newsletter:', error);
    return false;
  }
}

/**
 * Formata dados para CSV
 */
export function exportLeadsToCSV(leads: LeadData[]): string {
  const headers = ['Nome', 'Email', 'Telefone', 'Empresa', 'Data', 'Origem'];
  const rows = leads.map(lead => [
    lead.nome,
    lead.email,
    lead.telefone || '',
    lead.empresa || '',
    new Date().toLocaleDateString('pt-BR'),
    lead.origem || 'Site'
  ]);
  
  const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
  return csvContent;
}
