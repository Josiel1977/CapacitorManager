import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { withTimeout } from '@/lib/with-timeout';

function safeRedirect(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') return '/dashboard-real';
  return value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard-real';
}

type LoginErrorCode = 'invalid' | 'unavailable' | 'configuration';

function wantsJson(request: NextRequest): boolean {
  return request.headers.get('accept')?.includes('application/json') ?? false;
}

function loginError(request: NextRequest, code: LoginErrorCode) {
  if (wantsJson(request)) {
    return NextResponse.json(
      { ok: false, error: code },
      { status: code === 'invalid' ? 401 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const url = new URL('/login', request.url);
  url.searchParams.set('error', code);
  const response = NextResponse.redirect(url, 303);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (!supabaseUrl || !supabaseAnonKey) {
      return loginError(request, 'configuration');
    }

    const formData = await request.formData();
    const emailValue = formData.get('email');
    const passwordValue = formData.get('password');
    const email = typeof emailValue === 'string' ? emailValue.trim().toLowerCase() : '';
    const password = typeof passwordValue === 'string' ? passwordValue : '';

    if (!email || !password) {
      return loginError(request, 'invalid');
    }

    const redirectTo = safeRedirect(formData.get('redirectTo'));
    const response = wantsJson(request)
      ? NextResponse.json({ ok: true, redirectTo })
      : NextResponse.redirect(new URL(redirectTo, request.url), 303);
    response.headers.set('Cache-Control', 'no-store');

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      12_000,
      'Tempo limite ao fazer login.',
    );
    if (error) return loginError(request, 'invalid');
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Auth login] Falha inesperada no fluxo de autenticação.', { message });
    return loginError(request, 'unavailable');
  }
}

export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/login', request.url), 303);
}
