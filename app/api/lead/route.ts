import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nome, email, telefone, empresa, plano_interesse, mensagem, origem } = body;

    if (!nome || !email) return NextResponse.json({ error: 'Nome e e-mail são obrigatórios.' }, { status: 400 });

    const { data, error: supabaseError } = await supabase.from('leads').insert([{ nome, email, telefone, empresa, plano_interesse, mensagem, origem: origem || 'Site' }]).select();
    if (supabaseError) console.error('Erro ao inserir lead:', supabaseError);

    const emailHtml = `<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;}.header{background:#0a2b3c;padding:20px;text-align:center;}.header h1{color:#f39c12;}</style></head><body><div class="header"><h1>CapacitorManager</h1><p>Nova Solicitação de Demonstração</p></div><div><p><strong>Nome:</strong> ${nome}</p><p><strong>E-mail:</strong> ${email}</p><p><strong>Telefone:</strong> ${telefone || 'N/A'}</p><p><strong>Empresa:</strong> ${empresa || 'N/A'}</p><p><strong>Plano:</strong> ${plano_interesse}</p><p><strong>Mensagem:</strong> ${mensagem || 'N/A'}</p></div></body></html>`;

    await resend.emails.send({ from: 'CapacitorManager <onboarding@resend.dev>', to: ['suporte@jmeletroservice.com.br'], subject: `Nova solicitação - ${nome}`, html: emailHtml });

    return NextResponse.json({ message: 'Solicitação recebida com sucesso!', lead: data?.[0] }, { status: 201 });
  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}