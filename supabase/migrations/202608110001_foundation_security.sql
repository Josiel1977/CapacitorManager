-- CapacitorManager — Fundação SaaS multi-tenant
-- IMPORTANTE: execute primeiro em um projeto de homologação.
-- A migração aborta sem alterar nada se encontrar registros sem tenant_id.

begin;

create extension if not exists pgcrypto;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  user_id uuid,
  table_name text not null,
  record_id text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid() limit 1;
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid() limit 1), false);
$$;

create or replace function public.can_access_tenant(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and target_tenant_id is not null
     and (public.is_platform_admin() or target_tenant_id = public.current_tenant_id());
$$;

create or replace function public.capture_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row jsonb;
  source_tenant uuid;
  source_id text;
begin
  source_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  source_tenant := nullif(source_row ->> 'tenant_id', '')::uuid;
  source_id := source_row ->> 'id';

  insert into public.audit_logs (tenant_id, user_id, table_name, record_id, action, old_data, new_data)
  values (
    source_tenant,
    auth.uid(),
    tg_table_name,
    source_id,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- A aplicação já utiliza tenant_id nestas entidades. As colunas são criadas
-- apenas quando faltarem, sem remover ou reescrever dados existentes.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'clientes', 'bancos_capacitores', 'capacitores', 'medicoes',
    'transformadores', 'faturas'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I add column if not exists tenant_id uuid references public.tenants(id)', table_name);
      execute format('create index if not exists %I on public.%I (tenant_id)', 'idx_' || table_name || '_tenant_id', table_name);
    end if;
  end loop;
end $$;

-- Proteção contra ativação prematura: nenhum registro operacional pode ficar
-- sem empresa definida quando o RLS entrar em vigor.
do $$
declare
  table_name text;
  missing_count bigint;
begin
  foreach table_name in array array[
    'clientes', 'bancos_capacitores', 'capacitores', 'medicoes',
    'transformadores', 'faturas'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('select count(*) from public.%I where tenant_id is null', table_name) into missing_count;
      if missing_count > 0 then
        raise exception 'Migração interrompida: tabela % possui % registro(s) sem tenant_id.', table_name, missing_count;
      end if;
    end if;
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'clientes', 'bancos_capacitores', 'capacitores', 'medicoes',
    'transformadores', 'faturas'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists tenant_select on public.%I', table_name);
      execute format('drop policy if exists tenant_insert on public.%I', table_name);
      execute format('drop policy if exists tenant_update on public.%I', table_name);
      execute format('drop policy if exists tenant_delete on public.%I', table_name);
      execute format('create policy tenant_select on public.%I for select using (public.can_access_tenant(tenant_id))', table_name);
      execute format('create policy tenant_insert on public.%I for insert with check (public.can_access_tenant(tenant_id))', table_name);
      execute format('create policy tenant_update on public.%I for update using (public.can_access_tenant(tenant_id)) with check (public.can_access_tenant(tenant_id))', table_name);
      execute format('create policy tenant_delete on public.%I for delete using (public.can_access_tenant(tenant_id))', table_name);

      execute format('drop trigger if exists audit_changes on public.%I', table_name);
      execute format('create trigger audit_changes after insert or update or delete on public.%I for each row execute function public.capture_audit_log()', table_name);
    end if;
  end loop;
end $$;

drop policy if exists audit_tenant_select on public.audit_logs;
create policy audit_tenant_select on public.audit_logs
for select using (public.can_access_tenant(tenant_id));

create index if not exists idx_audit_logs_tenant_created
  on public.audit_logs (tenant_id, created_at desc);

commit;
