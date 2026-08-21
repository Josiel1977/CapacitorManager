import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { withTimeout } from '@/lib/with-timeout';

function safeRedirect(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') return '/dashboard-real';
  return value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard-real';
}

function loginError(request: NextRequest, code: 'invalid' | 'unavailable' | 'configuration') {
  const url = new URL('/login', request.url);
  url.searchParams.set('error', code);
  const response = NextResponse.redirect(url, 303);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return loginError(request, 'configuration');
  }

  const formData = await request.formData();
  const email = typeof formData.get('email') === 'string'
    ? String(formData.get('email')).trim().toLowerCase()
    : '';
  const password = typeof formData.get('password') === 'string'
    ? String(formData.get('password'))
    : '';

  if (!email || !password) {
    return loginError(request, 'invalid');
  }

  const destination = new URL(safeRedirect(formData.get('redirectTo')), request.url);
  const response = NextResponse.redirect(destination, 303);
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

  try {
    const { error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      12_000,
      'Tempo limite ao fazer login.',
    );
    if (error) return loginError(request, 'invalid');
    return response;
  } catch {
    return loginError(request, 'unavailable');
  }
}

export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/login', request.url), 303);
}
