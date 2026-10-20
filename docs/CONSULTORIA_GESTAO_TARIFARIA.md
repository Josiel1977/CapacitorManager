# Consultoria e Gestão Tarifária — estudo técnico e implementação

Pesquisa e implementação: 20/10/2026. Escopo: ferramenta de apoio à consultoria de consumo; resultados condicionados à qualidade dos dados e validação técnica/contratual. Não promete redução de conta nem determina alteração de contrato automaticamente.

## Problema e entrega

O valor líquido de uma fatura pode conter parcelamentos, devoluções, benefícios e encargos de atraso. Ele não permite escolher a demanda contratada nem comparar modalidades isoladamente. A aplicação agora reaplica tarifas documentadas a um mesmo perfil de uso, calcula contratos alternativos e gera relatório com dados, fórmulas, evidências e pendências. O caminho é `/auditoria`, aba **Consultoria e Gestão Tarifária**.

A análise é prospectiva: “quanto custaria este perfil com estas tarifas e contratos?”. Não é reconstrução tributária do passado. Cada comparação usa uma única data tarifária de referência para todas as alternativas. Histórico de consumo não é histórico de tarifa.

## Pesquisa oficial e decisões de engenharia

| Tema | Fonte primária | Tratamento na ferramenta |
|---|---|---|
| Grupo A / B e modalidades | ANEEL, Modalidades Tarifárias; REN 1.000 | A1/A2/A3: Azul. A3a/A4/AS: Verde e Azul. B1/B2/B3: Convencional e Branca. B4 e baixa renda: sem Branca. Baixa renda bloqueia recomendação porque exige cálculo específico dos benefícios. |
| B-optante | REN 1.000, art. 292; Lei 14.300 | Não equivale a mudar livremente a tensão de conexão. Comparação com Grupo A somente após confirmação expressa do enquadramento e condições. Critérios especiais não são inferidos de kWh ou kW. |
| Demanda regular e ultrapassagem de consumo | REN 1.000, seção de faturamento e art. 301 | Regular = maior entre medida e contratada × tarifa. Adicional quando medida supera 105% do contrato: 2 × tarifa × diferença inteira. Não aplica esta tolerância de consumo à injeção. |
| Custo de disponibilidade | REN 1.000, art. 291 | Grupo B considera piso informado de 30, 50 ou 100 kWh; Branca usa tarifa convencional no piso. Benefícios e casos especiais precisam de tratamento próprio. |
| Reativo | REN 1.000, arts. 302–305 | Reativo faturado é evidência de custo; excedente não é reativo total. Não estima FP verdadeiro, kVAr de banco ou economia garantida a partir desses valores. Encaminha à campanha de medições já existente. B-optante deve ser distinguido de unidade atendida diretamente no Grupo B. |
| GD, energia injetada e compensação | Lei 14.300; REN 1.000 consolidada; REN 1.059 | Registra kWh injetados/compensados separadamente. Consumo líquido e custo residual devem ser confirmados por alternativa. Não subtrai injeção novamente nem presume que injeção = geração. |
| Fluxo reverso / conexão | ANEEL, Despacho 2.216/2024 e manual do art. 73 | Diagnóstico documental e plano de ação; estudo elétrico da rede, proteção, limite de exportação e aprovação são externos. Sem dimensionamento de injeção por regra de consumo. |
| Tarifas nacionais | ANEEL, dados abertos de tarifas de aplicação | Consulta estruturada por agente/subgrupo e filtro de vigência. Exclui Base Econômica. Mantém classe, subclasse, detalhe, acessante e resolução; seleção e conferência humanas. |
| Tributos, CIP e bandeiras | ANEEL, Ranking das Tarifas | Não compõem o total comparativo deste módulo. O preço homologado não é o preço final da conta. Sem tese genérica de isenção ou restituição. |

### Referências primárias

