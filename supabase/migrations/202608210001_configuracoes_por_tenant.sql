-- CapacitorManager — configurações técnicas isoladas por empresa
-- Migração idempotente: não remove nem altera configurações existentes.
begin;

alter table if exists public.configuracoes
  add column if not exists tenant_id uuid references public.tenants(id),
  add column if not exists limite_corrente_min numeric not null default 80,
  add column if not exists limite_corrente_max numeric not null default 120,
  add column if not exists temperatura_max numeric not null default 60,
  add column if not exists tempo_operacao_dias integer not null default 365,
  add column if not exists degradacao_anual_percent numeric not null default 3;

create unique index if not exists uq_configuracoes_tenant
  on public.configuracoes (tenant_id)
  where tenant_id is not null;

alter table if exists public.configuracoes enable row level security;

drop policy if exists configuracoes_tenant_select on public.configuracoes;
drop policy if exists configuracoes_tenant_insert on public.configuracoes;
drop policy if exists configuracoes_tenant_update on public.configuracoes;

create policy configuracoes_tenant_select on public.configuracoes
for select using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or (p.tenant_id = configuracoes.tenant_id and p.subscription_status = 'active')
      )
  )
);

create policy configuracoes_tenant_insert on public.configuracoes
for insert with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or (p.tenant_id = configuracoes.tenant_id and p.subscription_status = 'active')
      )
  )
);

create policy configuracoes_tenant_update on public.configuracoes
for update using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or (p.tenant_id = configuracoes.tenant_id and p.subscription_status = 'active')
      )
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or (p.tenant_id = configuracoes.tenant_id and p.subscription_status = 'active')
      )
  )
);

grant select, insert, update on public.configuracoes to authenticated;

commit;
