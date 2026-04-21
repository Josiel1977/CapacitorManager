// app/api/lead/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Aqui você pode:
    // 1. Salvar no Supabase
    // 2. Enviar para seu email
    // 3. Enviar para CRM (HubSpot, Pipedrive, RD Station)
    // 4. Enviar para webhook do n8n/Make/Zapier
    
    console.log('Lead recebido:', data);
    
    // Exemplo: Salvar no Supabase
    // const { error } = await supabase.from('leads').insert([data]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao processar lead:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
