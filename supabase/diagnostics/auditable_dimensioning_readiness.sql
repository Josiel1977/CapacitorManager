-- Diagnóstico somente leitura para a camada de dimensionamento auditável.
-- Execute DEPOIS de 202608210002_temporal_dimensioning_traceability.sql.

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

union all

select 'auditoria', 'séries temporais sem transformador', count(*)::bigint,
       case when count(*) = 0 then 'OK' else 'CORRIGIR' end
from public.dimensioning_runs
where source_method = 'temporal_measurements' and transformer_id is null

union all

select 'auditoria', 'especificações sem confirmações completas', count(*)::bigint,
       case when count(*) = 0 then 'OK' else 'CORRIGIR' end
from public.dimensioning_runs
where release_level = 'conditional_specification'
  and not (
    engineering_confirmations @> '{"representative_campaign_confirmed": true}'::jsonb
    and engineering_confirmations @> '{"harmonic_study_validated": true}'::jsonb
    and engineering_confirmations @> '{"protection_study_validated": true}'::jsonb
  )

order by categoria, verificacao;
