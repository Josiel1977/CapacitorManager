-- Evita duplicidade ao importar novamente a mesma série do analisador.
-- O índice é restrito à origem de série temporal e não interfere em registros manuais.

begin;

create unique index if not exists idx_transformer_embrasul_series_unique_sample
  on public.transformer_load_measurements (tenant_id, transformer_id, measured_at, source_device)
  where source = 'analisador' and source_device = 'EMBRASUL — série temporal';

comment on index public.idx_transformer_embrasul_series_unique_sample is
  'Impede duplicar a mesma amostra Embrasul no mesmo transformador durante reimportações.';

commit;
