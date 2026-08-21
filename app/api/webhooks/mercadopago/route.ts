import { processMercadoPagoWebhook } from '@/lib/mercadopago/webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return processMercadoPagoWebhook(request); }