- https://www.gov.br/aneel/pt-br/assuntos/tarifas/entenda-a-tarifa/modalidades-tarifarias
- https://www.gov.br/aneel/pt-br/assuntos/tarifas/tarifa-branca
- https://www.gov.br/aneel/pt-br/assuntos/tarifas/ranking-das-tarifas
- https://www2.aneel.gov.br/cedoc/ren20211000.pdf
- https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/lei/l14300.htm
- https://www.gov.br/aneel/pt-br/assuntos/geracao-distribuida
- https://www2.aneel.gov.br/cedoc/adsp20242216_2.pdf
- https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica
- Dicionário: https://dadosabertos.aneel.gov.br/dataset/5a583f3e-1646-4f67-bf0f-69db4203e89e/resource/2d3478e0-8aa0-4cd4-81a7-5f8967cd8804/download/dd-tarifas-por-distribuidora.pdf

A página de modalidades e o catálogo foram consultados diretamente. O PDF consolidado da REN retornou HTTP 403 nesta infraestrutura; a referência é mantida para conferência do texto vigente pelo responsável. Não tratar regras especiais ou alterações futuras como automaticamente verificadas.

## Catálogo ANEEL

Recurso CKAN: `fcf2906c-7c32-4b9b-a637-054e7a5234f4`. A ação `datastore_search_sql` não existe neste servidor; foi verificada resposta real HTTP 400. Implementação usa `datastore_search`, filtros JSON exatos e `distinct=true` para agentes.

Validação real em 20/10/2026: lista com 116 agentes; Equatorial PA/A4 teve 846 registros de aplicação históricos e 50 registros vigentes para 15/07/2026. O número inclui linhas e possíveis registros repetidos, não 50 opções elegíveis para qualquer cliente. O sistema não escolhe automaticamente uma linha por ser a primeira ou a mais barata.

Conversões:

- `MWh`: TE e TUSD divididos por 1.000 para R$/kWh.
- `kWh`: valores preservados.
- `kW`: tarifa de demanda TUSD preservada em R$/kW.
- Campos decimais textuais brasileiros, inclusive `,00`, são interpretados explicitamente; ausentes ou unidades desconhecidas não viram zero.
- Datas ISO de início/fim de vigência filtradas inclusivamente.
- Registros fora da base **Tarifa de Aplicação** não são usados.
- Sem catálogo parcial: se o total CKAN exceder o retorno, a consulta falha de modo explícito.
- Cache servidor até 24h e timeout de 30s. Falha externa não dispara estimativa de tarifa. A data de geração da base e a consulta ficam na proveniência de cada linha selecionada.

A lista contém inclusive agentes históricos; só registros com vigência na data selecionada aparecem na busca. Existem tarifas específicas para acessantes e diferentes classes/detalhes. Por isso não é correto prometer um preço universal por concessionária e modalidade.

## Motor de cálculo

### Perfil

De 1 a 12 meses únicos, com energia líquida faturável por posto e demandas máximas medidas. Dados ausentes são `null`. Um mês incompleto não é preenchido com zero para gerar recomendação. Para recomendação final condicionada exige 12 meses **consecutivos** e revisão explícita. Menos meses permitem relatório preliminar.

### Otimização de demanda

Custo por mês é uma função linear por trechos do contrato. Pontos críticos: mínimo contratual, demanda medida e demanda medida / 1,05. A busca avalia piso/teto em centésimos desses pontos e escolhe menor custo; desempate por menor quantidade de ultrapassagens e maior contrato. Não há varredura arbitrária limitada a um intervalo de kW.

Verde usa o máximo entre ponta e fora. Azul calcula postos separadamente com os mínimos informados. Os mínimos de 30 kW são valores iniciais conservadores e editáveis, não imposição de 30 kW em ambos os postos para todo contrato. Incrementos e mínimos efetivamente aceitos pela distribuidora precisam ser conferidos. Contratos de injeção, sazonais, reserva, período de teste e descontos especiais não são cobertos por esse motor.

São exibidas alternativa econômica e alternativa com margem sobre o pico previsto. Um contrato econômico pode aceitar ultrapassagem esporádica; não é apresentado como contrato sem risco. Crescimento percentual incide igualmente sobre energia e demanda nos cenários, preservando o contrato atual na referência prospectiva. Custos de investimento/adequação não são deduzidos da economia exibida.

### Modalidades

