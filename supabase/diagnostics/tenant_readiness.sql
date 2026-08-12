-- DIAGNÓSTICO SOMENTE LEITURA — PRONTIDÃO MULTI-TENANT
-- Execute no SQL Editor do Supabase e exporte o resultado.
-- Usa apenas uma tabela temporária, restrita à sessão do SQL Editor.
-- Nenhuma tabela ou registro permanente é criado ou alterado.

drop table if exists tenant_readiness;

create temp table tenant_readiness (
  categoria text,
  tabela text,
  verificacao text,
  quantidade bigint,
  situacao text
);

do $$
declare
  item text;
  total_rows bigint;
  missing_rows bigint;
  has_tenant boolean;
begin
  foreach item in array array[
    'clientes', 'bancos_capacitores', 'capacitores', 'medicoes',
    'transformadores', 'faturas', 'configuracoes'
  ] loop
    if to_regclass('public.' || item) is null then
      insert into tenant_readiness values ('estrutura', item, 'tabela existente', 0, 'AUSENTE');
      continue;
    end if;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = item and column_name = 'tenant_id'
    ) into has_tenant;

    execute format('select count(*) from public.%I', item) into total_rows;
    insert into tenant_readiness values ('dados', item, 'total de registros', total_rows, 'INFO');

    if not has_tenant then
      insert into tenant_readiness values ('estrutura', item, 'coluna tenant_id', total_rows, 'AUSENTE');
    else
      execute format('select count(*) from public.%I where tenant_id is null', item) into missing_rows;
      insert into tenant_readiness values (
        'isolamento', item, 'registros sem tenant_id', missing_rows,
        case when missing_rows = 0 then 'OK' else 'CORRIGIR' end
      );
    end if;
  end loop;
end $$;

-- Relações órfãs: registros filhos apontando para outra empresa ou sem vínculo.
do $$
declare
  mismatch bigint;
begin
  if to_regclass('public.bancos_capacitores') is not null
     and to_regclass('public.clientes') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='bancos_capacitores' and column_name='tenant_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='clientes' and column_name='tenant_id') then
    select count(*) into mismatch
    from public.bancos_capacitores b
    join public.clientes c on c.id = b.cliente_id
    where b.tenant_id is distinct from c.tenant_id;
    insert into tenant_readiness values ('integridade', 'bancos_capacitores', 'tenant diferente do cliente', mismatch, case when mismatch=0 then 'OK' else 'CORRIGIR' end);
  end if;

  if to_regclass('public.capacitores') is not null
     and to_regclass('public.bancos_capacitores') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='capacitores' and column_name='tenant_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='bancos_capacitores' and column_name='tenant_id') then
    select count(*) into mismatch
    from public.capacitores c
    join public.bancos_capacitores b on b.id = c.banco_id
    where c.tenant_id is distinct from b.tenant_id;
    insert into tenant_readiness values ('integridade', 'capacitores', 'tenant diferente do banco', mismatch, case when mismatch=0 then 'OK' else 'CORRIGIR' end);
  end if;

  if to_regclass('public.medicoes') is not null
     and to_regclass('public.capacitores') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='medicoes' and column_name='tenant_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='capacitores' and column_name='tenant_id') then
    select count(*) into mismatch
    from public.medicoes m
    join public.capacitores c on c.id = m.capacitor_id
    where m.tenant_id is distinct from c.tenant_id;
    insert into tenant_readiness values ('integridade', 'medicoes', 'tenant diferente do capacitor', mismatch, case when mismatch=0 then 'OK' else 'CORRIGIR' end);
  end if;
end $$;

select categoria, tabela, verificacao, quantidade, situacao
from tenant_readiness
order by
  case situacao when 'CORRIGIR' then 1 when 'AUSENTE' then 2 when 'OK' then 3 else 4 end,
  categoria,
  tabela;
