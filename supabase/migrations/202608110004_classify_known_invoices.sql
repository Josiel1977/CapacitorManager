-- Classificação segura das três faturas conhecidas da WG ARMAZENS GERAIS LTDA.
-- Não calcula FP a partir do reativo excedente e não inventa penalidades.

begin;

update public.faturas
set reativo_origem = 'excedente_faturado'
where mes_referencia in ('11/2025', '12/2025', '01/2026')
  and reativo_origem = 'nao_classificado'
  and concessionaria = 'EQUATORIAL_PARA'
  and (
    (mes_referencia = '11/2025' and reativo_ponta_kvarh = 493.76 and reativo_fora_ponta_kvarh = 4696.54)
    or (mes_referencia = '12/2025' and reativo_ponta_kvarh = 1130.49 and reativo_fora_ponta_kvarh = 8932.83)
    or (mes_referencia = '01/2026' and reativo_ponta_kvarh = 993.00 and reativo_fora_ponta_kvarh = 8690.47)
  );

-- Única penalidade monetária explicitamente confirmada nos documentos atuais.
update public.faturas
set penalidade_reativa_informada = 289.45
where mes_referencia = '11/2025'
  and concessionaria = 'EQUATORIAL_PARA'
  and reativo_ponta_kvarh = 493.76
  and reativo_fora_ponta_kvarh = 4696.54
  and penalidade_reativa_informada is null;

commit;

select mes_referencia, reativo_origem, fp_calculado,
       penalidade_reativa_informada, fonte_dados
from public.faturas
where mes_referencia in ('11/2025', '12/2025', '01/2026')
order by mes_referencia;
