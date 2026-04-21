// app/api/lead/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { EmailTemplate } from '@/components/email-template';

// Inicializa o cliente do Resend com a chave da API
const resend = new Resend(process.env.RESEND_API_KEY);

// Inicializa o cliente do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nome, email, telefone, empresa, plano_interesse, mensagem, origem } = body;

    // --- Validação ---
    if (!nome || !email) {
      return NextResponse.json(
        { error: 'Nome e e-mail são obrigatórios.' },
        { status: 400 }
      );
    }

    // --- 1. Salva o lead no Supabase ---
    const { data, error: supabaseError } = await supabase
      .from('leads')
      .insert([{ nome, email, telefone, empresa, plano_interesse, mensagem, origem: origem || 'Site' }])
      .select();

    if (supabaseError) {
      console.error('Erro ao inserir lead no Supabase:', supabaseError);
      // Não interrompe o fluxo, mas registra o erro
    }

    // --- 2. Envia o e-mail de notificação ---
    // O e-mail será enviado para o seu endereço de suporte
    const emailResponse = await resend.emails.send({
      from: 'CapacitorManager <onboarding@resend.dev>', // Use um domínio verificado futuramente
      to: ['suporte@jmeletroservice.com.br'], // E-mail que receberá a notificação
      subject: `Nova solicitação de demonstração - ${nome}`,
      react: EmailTemplate({ nome, email, telefone, empresa, plano_interesse, mensagem }),
    });

    if (emailResponse.error) {
      console.error('Erro ao enviar e-mail:', emailResponse.error);
      return NextResponse.json(
        { error: 'Solicitação recebida, mas houve uma falha no envio do e-mail de notificação.' },
        { status: 500 }
      );
    }

    console.log('E-mail enviado com sucesso! ID:', emailResponse.data?.id);

    // --- 3. Retorna uma resposta de sucesso ---
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
