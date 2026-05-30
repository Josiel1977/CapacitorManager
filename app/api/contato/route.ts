// app/api/contato/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    console.log('Contato recebido:', data);
    
    // Enviar email de notificação
    // await sendEmail({ ... });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao processar contato:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
