-- CapacitorManager — Camada de dimensionamento auditável
-- Pré-requisito: 202608110001_foundation_security.sql
-- Migração aditiva e idempotente: não remove nem reescreve dados existentes.

begin;

create extension if not exists pgcrypto;

-- A fatura precisa distinguir quantidade excedente, penalidade efetivamente
-- faturada e valores calculados. Colunas antigas são preservadas.
alter table public.faturas
  add column if not exists reativo_origem text not null default 'nao_classificado',
  add column if not exists penalidade_reativa_informada numeric(14,2),
  add column if not exists tarifa_reativa_aplicada numeric(14,8),
  add column if not exists fonte_dados text not null default 'manual',
  add column if not exists confianca_extracao numeric(5,4),
  add column if not exists dados_originais jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'faturas_reativo_origem_check') then
    alter table public.faturas add constraint faturas_reativo_origem_check
      check (reativo_origem in ('nao_classificado', 'excedente_faturado', 'reativo_total_medido'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'faturas_fonte_dados_check') then
    alter table public.faturas add constraint faturas_fonte_dados_check
      check (fonte_dados in ('manual', 'pdf', 'xml', 'csv', 'api'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'faturas_confianca_extracao_check') then
    alter table public.faturas add constraint faturas_confianca_extracao_check
      check (confianca_extracao is null or confianca_extracao between 0 and 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'faturas_penalidade_reativa_check') then
    alter table public.faturas add constraint faturas_penalidade_reativa_check
      check (penalidade_reativa_informada is null or penalidade_reativa_informada >= 0);
  end if;
end $$;

comment on column public.faturas.reativo_origem is
  'Classifica os campos reativos legados; excedente faturado nunca deve ser usado como reativo total para reconstruir FP.';
comment on column public.faturas.penalidade_reativa_informada is
  'Valor monetário exibido pela concessionária na fatura, separado de qualquer estimativa do sistema.';
comment on column public.faturas.dados_originais is
  'Snapshot dos campos extraídos antes de normalização, para rastreabilidade.';

-- Medições reais por transformador. Essa série será a base para distribuição
-- do banco, validação de carga mínima, harmônicos e comparação pós-implantação.
create table if not exists public.transformer_load_measurements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  transformer_id uuid not null references public.transformadores(id) on delete cascade,
  measured_at timestamptz not null,
  interval_minutes integer,
  active_power_kw numeric(14,4),
  reactive_power_kvar numeric(14,4),
  apparent_power_kva numeric(14,4),
  power_factor numeric(7,6),
  voltage_v numeric(12,4),
  current_a numeric(12,4),
  thdv_percent numeric(8,4),
  thdi_percent numeric(8,4),
  source text not null default 'manual',
  source_device text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transformer_measurements_fp_check') then
    alter table public.transformer_load_measurements add constraint transformer_measurements_fp_check
      check (power_factor is null or power_factor between -1 and 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transformer_measurements_source_check') then
    alter table public.transformer_load_measurements add constraint transformer_measurements_source_check
      check (source in ('manual', 'analisador', 'iot', 'mqtt', 'modbus', 'importacao'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transformer_measurements_values_check') then
    alter table public.transformer_load_measurements add constraint transformer_measurements_values_check
      check (
        (interval_minutes is null or interval_minutes > 0)
        and (apparent_power_kva is null or apparent_power_kva >= 0)
        and (voltage_v is null or voltage_v >= 0)
        and (current_a is null or current_a >= 0)
        and (thdv_percent is null or thdv_percent >= 0)
        and (thdi_percent is null or thdi_percent >= 0)
      );
  end if;
end $$;

create index if not exists idx_transformer_measurements_tenant_date
  on public.transformer_load_measurements (tenant_id, measured_at desc);
create index if not exists idx_transformer_measurements_transformer_date
  on public.transformer_load_measurements (transformer_id, measured_at desc);

-- Uma execução é um documento técnico imutável. inputs_snapshot e
-- result_snapshot preservam exatamente o que sustentou o relatório emitido.
create table if not exists public.dimensioning_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  client_id uuid,
  capacitor_bank_id uuid,
  engine_version text not null,
  status text not null,
  confidence_level text not null,
  target_power_factor numeric(7,6) not null,
  percentile numeric(5,4) not null,
  theoretical_kvar numeric(14,4) not null default 0,
  commercial_kvar numeric(14,4) not null default 0,
  formula text not null,
  inputs_snapshot jsonb not null,
  result_snapshot jsonb not null,
  excluded_invoices jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  content_hash text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dimensioning_runs_status_check') then
    alter table public.dimensioning_runs add constraint dimensioning_runs_status_check
      check (status in ('completed', 'blocked'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dimensioning_runs_confidence_check') then
    alter table public.dimensioning_runs add constraint dimensioning_runs_confidence_check
      check (confidence_level in ('validated', 'preliminary', 'insufficient'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dimensioning_runs_target_fp_check') then
    alter table public.dimensioning_runs add constraint dimensioning_runs_target_fp_check
      check (target_power_factor >= 0.92 and target_power_factor < 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dimensioning_runs_percentile_check') then
    alter table public.dimensioning_runs add constraint dimensioning_runs_percentile_check
      check (percentile > 0 and percentile <= 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dimensioning_runs_kvar_check') then
    alter table public.dimensioning_runs add constraint dimensioning_runs_kvar_check
      check (theoretical_kvar >= 0 and commercial_kvar >= 0);
  end if;
end $$;

create unique index if not exists idx_dimensioning_runs_tenant_hash
  on public.dimensioning_runs (tenant_id, content_hash);
create index if not exists idx_dimensioning_runs_tenant_created
  on public.dimensioning_runs (tenant_id, created_at desc);

alter table public.transformer_load_measurements enable row level security;
alter table public.dimensioning_runs enable row level security;

drop policy if exists tenant_select on public.transformer_load_measurements;
drop policy if exists tenant_insert on public.transformer_load_measurements;
drop policy if exists tenant_update on public.transformer_load_measurements;
drop policy if exists tenant_delete on public.transformer_load_measurements;
create policy tenant_select on public.transformer_load_measurements for select
  using (public.can_access_tenant(tenant_id));
create policy tenant_insert on public.transformer_load_measurements for insert
  with check (public.can_access_tenant(tenant_id));
create policy tenant_update on public.transformer_load_measurements for update
  using (public.can_access_tenant(tenant_id)) with check (public.can_access_tenant(tenant_id));
create policy tenant_delete on public.transformer_load_measurements for delete
  using (public.can_access_tenant(tenant_id));

-- Execuções podem ser criadas e consultadas pelo tenant, mas nunca editadas
-- ou apagadas pelo cliente. Uma nova análise gera uma nova execução.
drop policy if exists tenant_select on public.dimensioning_runs;
drop policy if exists tenant_insert on public.dimensioning_runs;
drop policy if exists tenant_update on public.dimensioning_runs;
drop policy if exists tenant_delete on public.dimensioning_runs;
create policy tenant_select on public.dimensioning_runs for select
  using (public.can_access_tenant(tenant_id));
create policy tenant_insert on public.dimensioning_runs for insert
  with check (public.can_access_tenant(tenant_id) and created_by = auth.uid());

drop trigger if exists audit_changes on public.transformer_load_measurements;
create trigger audit_changes
  after insert or update or delete on public.transformer_load_measurements
  for each row execute function public.capture_audit_log();

comment on table public.dimensioning_runs is
  'Memória imutável de cada cálculo, incluindo entradas, saídas, versão, alertas e hash de integridade.';
comment on column public.dimensioning_runs.content_hash is
  'SHA-256 hexadecimal calculado sobre o conteúdo canônico da execução para detectar duplicidade e alteração.';

commit;
