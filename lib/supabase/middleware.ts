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
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug.
  const { data: { user } } = await supabase.auth.getUser();

  const protectedRoutes = [
    '/dimensionar', '/clientes', '/bancos', '/capacitores',
    '/medicoes', '/relatorios', '/admin',
    '/testes', '/historico', '/graficos', '/manutencao-preditiva', '/memoria-de-massa'
  ];
  const isProtectedRoute = protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route));

  // Se rota protegida e não há usuário, redireciona para login com redirectTo
  if (isProtectedRoute && !user) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Se for uma rota de login e já tem usuário, redireciona para o destino padrão
  if (request.nextUrl.pathname === '/login' && user) {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo') || '/dimensionar';
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  // Verificação de admin (opcional)
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