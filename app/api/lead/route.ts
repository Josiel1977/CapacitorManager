// app/api/lead/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Inicializa o Resend com a chave da API
const resend = new Resend(process.env.RESEND_API_KEY);

// Inicializa o Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nome, email, telefone, empresa, plano_interesse, mensagem, origem } = body;

    // Validação
    if (!nome || !email) {
      return NextResponse.json(
        { error: 'Nome e e-mail são obrigatórios.' },
        { status: 400 }
      );
    }

    // 1. Salva o lead no Supabase
    const { data, error: supabaseError } = await supabase
      .from('leads')
      .insert([{ 
        nome, 
        email, 
        telefone, 
        empresa, 
        plano_interesse, 
        mensagem, 
        origem: origem || 'Site' 
      }])
      .select();

    if (supabaseError) {
      console.error('Erro ao inserir lead no Supabase:', supabaseError);
      // Continua mesmo com erro no Supabase para não bloquear o usuário
    }

    // 2. Envia e-mail de notificação via Resend
    try {
      const emailResponse = await resend.emails.send({
        from: 'CapacitorManager <onboarding@resend.dev>',
        to: ['suporte@jmeletroservice.com.br'],
        subject: `Nova solicitação de demonstração - ${nome}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #0a2b3c; padding: 20px; text-align: center; }
              .header h1 { color: #f39c12; margin: 0; }
              .content { padding: 20px; border: 1px solid #e2e8f0; border-top: none; }
              .field { margin-bottom: 15px; }
              .label { font-weight: bold; color: #0a2b3c; width: 120px; display: inline-block; }
              .footer { background: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #64748b; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>CapacitorManager</h1>
                <p style="color: #fff; margin: 0;">Nova Solicitação de Demonstração</p>
              </div>
              <div class="content">
                <div class="field"><span class="label">Nome:</span> ${nome}</div>
                <div class="field"><span class="label">E-mail:</span> ${email}</div>
                <div class="field"><span class="label">Telefone:</span> ${telefone || 'Não informado'}</div>
                <div class="field"><span class="label">Empresa:</span> ${empresa || 'Não informada'}</div>
                <div class="field"><span class="label">Plano de Interesse:</span> ${plano_interesse || 'Não informado'}</div>
                <div class="field"><span class="label">Mensagem:</span> ${mensagem || 'Nenhuma'}</div>
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
                <p style="font-size: 12px; color: #64748b; text-align: center;">
                  Esta mensagem foi enviada automaticamente pelo sistema CapacitorManager.
                </p>
              </div>
              <div class="footer">
                <p>CapacitorManager - Gestão Inteligente de Capacitores</p>
                <p>suporte@jmeletroservice.com.br</p>
              </div>
            </div>
          </body>
          </html>
        `
      });

      console.log('E-mail enviado com sucesso! ID:', emailResponse?.data?.id);
    } catch (emailError) {
      console.error('Erro ao enviar e-mail via Resend:', emailError);
      // Não falha a requisição se o e-mail falhar
    }

    return NextResponse.json(
      { message: 'Solicitação recebida com sucesso!', lead: data?.[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro inesperado:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    );
  }
}