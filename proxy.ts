import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { withTimeout } from '@/lib/with-timeout';
import { isProtectedPath } from '@/lib/route-protection';

export async function proxy(request: NextRequest) {
  const isProtectedRoute = isProtectedPath(request.nextUrl.pathname);

  // Páginas públicas devem abrir mesmo quando o serviço de autenticação estiver
  // lento ou temporariamente indisponível. A validação remota fica restrita às
  // rotas que realmente exigem uma sessão autenticada.
  if (!isProtectedRoute) {
    return NextResponse.next({ request });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase não configurado.');
    return new NextResponse('Serviço temporariamente indisponível', { status: 503 });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );

  // getClaims valida a assinatura e a expiração do JWT. Com chaves
  // assimétricas, a validação usa JWKS em cache e evita uma chamada remota ao
  // Auth em cada navegação protegida.
  let userId: string | null = null;
  let authAvailable = true;
  try {
    const result = await withTimeout(
      supabase.auth.getClaims(),
      8_000,
      'Tempo limite ao validar a sessão.',
    );
    userId = typeof result.data?.claims?.sub === 'string'
      ? result.data.claims.sub
      : null;
    if (result.error) authAvailable = false;
  } catch (error) {
    authAvailable = false;
    console.error('[Proxy] Serviço de autenticação indisponível.', error);
  }

  const isConfirmationRoute = request.nextUrl.pathname.startsWith('/subscription/success');

  if (isProtectedRoute && !authAvailable) {
    return new NextResponse('Autenticação temporariamente indisponível', { status: 503 });
  }

  if (isProtectedRoute && !userId) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isProtectedRoute && userId) {
    let profile = null;
    try {
      const result = await withTimeout(
        supabase
          .from('profiles')
          .select('role, subscription_status')
          .eq('id', userId)
          .maybeSingle(),
        8_000,
        'Tempo limite ao validar o perfil.',
      );
      if (result.error) throw result.error;
      profile = result.data;
    } catch (error) {
      console.error('[Proxy] Não foi possível validar o perfil.', error);
      return new NextResponse('Autenticação temporariamente indisponível', { status: 503 });
    }

    if (!profile) {
      return NextResponse.redirect(new URL('/planos?status=perfil-pendente', request.url));
    }
    if (request.nextUrl.pathname.startsWith('/admin') && profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard-real', request.url));
    }
    if (profile.role !== 'admin' && profile.subscription_status !== 'active' && !isConfirmationRoute) {
      return NextResponse.redirect(new URL('/planos?status=assinatura-pendente', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
