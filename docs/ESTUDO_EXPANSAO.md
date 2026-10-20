# Expansão de carga e transformadores

Área pública em `/auditoria`, aba **Expansão e transformadores**. Estudo separado da comparação tarifária, sem persistência automática ou inferência de potência a partir de kWh. Importação da fatura substitui o estudo somente após confirmação e traz identificação/enquadramento para conferência, nunca FP, capacidade ou curva bruta supostamente medida.

## Entradas e decisões

- Distingue BT, B-optante em MT e Grupo A; SCEE, geração local, créditos remotos e mesma UC precisam ser informados.
- BT utiliza o critério geral de 75 kW de carga instalada, com aviso de exceções e análise da distribuidora. Fatores de simultaneidade não reduzem a carga instalada.
- B-optante com SCEE verifica a soma de 112,5 kVA, geração local e ausência de transferência de excedentes entre UCs. Ultrapassar o teto não gera sugestão de trafo artificialmente menor.
- A análise de B-optante sem SCEE e de outras distribuidoras permanece pendente de estudo específico. Não confundir enquadramento tarifário com nível de medição ou obra exigida.
- Transformação atual é soma e quantidade; alternativas: manter, adicionar ou substituir **toda** a transformação. A referência automática é para um único transformador atendendo toda a carga modelada, não para o transformador adicional de uma rede com vários setores.
- Fonte, pico bruto, FP e confirmações são obrigatórios para liberar uma referência. Pico líquido na entrada de uma instalação com solar pode não representar o carregamento bruto. Não usar energia mensal para definir demanda.

## Modelo simplificado

Equipamentos: quantidade, potência elétrica ou mecânica (kW/cv), rendimento para potência mecânica, FP indutivo, utilização, parcela simultânea e horário em horas inteiras. Conversão: `P_elétrica = P_mecânica / rendimento`, `1 cv = 0,73549875 kW`.

Para cada uma das 24 horas, somam-se P e Q indutivo das cargas novas ativas e a base bruta existente. Q = P × tan(acos(FP)); S = hypot(P,Q). A base atual máxima é conservadoramente mantida em todas as horas; o resultado não é curva medida nem demanda faturável de 15 minutos. Horários noturnos atravessam a meia-noite; 0–24 representa dia completo.

Crescimento multiplica a base e as cargas novas. A capacidade de planejamento é `maior S × (1 + margem/100) / (carregamento/100)`. Carregamento padrão de 80% e margem de 10% são premissas editáveis, não requisitos normativos. Evitar contabilizar crescimento duas vezes. Carga instalada para o critério BT deriva do inventário declarado, não da reserva percentual.

Referências trifásicas limitadas às faixas 75/112,5/150/225/300/500/750/1000/1500/2000 kVA presentes na tabela 10A da NT.00002. Não é catálogo universal; confirmar fabricante, padrão e projeto. Necessidade superior a 2000 kVA fica sem referência automática.

Medição Equatorial PA: a partir do arranjo informado, orientar os itens 6.8.1, 6.8.8 e 6.8.9; sempre lembrar que localização (6.8.10) e projeto podem modificar a exigência. Um único trafo até 300 kVA em poste/pedestal não é sinônimo de cabine primária obrigatória, nem de dispensa garantida.

## Relatório e limites

PDF próprio inclui inventário, hipóteses, cálculos, pendências, encaminhamento e referências. SHA-256 do JSON identifica o snapshot exportado. Importação valida estrutura e remove as confirmações de UC, pico bruto e revisão. Não há salvamento em nuvem; exportar JSON para conservar os dados.

O módulo não calcula partidas, desequilíbrio, harmônicos, curto-circuito, perdas, ventilação, queda de tensão, proteção, alocação entre transformadores, potência reversa ou custo total de obra/tarifas. Não determina o melhor investimento, aprova conexão ou substitui projeto e responsabilidade técnica. Organizar horários só reduz picos se for operacionalmente comprovado. A aprovação final permanece com a distribuidora e o responsável pelo projeto.

## Fontes verificadas em 20/10/2026

- [Equatorial PA, NT.00002, rev. 10/2025](https://pa.equatorialenergia.com.br/wp-content/uploads/2025/12/NT.00002.EQTL-10-Fornecimento-de-Energia-Eletrica-em-Media-Tensao-138kV-231kV-e-345kV.pdf), itens 5.14, 6.8 e tabela 10A.
- [FAQ oficial Celesc sobre critérios nacionais do art. 292, §3º](https://www.celesc.com.br/micro-mini-geracao?catid=13:duvidas-frequentes&id=529:perguntas-frequentes&view=article). Prazos e procedimentos locais de 2023 não foram transportados para a Equatorial.
- [REN 1.000 consolidada](https://www2.aneel.gov.br/cedoc/ren20211000.pdf): acesso automatizado retornou HTTP 403 nesta sessão; consultar o texto vigente na validação do projeto. A norma da Equatorial referencia o art. 23; o FAQ oficial transcreve os critérios do art. 292.

## Verificação

Testes cobrem teto B-optante, soma de transformadores, manter/substituir, necessidade acima do teto, conversão mecânica e soma P/Q, horários separados/noturnos, parâmetros, bloqueio por ausência de medições, carga instalada BT, créditos remotos e restauração validada. Relatório sintético deve ser renderizado antes de publicação.
