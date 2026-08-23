-- RC23 — isolamento estrito, acesso interno e modo somente leitura.
-- Aplicar primeiro em homologação. Não remove dados operacionais.
begin;

alter table public.tenants
  add column if not exists billing_exempt boolean not null default false;

create table if not exists public.support_access_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  support_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  read_only boolean not null default true check (read_only = true),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_support_access_active
  on public.support_access_grants (support_user_id, tenant_id, expires_at)
  where revoked_at is null;

alter table public.support_access_grants enable row level security;
revoke all on public.support_access_grants from anon, authenticated;
grant all on public.support_access_grants to service_role;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select role = 'platform_admin'
    from public.profiles
    where id = auth.uid()
    limit 1
  ), false);
$$;

create or replace function public.has_active_support_grant(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.support_access_grants grant_row
      where grant_row.support_user_id = auth.uid()
        and grant_row.tenant_id = target_tenant_id
        and grant_row.read_only = true
        and grant_row.revoked_at is null
        and grant_row.expires_at > now()
    );
$$;

create or replace function public.can_read_tenant(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_tenant_id is not null
    and (
      target_tenant_id = public.current_tenant_id()
      or public.has_active_support_grant(target_tenant_id)
    );
$$;

create or replace function public.can_write_tenant(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_tenant_id = public.current_tenant_id()
    and exists (
      select 1
      from public.tenants tenant_row
      where tenant_row.id = target_tenant_id
        and (
          tenant_row.billing_exempt
          or tenant_row.payment_status in ('trial', 'active', 'grace', 'internal')
        )
    );
$$;

-- Compatibilidade temporária para consultas existentes. Escritas usam a
-- função específica abaixo e nunca recebem o acesso de suporte.
create or replace function public.can_access_tenant(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.can_read_tenant(target_tenant_id); $$;

revoke all on function public.has_active_support_grant(uuid) from public, anon;
revoke all on function public.can_read_tenant(uuid) from public, anon;
revoke all on function public.can_write_tenant(uuid) from public, anon;
grant execute on function public.has_active_support_grant(uuid) to authenticated;
grant execute on function public.can_read_tenant(uuid) to authenticated;
grant execute on function public.can_write_tenant(uuid) to authenticated;

-- A JM é operadora interna da plataforma e não depende de cobrança.
update public.tenants
set billing_exempt = true,
    payment_status = 'internal',
    updated_at = now()
where id = '11111111-1111-1111-1111-111111111111'::uuid;

-- A restrição antiga aceitava apenas admin/cliente/user e impediria a
-- promoção controlada do administrador da plataforma.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in (
    'platform_admin', 'admin', 'cliente', 'user',
    'tecnico', 'visualizador', 'financeiro'
  ));

update public.profiles
set role = case
      when email = 'suporte@capacitormanager.com.br' then 'platform_admin'
      else role
    end,
    subscription_status = 'active'
where tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;

-- O diagnóstico encontrou a configuração histórica "global" sem tenant.
-- Ela pertence à operação interna já existente; nenhuma linha é apagada.
update public.configuracoes
set tenant_id = '11111111-1111-1111-1111-111111111111'::uuid,
    updated_at = now()
where tenant_id is null;

-- Acesso operacional: leitura isolada; escrita condicionada ao pagamento.
do $$
declare
  table_name text;
  policy_row record;
begin
  foreach table_name in array array[
    'clientes', 'bancos_capacitores', 'capacitores', 'medicoes',
    'transformadores', 'faturas', 'transformer_load_measurements'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      for policy_row in
        select policyname from pg_policies
        where schemaname = 'public' and tablename = table_name
      loop
        execute format('drop policy if exists %I on public.%I', policy_row.policyname, table_name);
      end loop;
      execute format('alter table public.%I enable row level security', table_name);
      execute format('create policy tenant_select on public.%I for select using (public.can_read_tenant(tenant_id))', table_name);
      execute format('create policy tenant_insert on public.%I for insert with check (public.can_write_tenant(tenant_id))', table_name);
      execute format('create policy tenant_update on public.%I for update using (public.can_write_tenant(tenant_id)) with check (public.can_write_tenant(tenant_id))', table_name);
      execute format('create policy tenant_delete on public.%I for delete using (public.can_write_tenant(tenant_id))', table_name);
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('public.dimensioning_runs') is not null then
    drop policy if exists tenant_select on public.dimensioning_runs;
    drop policy if exists tenant_insert on public.dimensioning_runs;
    drop policy if exists tenant_update on public.dimensioning_runs;
    drop policy if exists tenant_delete on public.dimensioning_runs;
    create policy tenant_select on public.dimensioning_runs
      for select using (public.can_read_tenant(tenant_id));
    create policy tenant_insert on public.dimensioning_runs
      for insert with check (
        public.can_write_tenant(tenant_id)
        and created_by = auth.uid()
        and (
          transformer_id is null
          or exists (
            select 1 from public.transformadores transformer_row
            where transformer_row.id = transformer_id
              and transformer_row.tenant_id = dimensioning_runs.tenant_id
          )
        )
      );
  end if;
end $$;

do $$
begin
  if to_regclass('public.configuracoes') is not null then
    drop policy if exists configuracoes_tenant_select on public.configuracoes;
    drop policy if exists configuracoes_tenant_insert on public.configuracoes;
    drop policy if exists configuracoes_tenant_update on public.configuracoes;
    create policy configuracoes_tenant_select on public.configuracoes
      for select using (public.can_read_tenant(tenant_id));
    create policy configuracoes_tenant_insert on public.configuracoes
      for insert with check (public.can_write_tenant(tenant_id));
    create policy configuracoes_tenant_update on public.configuracoes
      for update using (public.can_write_tenant(tenant_id))
      with check (public.can_write_tenant(tenant_id));
  end if;
end $$;

-- Administradores de tenant não recebem acesso à administração global.
drop policy if exists profiles_own_or_admin_select on public.profiles;
create policy profiles_own_select on public.profiles
  for select using (id = auth.uid());

drop policy if exists tenants_member_select on public.tenants;
create policy tenants_member_select on public.tenants
  for select using (public.can_read_tenant(id));

-- Tenant interno não é submetido aos limites comerciais de planos pagos.
create or replace function public.enforce_plan_record_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_name text;
  record_limit integer;
  current_count bigint;
  exempt boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text || ':' || tg_table_name, 0));
  select coalesce(plano, 'basico'), billing_exempt
    into plan_name, exempt
  from public.tenants
  where id = new.tenant_id;
  if exempt then return new; end if;
  record_limit := case tg_table_name
    when 'clientes' then case plan_name when 'basico' then 1 when 'essencial' then 5 when 'pro' then 20 when 'master' then 50 else 1 end
    when 'bancos_capacitores' then case plan_name when 'basico' then 1 when 'essencial' then 10 when 'pro' then 20 when 'master' then 100 else 1 end
    when 'capacitores' then case plan_name when 'basico' then 6 when 'essencial' then 50 when 'pro' then 200 when 'master' then 600 else 6 end
  end;
  execute format('select count(*) from public.%I where tenant_id = $1', tg_table_name)
    into current_count using new.tenant_id;
  if current_count >= record_limit then
    raise exception 'Limite do plano atingido para %', tg_table_name using errcode = 'P0001';
  end if;
  return new;
end;
$$;

commit;