Energia do Grupo A por ponta/fora; demanda única (Verde) ou por posto (Azul). Branca exige consumo em três postos e tarifa convencional para o piso. Dados monômios não são distribuídos artificialmente entre postos.

Diferença estimada = custo prospectivo com contrato atual menos custo da alternativa econômica, **no período informado**. Não anualiza um mês nem atribui economia de reativo à troca de modalidade. Empate impede indicar uma modalidade superior.

## Evidência e relatório

O relatório PDF contém identificação da UC, status, histórico, contratos, premissas, tarifas e suas fontes, diagnóstico de folga/ultrapassagem, comparação e memória mensal, evidências de reativo e injeção, plano de ação e referências. Inclui SHA-256 da serialização do estudo para vincular o relatório ao JSON exportado; não é assinatura digital ou prova de veracidade dos dados.

O JSON é o arquivo editável do estudo. Restauração valida estrutura e valores, limita tamanho, não executa conteúdo e retira confirmações de tarifa/dados/elegibilidade/SCEE. Não há gravação silenciosa de dados de clientes em um único rascunho compartilhado do navegador. Dados ficam em memória até a exportação.

O PDF analisado pode fornecer rascunho com identificação, contrato e histórico de demandas/consumos. A importação exige autorização de substituição e marca tudo para conferência. Com SCEE, não presume consumo líquido por posto. PDFs de outras distribuidoras ainda exigem preenchimento manual; o catálogo nacional de tarifas não é um parser nacional de PDFs.

## Limites e próximos componentes

Não implementado neste incremento: sincronização em banco por cliente/tenant, histórico de versões em nuvem, agendamento de atualização, reconstrução tributária histórica, extração universal de PDFs/OCR, liquidação completa SCEE por faixa de transição, faturamento do ACL com contrato de energia, sazonalização, multas rescisórias, custos de obra/migração, estudo de fluxo de potência da rede e assinatura ART/TRT.

Esses itens não são ocultados como resultado conclusivo. Tarifas manuais documentadas continuam disponíveis em indisponibilidade da ANEEL. A etapa comercial segura é apresentar estudo condicionado e validar o CUSD/perfil com profissional responsável antes de solicitar qualquer alteração.

## Validação deste incremento

- 152 testes automatizados passaram; incluem comparação de custos, pisos, crescimento, tolerância, lacunas/duplicidades, dados ausentes, restrições de modalidade, SCEE, importação e paginação PDF com fonte incorporada.
- TypeScript e lint dos arquivos novos/alterados sem erros.
- Build Next completo: compilação, tipagem e geração de 48 páginas com configuração pública Supabase fictícia apenas para teste. Não valida credenciais ou banco de produção.
- Handler compilado da consulta ANEEL verificado contra o serviço real: parâmetro inválido retornou 400; lista retornou 200/116 agentes; Equatorial PA/A4 em 15/07/2026 retornou 200/50 linhas/zero formatos rejeitados.
- PDFs reais enviados pelo usuário conferidos localmente: contrato de 250 kW e nove meses de histórico no caso industrial; 3.744 kWh de injeção identificados no caso B-optante. Nenhum dado identificador desses clientes foi incluído como fixture público no repositório.
- PDF sintético renderizado para inspeção visual; fonte incorporada evita dependência das fontes instaladas no leitor.
- Navegação visual completa em navegador não foi validada neste ambiente: Chromium não estava instalado e o download disponível não forneceu um arquivo válido. A interface compilou, mas o teste visual de desktop/celular permanece parte da homologação.


## Observação orientativa de ampliação e medição

A tela e o relatório incluem o exemplo Equatorial PA de 112,5 + 112,5 kVA, distinguindo B-optante/SCEE, demanda em kW e padrão físico de medição. A referência direta é a NT.00002.EQTL revisão 10, itens 6.8.1 e 6.8.8–6.8.10, consultada no PDF oficial publicado no portal Pará. A observação não é utilizada pelo motor como dimensionamento ou recomendação de obra. Há botão para inserir um roteiro editável no campo de diagnóstico, sem duplicar inserções e preservando o texto existente.
