# Arquitetura de monitoramento dos bancos de capacitores

## Situação atual

O CapacitorManager já trata o banco como ativo e relaciona a ele os capacitores e as medições de campo. A RC17 usa essa estrutura no relatório, mas **não declara monitoramento em tempo real**: hoje a condição é calculada a partir dos ensaios registrados.

Esta separação deve permanecer explícita no produto:

- **condição atual:** resultado da última medição válida de cada capacitor;
- **cobertura:** quantidade de capacitores ativos que possuem medição;
- **confiança histórica:** qualidade da série para análise de tendência;
- **telemetria:** variáveis elétricas e operacionais recebidas de equipamento conectado.

“Histórico insuficiente” é uma condição de confiança da projeção, não um defeito. Um banco com cobertura parcial também não pode ser apresentado como integralmente aprovado.

## Experiência recomendada

O banco é a unidade principal para o gestor da instalação. O capacitor continua sendo a unidade de diagnóstico e manutenção.

1. **Visão da instalação:** todos os bancos, condição prioritária, cobertura, potência cadastrada e última inspeção.
2. **Visão do banco:** identificação, local, tensão, potência cadastrada, componentes e plano de ação.
3. **Visão do capacitor/estágio:** última condição, desvio, tendência, projeção responsável e histórico.
4. **Visão conectada futura:** fator de potência, potência reativa, harmônicos, temperatura, estágios e eventos.

O relatório possui dois níveis:

- **Gerencial (padrão):** última condição agrupada por banco, adequado à reunião com o cliente;
- **Completo:** acrescenta o histórico bruto de medições, agrupado pelo respectivo banco.

## Contrato mínimo de telemetria futura

O equipamento ou gateway deverá enviar registros idempotentes. Cada mensagem precisa conter:

| Grupo | Campos mínimos |
|---|---|
| Identidade | `tenant_id`, `bank_id`, `device_id`, `ingestion_key` |
| Tempo | `measured_at` em UTC, fuso original e número de sequência quando disponível |
| Qualidade | `quality` (`good`, `uncertain`, `bad`) e motivo quando aplicável |
| Elétrica | tensões, correntes, `kW`, `kVAr`, `kVA`, fator de potência e frequência |
| Qualidade de energia | THD de tensão/corrente quando o instrumento fornecer medições compatíveis |
| Operação | temperatura, número/máscara de estágios ativos e estado de alarme |
| Origem | protocolo, fabricante, modelo, série e versão do firmware |

Valores ausentes devem permanecer nulos. O sistema não deve fabricar zero, estimar uma fase ausente nem converter uma variável não medida em diagnóstico confirmado.

## Entidades planejadas

As tabelas só devem ser criadas quando o primeiro equipamento/protocolo estiver definido e homologado:

- `bank_monitoring_devices`: dispositivo, protocolo, versão, situação e último contato;
- `bank_telemetry`: série temporal imutável e idempotente;
- `bank_events`: alarmes, início/fim, severidade e reconhecimento;
- `bank_stage_events`: comandos e respostas por estágio quando o hardware os disponibilizar;
- `bank_alert_rules`: limites versionados por cliente/banco;
- `bank_device_health`: comunicação, atraso, perda de amostras e relógio.

Decisão de arquitetura: não criar uma tabela por fabricante. Adaptadores Modbus, MQTT ou API convertem o payload do fabricante para o contrato comum e preservam o payload original para auditoria.

## Alarmes candidatos

Os alarmes dependem do instrumento e de validação do responsável técnico. A ordem inicial recomendada é:

1. perda de comunicação ou dados atrasados;
2. fator de potência abaixo da meta configurada;
3. sobrecompensação/fator de potência capacitivo;
4. estágio comandado sem corrente esperada ou estágio aparentemente travado;
5. desequilíbrio de corrente entre fases;
6. temperatura elevada;
7. THD elevado ou risco de ressonância a ser confirmado por estudo de qualidade de energia;
8. número excessivo de manobras e indício de desgaste do contator.

O alerta deve registrar evidência, limite usado, duração, qualidade da amostra e versão da regra. Evitar um “score de saúde” opaco como único diagnóstico.

## Segurança e confiabilidade

- ingestão somente por API de servidor ou gateway autenticado; nunca expor `service_role` no navegador ou dispositivo;
- chave por dispositivo, rotação e possibilidade de revogação;
- RLS por `tenant_id` para leitura da aplicação;
- idempotência por dispositivo e `ingestion_key`;
- dados de telemetria imutáveis; correções por nova versão/evento, sem sobrescrever histórico;
- limites de taxa, tamanho de payload e retenção definidos antes do piloto;
- relógio, fuso e qualidade da amostra visíveis;
- processamento de alarmes separado da ingestão para não perder dados em caso de falha da regra;
- auditoria de configuração, reconhecimento de alarme e ação do usuário.

## Roteiro de implantação

### Fase 1 — entregue na RC17

- relatório consolidado por banco;
- relatório de um banco selecionado;
- cobertura separada da condição atual;
- cores de saúde preservadas;
- histórico e projeção apresentados como confiança separada;
- modo gerencial compacto e modo completo.

### Fase 2 — cadastro operacional

- inventário de controlador, contatores, estágios, proteção, ventilação e reatores;
- vínculo do capacitor ao estágio;
- plano de inspeção e registro estruturado de intervenção;
- painel por banco usando somente dados efetivamente medidos.

### Fase 3 — piloto conectado

- escolher um controlador/analisador e protocolo;
- homologar grandezas, escala, sinal de `kVAr`, fuso e taxa de amostragem;
- implantar em um banco, comparar com instrumento de referência e medir perda de dados;
- ativar primeiro alarmes de comunicação e regras simples, mantendo revisão humana.

### Fase 4 — operação comercial

- filas e repetição segura da ingestão;
- observabilidade, retenção, backup e exportação;
- SLA e política de incidentes;
- alertas versionados, notificações e confirmação de ação;
- expansão gradual por cliente e equipamento homologado.

## Referências técnicas usadas no desenho

- IEC 60831-1/2 para unidades e bancos de capacitores autorregenerativos de baixa tensão;
- IEC 61000-4-30 para métodos de medição e interpretação de parâmetros de qualidade de energia;
- documentação do fabricante do controlador/analisador efetivamente adotado no piloto.

As normas e os manuais completos devem ser adquiridos/consultados pelo responsável técnico. O software não deve afirmar conformidade de um instrumento ou instalação apenas porque armazena campos com nomes semelhantes aos parâmetros normativos.
