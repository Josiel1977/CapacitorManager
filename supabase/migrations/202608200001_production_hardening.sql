-- CapacitorManager — reforço final para produção.
-- Execute após as migrações 20260811/20260812, primeiro em homologação.
begin;

alter table if exists public.tenants
  add column if not exists plano text not null default 'basico',
  add column if not exists payment_status text not null default 'pending',
  add column if not exists mp_subscription_id text,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.profiles
  add column if not exists plan text,
  add column if not exists subscription_status text not null default 'inactive';

-- A própria sessão só alcança dados operacionais quando a assinatura estiver
-- ativa. Administradores de plataforma continuam com acesso de suporte.
create or replace function public.can_access_tenant(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and target_tenant_id is not null
     and (
       public.is_platform_admin()
       or (
         target_tenant_id = public.current_tenant_id()
         and exists (
           select 1 from public.tenants
           where id = target_tenant_id and payment_status = 'active'
         )
       )
     );
$$;

alter table if exists public.payment_webhook_events
  add column if not exists status text not null default 'processing',
  add column if not exists attempt_count integer not null default 1,
  add column if not exists processed_at timestamptz,
  add column if not exists last_error text,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  if to_regclass('public.payment_webhook_events') is not null
     and not exists (select 1 from pg_constraint where conname = 'payment_webhook_events_status_check') then
    alter table public.payment_webhook_events add constraint payment_webhook_events_status_check
      check (status in ('processing', 'processed', 'failed'));
  end if;
end $$;

create table if not exists public.api_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  actor_hash text not null,
  endpoint text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_api_usage_endpoint_actor_time
  on public.api_usage_events (endpoint, actor_hash, created_at desc);
alter table public.api_usage_events enable row level security;

create or replace function public.consume_api_rate_limit(
  p_endpoint text,
  p_actor_hash text,
  p_user_id uuid,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare recent_count bigint;
begin
  if p_endpoint is null or p_actor_hash is null
     or p_max_requests < 1 or p_window_seconds < 1 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_endpoint || ':' || p_actor_hash, 0));
  select count(*) into recent_count
  from public.api_usage_events
  where endpoint = p_endpoint
    and actor_hash = p_actor_hash
    and created_at >= now() - make_interval(secs => p_window_seconds);

  if recent_count >= p_max_requests then return false; end if;
  insert into public.api_usage_events (endpoint, actor_hash, user_id)
  values (p_endpoint, p_actor_hash, p_user_id);
  return true;
end;
$$;
revoke all on function public.consume_api_rate_limit(text,text,uuid,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text,text,uuid,integer,integer) to service_role;

alter table if exists public.medicoes
  add column if not exists frequencia_medida_hz numeric(8,3);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  telefone text,
  empresa text,
  cargo text,
  mensagem text,
  plano_interesse text,
  origem text not null default 'Site',
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

-- Remove políticas permissivas legadas antes de definir a matriz oficial.
do $$ declare policy_row record; begin
  for policy_row in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename = any(array['tenants','profiles','leads','configuracoes','payment_webhook_events','api_usage_events'])
  loop
    execute format('drop policy if exists %I on public.%I', policy_row.policyname, policy_row.tablename);
  end loop;
end $$;

alter table if exists public.leads
  add column if not exists ip_hash text,
  add column if not exists user_agent text,
  add column if not exists consent_at timestamptz;

do $$ begin
  if to_regclass('public.leads') is not null then
    alter table public.leads enable row level security;
    drop policy if exists leads_admin_select on public.leads;
    drop policy if exists leads_admin_update on public.leads;
    create policy leads_admin_select on public.leads for select using (public.is_platform_admin());
    create policy leads_admin_update on public.leads for update using (public.is_platform_admin()) with check (public.is_platform_admin());
  end if;
end $$;

-- A aplicação cliente pode consultar a própria empresa, mas alterações de plano,
-- cobrança e limites são exclusivas do servidor com service role.
alter table if exists public.tenants enable row level security;
drop policy if exists tenants_member_select on public.tenants;
create policy tenants_member_select on public.tenants
  for select using (public.can_access_tenant(id));

alter table if exists public.profiles enable row level security;
drop policy if exists profiles_own_or_admin_select on public.profiles;
create policy profiles_own_or_admin_select on public.profiles
  for select using (id = auth.uid() or public.is_platform_admin());

-- Configurações deixam de ser globais e passam a pertencer à empresa.
alter table if exists public.configuracoes add column if not exists tenant_id uuid references public.tenants(id);
create unique index if not exists uq_configuracoes_tenant on public.configuracoes (tenant_id) where tenant_id is not null;
alter table if exists public.configuracoes enable row level security;
drop policy if exists configuracoes_tenant_select on public.configuracoes;
drop policy if exists configuracoes_tenant_insert on public.configuracoes;
drop policy if exists configuracoes_tenant_update on public.configuracoes;
create policy configuracoes_tenant_select on public.configuracoes for select using (public.can_access_tenant(tenant_id));
create policy configuracoes_tenant_insert on public.configuracoes for insert with check (public.can_access_tenant(tenant_id));
create policy configuracoes_tenant_update on public.configuracoes for update using (public.can_access_tenant(tenant_id)) with check (public.can_access_tenant(tenant_id));

