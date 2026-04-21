// app/api/lead/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializa o cliente Supabase no servidor
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

    // Insere no Supabase
    const { data, error } = await supabase
      .from('leads')
      .insert([{ nome, email, telefone, empresa, plano_interesse, mensagem, origem: origem || 'Site' }])
      .select();

    if (error) {
      console.error('Erro ao inserir lead:', error);
      return NextResponse.json(
        { error: 'Erro ao registrar solicitação.' },
        { status: 500 }
      );
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
