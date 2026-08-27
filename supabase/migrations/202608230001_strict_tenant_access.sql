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
revoke all on function public.can_access_tenant(uuid) from public, anon;
revoke all on function public.current_tenant_id() from public, anon;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.has_active_support_grant(uuid) to authenticated;
grant execute on function public.can_read_tenant(uuid) to authenticated;
grant execute on function public.can_write_tenant(uuid) to authenticated;
grant execute on function public.can_access_tenant(uuid) to authenticated;
grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;

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
set id = '11111111-1111-1111-1111-111111111111',
    tenant_id = '11111111-1111-1111-1111-111111111111'::uuid,
    updated_at = now()
where id = 'global' and tenant_id is null;

update public.configuracoes
set id = '11111111-1111-1111-1111-111111111111'
where id = 'global'
  and tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;

do $$
begin
  if exists (select 1 from public.configuracoes where tenant_id is null) then
    raise exception 'Existem configurações sem tenant_id; atribua a empresa correta antes de continuar.';
  end if;
end $$;

alter table public.configuracoes alter column tenant_id set not null;

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
      execute format('revoke all privileges on table public.%I from anon', table_name);
      execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
      execute format('create policy tenant_select on public.%I for select to authenticated using (public.can_read_tenant(tenant_id))', table_name);
      execute format('create policy tenant_insert on public.%I for insert to authenticated with check (public.can_write_tenant(tenant_id))', table_name);
      execute format('create policy tenant_update on public.%I for update to authenticated using (public.can_write_tenant(tenant_id)) with check (public.can_write_tenant(tenant_id))', table_name);
      execute format('create policy tenant_delete on public.%I for delete to authenticated using (public.can_write_tenant(tenant_id))', table_name);
    end if;
  end loop;
end $$;

do $$
declare policy_row record;
begin
  if to_regclass('public.dimensioning_runs') is not null then
    -- Alguns bancos RC22 já possuem a tabela auditável, mas ainda não
    -- receberam a extensão temporal 202608210002. Completa o esquema de
    -- forma aditiva para que a política abaixo nunca dependa de uma coluna
    -- ausente e para que as telas RC23 consigam registrar suas memórias.
    alter table public.dimensioning_runs
      add column if not exists transformer_id uuid references public.transformadores(id) on delete restrict,
      add column if not exists source_method text not null default 'legacy',
      add column if not exists release_level text not null default 'legacy',
      add column if not exists engineering_confirmations jsonb not null default '{}'::jsonb;

    alter table public.dimensioning_runs
      drop constraint if exists dimensioning_runs_confidence_check;
    alter table public.dimensioning_runs
      add constraint dimensioning_runs_confidence_check
      check (confidence_level in ('validated', 'representative', 'preliminary', 'insufficient'));

    alter table public.dimensioning_runs
      drop constraint if exists dimensioning_runs_source_method_check;
    alter table public.dimensioning_runs
      add constraint dimensioning_runs_source_method_check
      check (source_method in ('legacy', 'invoice_history', 'temporal_measurements', 'mass_memory'));

    alter table public.dimensioning_runs
      drop constraint if exists dimensioning_runs_release_level_check;
    alter table public.dimensioning_runs
      add constraint dimensioning_runs_release_level_check
      check (release_level in ('legacy', 'blocked', 'pre_sizing', 'conditional_specification'));

    create index if not exists idx_dimensioning_runs_transformer_created
      on public.dimensioning_runs (tenant_id, transformer_id, created_at desc)
      where transformer_id is not null;

    for policy_row in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = 'dimensioning_runs'
    loop
      execute format('drop policy if exists %I on public.dimensioning_runs', policy_row.policyname);
    end loop;
    alter table public.dimensioning_runs enable row level security;
    revoke all privileges on table public.dimensioning_runs from anon;
    revoke update, delete on table public.dimensioning_runs from authenticated;
    grant select, insert on table public.dimensioning_runs to authenticated;
    create policy tenant_select on public.dimensioning_runs
      for select to authenticated using (public.can_read_tenant(tenant_id));
    create policy tenant_insert on public.dimensioning_runs
      for insert to authenticated with check (
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
declare policy_row record;
begin
  if to_regclass('public.configuracoes') is not null then
    for policy_row in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = 'configuracoes'
    loop
      execute format('drop policy if exists %I on public.configuracoes', policy_row.policyname);
    end loop;
    alter table public.configuracoes enable row level security;
    revoke all privileges on table public.configuracoes from anon;
    revoke delete on table public.configuracoes from authenticated;
    grant select, insert, update on table public.configuracoes to authenticated;
    create policy configuracoes_tenant_select on public.configuracoes
      for select to authenticated using (public.can_read_tenant(tenant_id));
    create policy configuracoes_tenant_insert on public.configuracoes
      for insert to authenticated with check (public.can_write_tenant(tenant_id));
    create policy configuracoes_tenant_update on public.configuracoes
      for update to authenticated using (public.can_write_tenant(tenant_id))
      with check (public.can_write_tenant(tenant_id));
  end if;
end $$;

-- Administradores de tenant não recebem acesso à administração global.
alter table public.profiles enable row level security;
do $$
declare policy_row record;
begin
  for policy_row in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', policy_row.policyname);
  end loop;
end $$;
revoke all privileges on table public.profiles from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
create policy profiles_own_select on public.profiles
  for select to authenticated using (id = auth.uid());

alter table public.tenants enable row level security;
do $$
declare policy_row record;
begin
  for policy_row in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'tenants'
  loop
    execute format('drop policy if exists %I on public.tenants', policy_row.policyname);
  end loop;
end $$;
revoke all privileges on table public.tenants from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.tenants from authenticated;
grant select on table public.tenants to authenticated;
create policy tenants_member_select on public.tenants
  for select to authenticated using (public.can_read_tenant(id));

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
