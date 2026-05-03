// lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Obtém o usuário logado (ou null)
  const { data: { user } } = await supabase.auth.getUser();

  // Defina aqui as rotas que exigem login
  const protectedRoutes = [
    '/clientes', '/bancos', '/capacitores', '/dimensionar',
    '/testes', '/graficos', '/historico', '/relatorios',
    '/manutencao', '/configuracoes', '/documentacao',
    '/dashboard-real'
  ];
  const isProtectedRoute = protectedRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  );

  // Rotas de autenticação (login/signup) – se usuário logado, redireciona para dashboard
  const authRoutes = ['/login', '/signup'];
  const isAuthRoute = authRoutes.includes(request.nextUrl.pathname);

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dimensionar', request.url));
  }

  if (isProtectedRoute && !user) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Opcional: verificação de admin (se quiser)
  if (request.nextUrl.pathname.startsWith('/admin') && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dimensionar', request.url));
    }
  }

  return supabaseResponse;
}