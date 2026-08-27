import { NextResponse } from 'next/server';
import 'pdf-parse/worker';
import { PDFParse } from 'pdf-parse';
import { parseEquatorialInvoiceText } from '@/lib/equatorial-invoice-parser';
import { buildInvoiceAuditResult } from '@/lib/invoice-audit-result';
import { enforceRateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  let parser: PDFParse | undefined;
  try {
    // Pré-visualizações não devem consumir a cota pública de Produção. O
    // limite continua idêntico e persistente em cada ambiente.
    const rateLimitEndpoint = process.env.VERCEL_ENV === 'preview'
      ? 'invoice-audit-preview'
      : 'invoice-audit';
    const allowed = await enforceRateLimit({ endpoint: rateLimitEndpoint, request, maxRequests: 5, windowSeconds: 3600 });
    if (!allowed) return NextResponse.json({ error: 'Limite temporário atingido. Aguarde antes de enviar outra fatura.' }, { status: 429 });

    const formData = await request.formData();
    const file = formData.get('fatura');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Selecione uma fatura em PDF.' }, { status: 400 });
    if (file.size === 0 || file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'O PDF deve ter até 8 MB.' }, { status: 413 });
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Formato não suportado. Envie um PDF.' }, { status: 415 });
    }

    parser = new PDFParse({ data: Buffer.from(await file.arrayBuffer()) });
    const extracted = await parser.getText();
    const parsed = parseEquatorialInvoiceText(extracted.text, file.name);
    const hasUsefulData = parsed.total_pagar > 0 || parsed.consumo_ponta_kwh > 0 || parsed.consumo_fora_ponta_kwh > 0 || (parsed.penalidade_reativa_informada ?? 0) > 0;
    if (!hasUsefulData) {
      return NextResponse.json({ error: 'Não foi possível identificar os campos da fatura. Confirme se o PDF contém texto e é do modelo Equatorial Pará suportado.' }, { status: 422 });
    }

    const result = buildInvoiceAuditResult(parsed);
    return NextResponse.json({ success: true, data: result, status: 'sucesso', dados: result });
  } catch (error) {
    console.warn('[Auditoria] Falha ao processar PDF:', error);
    const detail = process.env.NODE_ENV === 'development' && error instanceof Error ? ` ${error.message}` : '';
    return NextResponse.json({ error: `Não foi possível processar esta fatura.${detail}` }, { status: 500 });
  } finally {
    if (parser) await parser.destroy().catch(() => undefined);
  }
}
