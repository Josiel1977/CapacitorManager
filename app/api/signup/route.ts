import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { isPlanId, PLANS, type PlanId } from '@/lib/plans';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') || 0) > 10_000) {
      return NextResponse.json({ error: 'Requisição inválida' }, { status: 413 });
    }
    const allowed = await enforceRateLimit({ endpoint: 'signup', request, maxRequests: 5, windowSeconds: 3600 });
    if (!allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde e tente novamente.' }, { status: 429 });

    const body = await request.json();
    const empresa = typeof body.empresa === 'string' ? body.empresa.trim().slice(0, 160) : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 180) : '';
    const senha = typeof body.senha === 'string' ? body.senha : '';
    if (!body.aceiteTermos || empresa.length < 2 || !emailPattern.test(email) || senha.length < 12 || !isPlanId(body.plano)) {
      return NextResponse.json({ error: 'Revise os dados, aceite os termos e use uma senha com 12 ou mais caracteres.' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!url || !anonKey || !appUrl) return NextResponse.json({ error: 'Cadastro temporariamente indisponível' }, { status: 503 });

    const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await authClient.auth.signUp({
      email,
      password: senha,
      options: { emailRedirectTo: `${appUrl.replace(/\/$/, '')}/login`, data: { nome_empresa: empresa } },
    });
    if (authError || !authData.user) {
      const duplicate = authError?.message.toLowerCase().includes('registered');
      return NextResponse.json({ error: duplicate ? 'Já existe uma conta para este e-mail.' : 'Não foi possível concluir o cadastro.' }, { status: duplicate ? 409 : 400 });
    }
    // O Supabase pode ocultar a existência de uma conta retornando um usuário sem identidades.
    // Nesse caso não criamos empresa e, principalmente, não tentamos apagar o usuário existente.
    if ((authData.user.identities?.length ?? 0) === 0) {
      return NextResponse.json({ error: 'Já existe uma conta para este e-mail.' }, { status: 409 });
    }

    const admin = getSupabaseAdmin();
    const plan = PLANS[body.plano as PlanId];
    const subdomain = `${slugify(empresa) || 'empresa'}-${crypto.randomUUID().slice(0, 8)}`;
    const acceptedAt = new Date().toISOString();
    const { data: tenant, error: tenantError } = await admin.from('tenants').insert({
      name: empresa,
      email,
      plano: plan.id,
      status: 'pending',
      payment_status: 'pending',
      subdomain,
      termos_aceito: true,
      data_aceite_termos: acceptedAt,
      limite_clientes: plan.limits.clients,
      limite_bancos: plan.limits.banks,
      limite_capacitores: plan.limits.capacitors,
    }).select('id').single();

    if (tenantError || !tenant) {
      await admin.auth.admin.deleteUser(authData.user.id);
      console.error('[Cadastro] Falha ao criar empresa:', tenantError);
      return NextResponse.json({ error: 'Não foi possível concluir o cadastro.' }, { status: 500 });
    }

    const { error: profileError } = await admin.from('profiles').insert({
      id: authData.user.id,
      tenant_id: tenant.id,
      email,
      role: 'cliente',
      status: 'pendente',
      plano: plan.name,
      plan: plan.id,
      subscription_status: 'inactive',
    });
    if (profileError) {
      await admin.from('tenants').delete().eq('id', tenant.id);
      await admin.auth.admin.deleteUser(authData.user.id);
      console.error('[Cadastro] Falha ao criar perfil:', profileError);
      return NextResponse.json({ error: 'Não foi possível concluir o cadastro.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, requiresEmailConfirmation: !authData.session }, { status: 201 });
  } catch (error) {
    console.error('[Cadastro] Falha inesperada:', error);
    return NextResponse.json({ error: 'Não foi possível concluir o cadastro.' }, { status: 500 });
  }
}
