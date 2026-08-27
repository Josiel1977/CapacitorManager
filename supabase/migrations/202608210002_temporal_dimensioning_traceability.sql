-- CapacitorManager RC23 — rastreabilidade da especificação temporal
-- Pré-requisito: 202608110003_auditable_dimensioning.sql
-- Migração aditiva e idempotente: preserva todas as memórias existentes.

begin;

alter table public.dimensioning_runs
  add column if not exists transformer_id uuid references public.transformadores(id) on delete restrict,
  add column if not exists source_method text not null default 'legacy',
  add column if not exists release_level text not null default 'legacy',
  add column if not exists engineering_confirmations jsonb not null default '{}'::jsonb;

-- O nível representativo é reservado às séries temporais que atendem aos
-- critérios de cobertura e às confirmações técnicas registradas.
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

-- Mantém a memória imutável e impede relacionar um transformador pertencente
-- a outro tenant, inclusive por requisição direta à API.
drop policy if exists tenant_insert on public.dimensioning_runs;
create policy tenant_insert on public.dimensioning_runs for insert
  with check (
    public.can_access_tenant(tenant_id)
    and created_by = auth.uid()
    and (
      transformer_id is null
      or exists (
        select 1
        from public.transformadores as t
        where t.id = transformer_id
          and t.tenant_id = dimensioning_runs.tenant_id
      )
    )
  );

comment on column public.dimensioning_runs.transformer_id is
  'Transformador ou conjunto elétrico analisado pela série temporal.';
comment on column public.dimensioning_runs.source_method is
  'Origem técnica das entradas: faturas, série temporal, memória de massa ou legado.';
comment on column public.dimensioning_runs.release_level is
  'Limite de uso do resultado: bloqueado, pré-dimensionamento ou especificação condicionada.';
comment on column public.dimensioning_runs.engineering_confirmations is
  'Confirmações explícitas do responsável técnico vigentes no instante da execução.';

commit;
