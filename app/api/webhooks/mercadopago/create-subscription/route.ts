import { POST as createSubscription } from '@/app/api/mp/create-subscription/route';

export const runtime = 'nodejs';
export async function POST(request: Request) { return createSubscription(request); }
