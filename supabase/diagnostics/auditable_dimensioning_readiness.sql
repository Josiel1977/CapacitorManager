-- Diagnóstico somente leitura para a camada de dimensionamento auditável.
-- Execute DEPOIS de 202608110003_auditable_dimensioning.sql.

select 'estrutura' as categoria, 'faturas.reativo_origem' as verificacao,
       count(*)::bigint as quantidade,
       case when count(*) = 0 then 'OK' else 'CLASSIFICAR' end as situacao
from public.faturas
where reativo_origem = 'nao_classificado'

union all

select 'qualidade', 'faturas sem FP confiável', count(*)::bigint,
       case when count(*) = 0 then 'OK' else 'REVISAR' end
from public.faturas
where fp_calculado is null or fp_calculado <= 0.3 or fp_calculado >= 1

union all

select 'qualidade', 'faturas com penalidade informada', count(*)::bigint, 'INFO'
from public.faturas
where penalidade_reativa_informada is not null

union all

select 'medicao', 'transformadores com medição', count(distinct transformer_id)::bigint,
       case when count(distinct transformer_id) = 0 then 'PENDENTE' else 'INFO' end
from public.transformer_load_measurements

union all

select 'auditoria', 'execuções de dimensionamento', count(*)::bigint, 'INFO'
from public.dimensioning_runs

union all

select 'auditoria', 'execuções sem hash SHA-256', count(*)::bigint,
       case when count(*) = 0 then 'OK' else 'CORRIGIR' end
from public.dimensioning_runs
where content_hash !~ '^[a-f0-9]{64}$'

order by categoria, verificacao;