-- Impede que relações apontem para registros de outra empresa, mesmo quando um
-- UUID válido é enviado manualmente ao banco.
create or replace function public.validate_operational_tenant_links()
returns trigger language plpgsql set search_path = public as $$
declare related_tenant uuid;
begin
  if tg_table_name = 'bancos_capacitores' and new.cliente_id is not null then
    select tenant_id into related_tenant from public.clientes where id = new.cliente_id;
  elsif tg_table_name = 'capacitores' and new.banco_id is not null then
    select tenant_id into related_tenant from public.bancos_capacitores where id = new.banco_id;
  elsif tg_table_name = 'medicoes' then
    if new.cliente_id is not null then
      select tenant_id into related_tenant from public.clientes where id = new.cliente_id;
      if related_tenant is distinct from new.tenant_id then raise exception 'Cliente pertence a outra empresa'; end if;
    end if;
    if new.banco_id is not null then
      select tenant_id into related_tenant from public.bancos_capacitores where id = new.banco_id;
      if related_tenant is distinct from new.tenant_id then raise exception 'Banco pertence a outra empresa'; end if;
    end if;
    if new.capacitor_id is not null then
      select tenant_id into related_tenant from public.capacitores where id = new.capacitor_id;
    end if;
  elsif tg_table_name = 'transformer_load_measurements' and new.transformer_id is not null then
    select tenant_id into related_tenant from public.transformadores where id = new.transformer_id;
  end if;
  if related_tenant is distinct from new.tenant_id then raise exception 'Relacionamento entre empresas diferentes'; end if;
  return new;
end $$;

do $$ declare table_name text; begin
  foreach table_name in array array['bancos_capacitores','capacitores','medicoes','transformer_load_measurements'] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists validate_tenant_links on public.%I', table_name);
      execute format('create trigger validate_tenant_links before insert or update on public.%I for each row execute function public.validate_operational_tenant_links()', table_name);
    end if;
  end loop;
end $$;

-- Limites comerciais são aplicados no banco; a interface não é a autoridade.
create or replace function public.enforce_plan_record_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare plan_name text; record_limit integer; current_count bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text || ':' || tg_table_name, 0));
  select coalesce(plano, 'basico') into plan_name from public.tenants where id = new.tenant_id;
  record_limit := case tg_table_name
    when 'clientes' then case plan_name when 'basico' then 1 when 'essencial' then 5 when 'pro' then 20 when 'master' then 50 else 1 end
    when 'bancos_capacitores' then case plan_name when 'basico' then 1 when 'essencial' then 10 when 'pro' then 20 when 'master' then 100 else 1 end
    when 'capacitores' then case plan_name when 'basico' then 6 when 'essencial' then 50 when 'pro' then 200 when 'master' then 600 else 6 end
  end;
  execute format('select count(*) from public.%I where tenant_id = $1', tg_table_name) into current_count using new.tenant_id;
  if current_count >= record_limit then raise exception 'Limite do plano atingido para %', tg_table_name using errcode = 'P0001'; end if;
  return new;
end $$;

do $$ declare table_name text; begin
  foreach table_name in array array['clientes','bancos_capacitores','capacitores'] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists enforce_plan_limit on public.%I', table_name);
      execute format('create trigger enforce_plan_limit before insert on public.%I for each row execute function public.enforce_plan_record_limit()', table_name);
    end if;
  end loop;
end $$;

-- Também substitui políticas operacionais antigas por uma única matriz tenant.
do $$ declare table_name text; policy_row record; begin
  foreach table_name in array array['clientes','bancos_capacitores','capacitores','medicoes','transformadores','faturas','transformer_load_measurements'] loop
    if to_regclass('public.' || table_name) is not null then
      for policy_row in select policyname from pg_policies where schemaname = 'public' and tablename = table_name loop
        execute format('drop policy if exists %I on public.%I', policy_row.policyname, table_name);
      end loop;
      execute format('alter table public.%I enable row level security', table_name);
      execute format('create policy tenant_select on public.%I for select using (public.can_access_tenant(tenant_id))', table_name);
      execute format('create policy tenant_insert on public.%I for insert with check (public.can_access_tenant(tenant_id))', table_name);
      execute format('create policy tenant_update on public.%I for update using (public.can_access_tenant(tenant_id)) with check (public.can_access_tenant(tenant_id))', table_name);
      execute format('create policy tenant_delete on public.%I for delete using (public.can_access_tenant(tenant_id))', table_name);
    end if;
  end loop;
end $$;

commit;
