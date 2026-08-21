import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { withTimeout } from '@/lib/with-timeout';

function recoveryResult(request: NextRequest) {
  const url = new URL('/recuperar-senha', request.url);
  url.searchParams.set('sent', '1');
  const response = NextResponse.redirect(url, 303);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = typeof formData.get('email') === 'string'
    ? String(formData.get('email')).trim().toLowerCase()
    : '';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const appUrl = process.env.NODE_ENV === 'development'
    ? request.nextUrl.origin
    : process.env.NEXT_PUBLIC_APP_URL;

  if (email && supabaseUrl && supabaseAnonKey && appUrl) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    try {
      await withTimeout(
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${appUrl.replace(/\/$/, '')}/redefinir-senha`,
        }),
        12_000,
        'Tempo limite ao solicitar recuperação.',
      );
    } catch {
      // A resposta permanece genérica para não revelar contas cadastradas.
    }
  }

  return recoveryResult(request);
}

export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/recuperar-senha', request.url), 303);
}
