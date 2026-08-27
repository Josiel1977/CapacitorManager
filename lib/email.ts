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
  aceite_privacidade: boolean;
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
    const response = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        data_envio: new Date().toISOString(),
        origem_sistema: 'CapacitorManager'
      })
    });

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
    const response = await fetch('/api/contato', {
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
