# Diagnóstico solar e tarifário

Disponível em `/auditoria` (também sem PDF) e no resultado de fatura em `/demo`.

1. Importe e confira a fatura. A extração reconhece B-optante, GD2, consumo monômio, compensação e dívida/atrasos. O PDF permanece processado em memória.
2. Informe o total de transformadores atuais e o total previsto, incluindo os existentes. Confirme UC/medição, geração local e créditos entre UCs.
3. Preencha consumo líquido após compensação e demanda medida por posto no mesmo mês. Não atribua automaticamente consumo monômio a fora de ponta. Para ampliação, documente cargas previstas.
4. Informe três cenários, com tarifas vigentes na mesma base tributária, demanda contratada, encargos GD residuais e demais custos recorrentes. A fonte/vigência/tensão das tarifas fica no relatório. Informe zero explicitamente nos custos comprovadamente ausentes.
5. Confira os dados. O sistema apresenta o menor custo mensal simulado somente com os três cenários completos e elegibilidade definida. B-optante inelegível permanece visível como contrafactual e não participa da escolha.
6. Imprima ou salve PDF pelo navegador. O relatório preserva premissas, pendências e fonte. Salvar/restaurar rascunho é opcional, local ao navegador, sem envio ao banco; restauração exige nova conferência.

## Limites

O simulador é mensal e usa as regras gerais de demanda, sem contratos especiais. Não recomenda uma contratação definitiva, não calcula automaticamente SCEE/conversão entre postos, não busca tarifas, não dimensiona banco a partir de excedente e não estima produção pelo número de placas. Compare 12 ciclos e investimentos antes de decidir. Confirmar disponibilidade verde/azul pela tensão e contrato.

Elegibilidade geral de B-optante com SCEE: geração local, transformadores até 112,5 kVA e ausência de créditos entre UCs. Referências: art. 11 da Lei 14.300 e art. 292 da REN 1.000. Não substitui análise de condições específicas nem confirmação da distribuidora.

Demanda: maior entre medida e contratada; verde considera o máximo dos postos; ultrapassagem acima de 5% adiciona duas vezes a tarifa sobre o excedente (art. 301 da REN 1.000). Sem validação específica de regras de demanda de injeção/contratos especiais.

## Validação

Testes cobrem elegibilidade, UCs separadas, custos, limite de ultrapassagem, empate e dados ausentes. Regressão do parser cobre quantidades inteiras e seleção do valor do boleto em vez de débitos antigos. Conferência local dos PDFs recebidos feita com o mesmo PDFParse usado no endpoint; documentos e nomes do cliente não foram adicionados ao repositório.
