import { NextResponse } from 'next/server';
import { createLeadRequest } from '@/lib/server/leads';

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') || 0) > 8_000) {
      return NextResponse.json({ error: 'Requisição muito grande.' }, { status: 413 });
    }
    const result = await createLeadRequest(request, await request.json());
    return NextResponse.json(result.ok ? { success: true } : { error: result.error }, { status: result.status });
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }
}
