import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // ⚠️ Use a service role key (segura, não exponha no cliente)
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: Request) {
  try {
    const { empresa, email, senha, plano, aceiteTermos } = await request.json();

    if (!aceiteTermos) {
      return NextResponse.json({ error: 'Aceite dos termos é obrigatório' }, { status: 400 });
    }

    // 1. Criar o tenant
    const baseSubdomain = empresa.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const subdomain = `${baseSubdomain}-${Date.now()}`;

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        name: empresa,
        email,
        plano,
        status: 'active',
        subdomain,
        termos_aceito: true,
        data_aceite_termos: new Date().toISOString(),
      })
      .select()
      .single();

    if (tenantError) throw new Error(`Tenant error: ${tenantError.message}`);

    // 2. Criar usuário no Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true, // confirma automaticamente (evita e-mail de confirmação)
    });

    if (authError) throw new Error(`Auth error: ${authError.message}`);

    // 3. Criar perfil do usuário
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authUser.user.id,
        email,
        role: 'cliente',
        tenant_id: tenant.id,
      });

    if (profileError) throw new Error(`Profile error: ${profileError.message}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro no cadastro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}